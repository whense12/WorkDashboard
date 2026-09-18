"""Write path with audit, plus undo (C4).

Undo and audit are different mechanisms and this module keeps them apart:

  * audit_event is APPEND-ONLY. v1.sql installs BEFORE UPDATE / BEFORE
    DELETE triggers that RAISE(ABORT), so "undo deleted the history" is not
    merely discouraged, it is rejected by the database.
  * undo is a NEW forward change. It reverses the entity state and writes
    an ADDITIONAL audit row with action='undo' and undo_of_audit_id set.

So after change + undo the history holds BOTH rows.

A delete is NOT just the named row. The database also removes descendants
through ON DELETE CASCADE and detaches referrers through ON DELETE SET NULL,
and it does so silently. Recording only the named row would mean the history
never knew those rows existed and undo could never bring them back - a
one-way data loss behind a button labelled "undo". So delete() walks the
referential fallout FIRST, stores it in audit_event.cascade_json, and undo()
replays it. The walk is driven by PRAGMA foreign_key_list, i.e. by the live
database, so it cannot drift away from schema/*.sql.
"""

from __future__ import annotations

import json
import sqlite3

ACTOR = "spike"


def _row_dict(conn, table, entity_id):
    row = conn.execute(
        "SELECT * FROM %s WHERE id = ?" % table, (entity_id,)
    ).fetchone()
    return dict(row) if row is not None else None


def _log(conn, table, entity_id, action, before, after, undo_of=None, at=None,
         fallout=None):
    cur = conn.execute(
        "INSERT INTO audit_event (occurred_at, actor, entity_table, entity_id,"
        " action, before_json, after_json, cascade_json, undo_of_audit_id)"
        " VALUES (?,?,?,?,?,?,?,?,?)",
        (
            at or _clock(conn),
            ACTOR,
            table,
            entity_id,
            action,
            None if before is None else json.dumps(before, sort_keys=True),
            None if after is None else json.dumps(after, sort_keys=True),
            _fallout_json(fallout),
            undo_of,
        ),
    )
    return cur.lastrowid


def _clock(conn):
    """Monotonic, deterministic stamp - real wall clock would make tests flaky."""
    n = conn.execute("SELECT COUNT(*) FROM audit_event").fetchone()[0]
    return "2026-01-01T00:%02d:%02dZ" % (n // 60, n % 60)


# ------------------------------------------------------- referential fallout

def _pk_column(conn, table):
    for r in conn.execute("PRAGMA table_info(%s)" % table):
        if r["pk"]:
            return r["name"]
    raise RuntimeError("no single-column primary key on %s" % table)


def _child_links(conn):
    """parent_table -> [(child_table, child_col, parent_col, on_delete)].

    Read out of the live database rather than parsed out of the .sql file,
    so a FK added to the schema is picked up here automatically.
    """
    links = {}
    tables = [
        r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
            " AND name NOT LIKE 'sqlite_%'"
        )
    ]
    for child in tables:
        for r in conn.execute("PRAGMA foreign_key_list(%s)" % child):
            if r["seq"] != 0:
                # Composite FKs would need column-tuple matching. None exist;
                # fail loudly rather than capture a partial fallout.
                raise NotImplementedError(
                    "composite foreign key on %s is not handled" % child)
            parent = r["table"]
            parent_col = r["to"] or _pk_column(conn, parent)
            links.setdefault(parent, []).append(
                (child, r["from"], parent_col, (r["on_delete"] or "").upper()))
    return links


def _fallout(conn, table, entity_id):
    """Everything DELETE FROM <table> WHERE id=<entity_id> would also do.

    Returns (deleted, nulled):
      deleted - [{"table":.., "row": {..}}] for ON DELETE CASCADE descendants,
                in discovery order (a row's parent always appears before it).
      nulled  - [{"table":.., "pk":.., "pk_value":.., "column":.., "value":..}]
                for ON DELETE SET NULL referrers.
    RESTRICT / NO ACTION children are not collected: the database refuses the
    delete outright, so nothing is lost and there is nothing to record.
    """
    links = _child_links(conn)
    deleted, nulled = [], []
    root_pk = _pk_column(conn, table)
    seen = {(table, entity_id)}
    queue = [(table, root_pk, entity_id)]
    while queue:
        ptable, ppk, pid = queue.pop(0)
        prow = conn.execute(
            "SELECT * FROM %s WHERE %s = ?" % (ptable, ppk), (pid,)
        ).fetchone()
        if prow is None:
            continue
        for child, child_col, parent_col, on_delete in links.get(ptable, ()):
            key = prow[parent_col]
            if key is None:
                continue
            rows = conn.execute(
                "SELECT * FROM %s WHERE %s = ?" % (child, child_col), (key,)
            ).fetchall()
            if not rows:
                continue
            cpk = _pk_column(conn, child)
            for row in rows:
                if on_delete == "CASCADE":
                    ident = (child, row[cpk])
                    if ident in seen:
                        continue
                    seen.add(ident)
                    deleted.append({"table": child, "row": dict(row)})
                    queue.append((child, cpk, row[cpk]))
                elif on_delete == "SET NULL":
                    nulled.append({
                        "table": child,
                        "pk": cpk,
                        "pk_value": row[cpk],
                        "column": child_col,
                        "value": row[child_col],
                    })
                elif on_delete == "SET DEFAULT":
                    raise NotImplementedError(
                        "ON DELETE SET DEFAULT on %s.%s is not handled"
                        % (child, child_col))
    return deleted, nulled


def _fallout_json(fallout):
    if not fallout:
        return None
    deleted, nulled = fallout
    if not deleted and not nulled:
        return None
    return json.dumps({"deleted": deleted, "nulled": nulled}, sort_keys=True)


def _restore_fallout(conn, cascade_json):
    """Put back exactly what cascade_json says the delete destroyed."""
    if not cascade_json:
        return
    payload = json.loads(cascade_json)
    pending = list(payload.get("deleted", ()))
    # Foreign keys are ON, so a child cannot go back before its parent.
    # Discovery order already satisfies that; the retry loop keeps it correct
    # even if a row is reachable through more than one parent.
    while pending:
        remaining, progressed = [], 0
        for item in pending:
            row = item["row"]
            cols = ",".join(row)
            marks = ",".join("?" * len(row))
            try:
                conn.execute(
                    "INSERT INTO %s (%s) VALUES (%s)"
                    % (item["table"], cols, marks),
                    tuple(row.values()),
                )
            except sqlite3.IntegrityError:
                remaining.append(item)
            else:
                progressed += 1
        if not progressed:
            raise RuntimeError(
                "undo could not restore cascade-deleted rows: %r"
                % sorted({i["table"] for i in remaining}))
        pending = remaining
    for item in payload.get("nulled", ()):
        conn.execute(
            "UPDATE %s SET %s = ? WHERE %s = ?"
            % (item["table"], item["column"], item["pk"]),
            (item["value"], item["pk_value"]),
        )


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
    """Delete the row AND record every row the database removes with it."""
    before = _row_dict(conn, table, entity_id)
    if before is None:
        raise LookupError("no %s %r" % (table, entity_id))
    fallout = _fallout(conn, table, entity_id)
    conn.execute("DELETE FROM %s WHERE id = ?" % table, (entity_id,))
    return _log(conn, table, entity_id, "delete", before, None, fallout=fallout)


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

    fallout = None
    if a["action"] == "create":
        state_before_undo = _row_dict(conn, table, entity_id)
        # Undoing a create deletes the row, which cascades exactly like any
        # other delete - so the same fallout is captured onto the undo row.
        fallout = _fallout(conn, table, entity_id)
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
        # ... and then the children the original delete carried off with it.
        _restore_fallout(conn, a["cascade_json"])
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
        undo_of=audit_id, fallout=fallout,
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
