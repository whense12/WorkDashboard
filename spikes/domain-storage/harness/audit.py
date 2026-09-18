"""Write path with audit, plus undo (C4).

Undo and audit are different mechanisms and this module keeps them apart:

  * audit_event is APPEND-ONLY. v1.sql installs BEFORE UPDATE / BEFORE
    DELETE triggers that RAISE(ABORT), so "undo deleted the history" is not
    merely discouraged, it is rejected by the database.
  * undo is a NEW forward change. It reverses the entity state and writes
    an ADDITIONAL audit row with action='undo' and undo_of_audit_id set.

So after change + undo the history holds BOTH rows.
"""

from __future__ import annotations

import json

ACTOR = "spike"


def _row_dict(conn, table, entity_id):
    row = conn.execute(
        "SELECT * FROM %s WHERE id = ?" % table, (entity_id,)
    ).fetchone()
    return dict(row) if row is not None else None


def _log(conn, table, entity_id, action, before, after, undo_of=None, at=None):
    cur = conn.execute(
        "INSERT INTO audit_event (occurred_at, actor, entity_table, entity_id,"
        " action, before_json, after_json, undo_of_audit_id)"
        " VALUES (?,?,?,?,?,?,?,?)",
        (
            at or _clock(conn),
            ACTOR,
            table,
            entity_id,
            action,
            None if before is None else json.dumps(before, sort_keys=True),
            None if after is None else json.dumps(after, sort_keys=True),
            undo_of,
        ),
    )
    return cur.lastrowid


def _clock(conn):
    """Monotonic, deterministic stamp - real wall clock would make tests flaky."""
    n = conn.execute("SELECT COUNT(*) FROM audit_event").fetchone()[0]
    return "2026-01-01T00:%02d:%02dZ" % (n // 60, n % 60)


def create(conn, table, **values):
    cols = ",".join(values)
    marks = ",".join("?" * len(values))
    cur = conn.execute(
        "INSERT INTO %s (%s) VALUES (%s)" % (table, cols, marks),
        tuple(values.values()),
    )
    entity_id = cur.lastrowid
    after = _row_dict(conn, table, entity_id)
    audit_id = _log(conn, table, entity_id, "create", None, after)
    return entity_id, audit_id


def update(conn, table, entity_id, **changes):
    before = _row_dict(conn, table, entity_id)
    if before is None:
        raise LookupError("no %s %r" % (table, entity_id))
    sets = ",".join("%s = ?" % c for c in changes)
    conn.execute(
        "UPDATE %s SET %s WHERE id = ?" % (table, sets),
        tuple(changes.values()) + (entity_id,),
    )
    after = _row_dict(conn, table, entity_id)
    return _log(conn, table, entity_id, "update", before, after)


def delete(conn, table, entity_id):
    before = _row_dict(conn, table, entity_id)
    if before is None:
        raise LookupError("no %s %r" % (table, entity_id))
    conn.execute("DELETE FROM %s WHERE id = ?" % table, (entity_id,))
    return _log(conn, table, entity_id, "delete", before, None)


def undo(conn, audit_id):
    """Reverse one audited change. Writes a new audit row; deletes none."""
    a = conn.execute(
        "SELECT * FROM audit_event WHERE id = ?", (audit_id,)
    ).fetchone()
    if a is None:
        raise LookupError("no audit_event %r" % audit_id)
    if a["action"] == "undo":
        # Redo / undo-of-undo is a product question, not a storage one.
        # See NOTES.md OPEN-4.
        raise NotImplementedError("undoing an undo is OPEN, not decided here")

    table, entity_id = a["entity_table"], a["entity_id"]
    before = json.loads(a["before_json"]) if a["before_json"] else None
    after = json.loads(a["after_json"]) if a["after_json"] else None

    if a["action"] == "create":
        state_before_undo = _row_dict(conn, table, entity_id)
        conn.execute("DELETE FROM %s WHERE id = ?" % table, (entity_id,))
        new_state = None
    elif a["action"] == "delete":
        state_before_undo = None
        cols = ",".join(before)
        marks = ",".join("?" * len(before))
        conn.execute(
            "INSERT INTO %s (%s) VALUES (%s)" % (table, cols, marks),
            tuple(before.values()),
        )
        new_state = _row_dict(conn, table, entity_id)
    else:  # update
        state_before_undo = _row_dict(conn, table, entity_id)
        restore = {k: v for k, v in before.items() if k != "id"}
        sets = ",".join("%s = ?" % c for c in restore)
        conn.execute(
            "UPDATE %s SET %s WHERE id = ?" % (table, sets),
            tuple(restore.values()) + (entity_id,),
        )
        new_state = _row_dict(conn, table, entity_id)
        assert after is not None

    return _log(
        conn, table, entity_id, "undo", state_before_undo, new_state,
        undo_of=audit_id,
    )


def history(conn, table=None, entity_id=None):
    sql = "SELECT * FROM audit_event"
    args = []
    if table is not None:
        sql += " WHERE entity_table = ?"
        args.append(table)
        if entity_id is not None:
            sql += " AND entity_id = ?"
            args.append(entity_id)
    sql += " ORDER BY id"
    return conn.execute(sql, args).fetchall()
