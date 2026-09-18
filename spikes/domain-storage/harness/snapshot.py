"""Backup / restore and the naive-copy counter-example (C6).

The point of this module is the contrast:

  naive_file_copy()  - copies ONLY the main .db file while the database is
                       open. In WAL mode the committed-but-not-checkpointed
                       transactions live in the -wal sidecar, so the copy is
                       silently STALE. No error is raised. This is the
                       failure mode the task calls out.

  online_backup()    - sqlite3.Connection.backup(), i.e. the SQLite Online
                       Backup API. It copies a consistent snapshot of the
                       committed database, WAL included.
"""

from __future__ import annotations

import hashlib
import shutil
import sqlite3

from . import db


def naive_file_copy(src_path, dest_path):
    """The unsafe thing: cp of the main file, sidecars left behind."""
    shutil.copyfile(str(src_path), str(dest_path))
    return dest_path


def online_backup(src_conn: sqlite3.Connection, dest_path):
    """The safe thing: SQLite Online Backup API."""
    dest = sqlite3.connect(str(dest_path))
    try:
        src_conn.backup(dest)
    finally:
        dest.close()
    return dest_path


def restore(backup_path, restored_path):
    """Restore = Online Backup API in the other direction, into a fresh file."""
    src = sqlite3.connect(str(backup_path))
    dest = sqlite3.connect(str(restored_path))
    try:
        src.backup(dest)
    finally:
        dest.close()
        src.close()
    return restored_path


def digest(conn: sqlite3.Connection) -> str:
    """Content fingerprint of every domain table, order-stable."""
    h = hashlib.sha256()
    for table in sorted(db.DOMAIN_TABLES):
        h.update(("\n#%s\n" % table).encode())
        for row in conn.execute("SELECT * FROM %s ORDER BY id" % table):
            h.update(repr(tuple(row)).encode())
    return h.hexdigest()


def row_counts(conn: sqlite3.Connection):
    return {
        t: conn.execute("SELECT COUNT(*) FROM %s" % t).fetchone()[0]
        for t in db.DOMAIN_TABLES
    }


def inspect(path):
    """Open a database file standalone and report its health + contents."""
    conn = db.connect(path)
    try:
        return {
            "integrity_check": conn.execute("PRAGMA integrity_check").fetchone()[0],
            "foreign_key_check": conn.execute("PRAGMA foreign_key_check").fetchall(),
            "schema_version": db.schema_version(conn),
            "row_counts": row_counts(conn),
            "digest": digest(conn),
        }
    finally:
        conn.close()
