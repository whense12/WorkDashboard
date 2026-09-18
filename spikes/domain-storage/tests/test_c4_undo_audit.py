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


class UndoOfADeleteRestoresTheWholeCascade(DbCase):
    """A delete destroys more than the row you named.

    ON DELETE CASCADE removes descendants and ON DELETE SET NULL detaches
    referrers, both silently. If undo only put the named row back, every one
    of those rows would be gone for good and no audit row would ever show
    that they existed - which is not 실수 복구 and not 변경 이력 (MUST 11).
    """

    def setUp(self):
        super().setUp()
        self.ev, self.vd = self.seed_event_vendor()
        self.plan, self.plan_audit = audit.create(
            self.conn, "participation_plan",
            event_id=self.ev, vendor_id=self.vd,
            period_start="2026-10-17", period_end="2026-11-01",
            pattern="weekends")
        for d in ("2026-10-24", "2026-10-21"):
            self.conn.execute(
                "INSERT INTO participation_exception (plan_id, on_date, kind,"
                " note) VALUES (?,?,'exclude','휴무')", (self.plan, d))

    def rows(self, table, order="id"):
        return [tuple(r) for r in self.conn.execute(
            "SELECT * FROM %s ORDER BY %s" % (table, order))]

    def count(self, table):
        return self.conn.execute(
            "SELECT COUNT(*) FROM %s" % table).fetchone()[0]

    def test_the_cascade_really_does_remove_the_children(self):
        """Guards the premise of every test below."""
        self.assertEqual(2, self.count("participation_exception"))
        audit.delete(self.conn, "participation_plan", self.plan)
        self.assertEqual(0, self.count("participation_exception"))

    def test_undoing_a_delete_brings_the_cascaded_children_back(self):
        before = self.rows("participation_exception")
        self.assertEqual(2, len(before))

        removed = audit.delete(self.conn, "participation_plan", self.plan)
        self.assertEqual(0, self.count("participation_exception"))

        audit.undo(self.conn, removed)

        self.assertEqual(1, self.count("participation_plan"))
        self.assertEqual(
            before, self.rows("participation_exception"),
            "cascade-deleted children must come back field for field")
        self.assertEqual(
            [], self.conn.execute("PRAGMA foreign_key_check").fetchall())

    def test_the_delete_audit_row_records_the_children_it_took_with_it(self):
        """Even before any undo, the history must show the lost rows."""
        removed = audit.delete(self.conn, "participation_plan", self.plan)
        row = self.conn.execute(
            "SELECT * FROM audit_event WHERE id = ?", (removed,)).fetchone()
        payload = json.loads(row["cascade_json"])
        lost = payload["deleted"]
        self.assertEqual(
            ["participation_exception"] * 2, [r["table"] for r in lost])
        self.assertEqual(
            {"2026-10-21", "2026-10-24"}, {r["row"]["on_date"] for r in lost})
        self.assertEqual(["휴무", "휴무"], [r["row"]["note"] for r in lost])

    def test_a_delete_with_no_fallout_records_none(self):
        """cascade_json is not noise on every row - only where it applies."""
        vid, _ = audit.create(self.conn, "vendor", name="자식없는업체")
        removed = audit.delete(self.conn, "vendor", vid)
        self.assertIsNone(self.conn.execute(
            "SELECT cascade_json FROM audit_event WHERE id = ?",
            (removed,)).fetchone()[0])

    def test_undoing_a_deleted_event_restores_the_whole_subtree(self):
        """Two levels deep, plus three sibling child tables."""
        self.conn.execute(
            "INSERT INTO attachment (kind, display_name, target, event_id)"
            " VALUES ('archive','제출서류.zip','D:/z.zip',?)", (self.ev,))
        self.conn.execute(
            "INSERT INTO dday_pin (label, target_on, event_id)"
            " VALUES ('개막','2026-10-17',?)", (self.ev,))
        self.conn.execute(
            "INSERT INTO reminder (remind_at, message, event_id)"
            " VALUES ('2026-10-16T09:00:00Z','준비',?)", (self.ev,))
        snapshot = {t: self.rows(t) for t in (
            "event", "participation_plan", "participation_exception",
            "attachment", "dday_pin", "reminder")}

        removed = audit.delete(self.conn, "event", self.ev)
        for t in snapshot:
            self.assertEqual(0, self.count(t), "%s should have cascaded" % t)

        audit.undo(self.conn, removed)

        for t, expected in snapshot.items():
            self.assertEqual(expected, self.rows(t), "%s not restored" % t)
        self.assertEqual(
            [], self.conn.execute("PRAGMA foreign_key_check").fetchall())

    def test_undo_restores_a_link_that_ON_DELETE_SET_NULL_detached(self):
        si = self.conn.execute(
            "INSERT INTO schedule_item (title, on_date) VALUES ('설치','2026-10-17')"
        ).lastrowid
        wid = self.conn.execute(
            "INSERT INTO work_item (title, status, schedule_item_id)"
            " VALUES ('부스 배치','active',?)", (si,)).lastrowid

        removed = audit.delete(self.conn, "schedule_item", si)
        self.assertIsNone(self.conn.execute(
            "SELECT schedule_item_id FROM work_item WHERE id = ?",
            (wid,)).fetchone()[0])

        audit.undo(self.conn, removed)
        self.assertEqual(si, self.conn.execute(
            "SELECT schedule_item_id FROM work_item WHERE id = ?",
            (wid,)).fetchone()[0])

    def test_restoring_children_does_not_touch_the_append_only_history(self):
        before = self.conn.execute(
            "SELECT COUNT(*) FROM audit_event").fetchone()[0]
        removed = audit.delete(self.conn, "participation_plan", self.plan)
        audit.undo(self.conn, removed)
        self.assertEqual(before + 2, self.conn.execute(
            "SELECT COUNT(*) FROM audit_event").fetchone()[0])
        self.assertEqual(
            ["create", "delete", "undo"],
            [r["action"] for r in audit.history(
                self.conn, "participation_plan", self.plan)])

    def test_undoing_a_create_records_the_children_that_go_with_it(self):
        """The reverse direction: undo-of-create deletes, and that delete
        cascades too. The undo row must say so rather than lose it quietly."""
        undone = audit.undo(self.conn, self.plan_audit)
        self.assertEqual(0, self.count("participation_exception"))
        payload = json.loads(self.conn.execute(
            "SELECT cascade_json FROM audit_event WHERE id = ?",
            (undone,)).fetchone()[0])
        self.assertEqual(
            ["participation_exception"] * 2,
            [r["table"] for r in payload["deleted"]])


if __name__ == "__main__":
    unittest.main()
