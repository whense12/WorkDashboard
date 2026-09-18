"""Connection / schema / migration plumbing."""

from __future__ import annotations

import pathlib
import sqlite3

SCHEMA_DIR = pathlib.Path(__file__).resolve().parent.parent / "schema"

# The exact entity list from C1 - core + support. Nothing else is a domain
# entity. `schema_version` is storage infrastructure and is tracked apart so
# a test can assert it is the ONLY non-domain table.
CORE_TABLES = (
    "event",
    "vendor",
    "participation_plan",
    "participation_exception",
    "schedule_item",
    "work_item",
    "attachment",
)
SUPPORT_TABLES = (
    "dday_pin",
    "reminder",
    "audit_event",
    "layout_profile",
    "template",
)
DOMAIN_TABLES = CORE_TABLES + SUPPORT_TABLES
INFRA_TABLES = ("schema_version",)


def connect(path, *, foreign_keys: bool = True) -> sqlite3.Connection:
    """Open a connection with the pragmas this product relies on.

    isolation_level=None => no implicit transactions; every BEGIN/COMMIT in
    the harness is explicit, which is what the C6 rollback test needs.
    PRAGMA foreign_keys is per-connection, so it is set here, every time.
    """
    conn = sqlite3.connect(str(path), isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = %s" % ("ON" if foreign_keys else "OFF"))
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def _statements(sql: str):
    """Split a script into statements WITHOUT using executescript().

    executescript() commits any pending transaction before it runs, which
    would silently break the explicit transaction the v2 migration needs.
    sqlite3.complete_statement() is sqlite3_complete(), so it understands
    comments and CREATE TRIGGER ... BEGIN ... END; bodies.
    """
    buf = ""
    for line in sql.splitlines(keepends=True):
        buf += line
        if buf.strip() and sqlite3.complete_statement(buf):
            yield buf
            buf = ""
    if buf.strip():
        raise ValueError("trailing incomplete SQL: %r" % buf[:80])


def _run_script(conn: sqlite3.Connection, name: str) -> int:
    sql = (SCHEMA_DIR / name).read_text(encoding="utf-8")
    count = 0
    for stmt in _statements(sql):
        conn.execute(stmt)
        count += 1
    return count


def init_v1(path) -> sqlite3.Connection:
    conn = connect(path)
    _run_script(conn, "v1.sql")
    return conn


def schema_version(conn: sqlite3.Connection) -> int:
    return conn.execute(
        "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
    ).fetchone()[0]


def migrate_to_v2(conn: sqlite3.Connection, *, now: str = "1970-01-01T00:00:01Z"):
    """The documented SQLite table-rebuild procedure.

    Returns the rows reported by PRAGMA foreign_key_check inside the
    migration transaction - callers assert it is empty.
    """
    if schema_version(conn) != 1:
        raise RuntimeError("migrate_to_v2 expects schema v1")

    conn.execute("PRAGMA foreign_keys = OFF")
    try:
        conn.execute("BEGIN")
        try:
            _run_script(conn, "v2.sql")
            violations = conn.execute("PRAGMA foreign_key_check").fetchall()
            if violations:
                raise RuntimeError("migration would orphan rows: %r" % (violations,))
            conn.execute(
                "INSERT INTO schema_version (version, applied_at)"
                " VALUES (2, ?)", (now,)
            )
        except Exception:
            # An aborted migration must leave a usable v1 database behind,
            # not a half-rebuilt one.
            conn.execute("ROLLBACK")
            raise
        conn.execute("COMMIT")
    finally:
        conn.execute("PRAGMA foreign_keys = ON")
    return violations


def init_current(path) -> sqlite3.Connection:
    """A database at the current schema version, reached the only way a real
    install would reach it: create v1, then run the migration."""
    conn = init_v1(path)
    migrate_to_v2(conn)
    return conn


def table_names(conn: sqlite3.Connection):
    return sorted(
        r[0]
        for r in conn.execute(
            "SELECT name FROM sqlite_master "
            "WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
    )
