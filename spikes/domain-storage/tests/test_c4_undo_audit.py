"""C4 - undo and audit are NOT the same mechanism. Kernel MUST 11."""

import json
import sqlite3
import unittest

from _support import DbCase
from harness import audit


class UndoIsNotAudit(DbCase):
    def setUp(self):
        super().setUp()
        self.vid, self.created = audit.create(
            self.conn, "vendor", name="고성한과", contact="055-000-0000")

    def vendor(self):
        return self.conn.execute(
            "SELECT * FROM vendor WHERE id = ?", (self.vid,)).fetchone()

    def test_change_then_undo_leaves_BOTH_rows_in_history(self):
        changed = audit.update(self.conn, "vendor", self.vid, name="고성한과(주)")
        self.assertEqual("고성한과(주)", self.vendor()["name"])

        undone = audit.undo(self.conn, changed)
        self.assertEqual("고성한과", self.vendor()["name"])

        rows = audit.history(self.conn, "vendor", self.vid)
        actions = [r["action"] for r in rows]
        self.assertEqual(["create", "update", "undo"], actions)

        original = next(r for r in rows if r["id"] == changed)
        self.assertEqual("update", original["action"])
        self.assertEqual("고성한과(주)", json.loads(original["after_json"])["name"])

        reversal = next(r for r in rows if r["id"] == undone)
        self.assertEqual("undo", reversal["action"])
        self.assertEqual(changed, reversal["undo_of_audit_id"])

    def test_undo_only_ever_appends(self):
        before = self.conn.execute("SELECT COUNT(*) FROM audit_event").fetchone()[0]
        changed = audit.update(self.conn, "vendor", self.vid, notes="메모")
        audit.undo(self.conn, changed)
        after = self.conn.execute("SELECT COUNT(*) FROM audit_event").fetchone()[0]
        self.assertEqual(before + 2, after)

    def test_the_database_itself_rejects_deleting_audit_rows(self):
        changed = audit.update(self.conn, "vendor", self.vid, notes="메모")
        with self.assertRaises(sqlite3.IntegrityError) as ctx:
            self.conn.execute("DELETE FROM audit_event WHERE id = ?", (changed,))
        self.assertIn("append-only", str(ctx.exception))

    def test_the_database_itself_rejects_rewriting_audit_rows(self):
        with self.assertRaises(sqlite3.IntegrityError) as ctx:
            self.conn.execute("UPDATE audit_event SET action = 'create'")
        self.assertIn("append-only", str(ctx.exception))

    def test_undoing_a_delete_restores_the_row_and_keeps_the_delete_in_history(self):
        removed = audit.delete(self.conn, "vendor", self.vid)
        self.assertIsNone(self.vendor())
        audit.undo(self.conn, removed)
        self.assertEqual("고성한과", self.vendor()["name"])
        self.assertEqual(
            ["create", "delete", "undo"],
            [r["action"] for r in audit.history(self.conn, "vendor", self.vid)])

    def test_undoing_a_create_removes_the_row_and_keeps_the_create_in_history(self):
        vid2, made = audit.create(self.conn, "vendor", name="임시업체")
        audit.undo(self.conn, made)
        self.assertIsNone(self.conn.execute(
            "SELECT * FROM vendor WHERE id = ?", (vid2,)).fetchone())
        self.assertEqual(
            ["create", "undo"],
            [r["action"] for r in audit.history(self.conn, "vendor", vid2)])

    def test_history_survives_deleting_the_entity(self):
        """audit_event.entity_id is deliberately not a foreign key."""
        audit.delete(self.conn, "vendor", self.vid)
        self.assertEqual(
            2, len(audit.history(self.conn, "vendor", self.vid)))

    def test_undo_of_an_undo_is_reported_open_not_guessed(self):
        changed = audit.update(self.conn, "vendor", self.vid, notes="메모")
        undone = audit.undo(self.conn, changed)
        with self.assertRaises(NotImplementedError):
            audit.undo(self.conn, undone)


if __name__ == "__main__":
    unittest.main()
