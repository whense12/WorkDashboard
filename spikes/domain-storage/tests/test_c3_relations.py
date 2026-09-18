"""C3 - what may link to what. Kernel MUST 1 and MUST 6."""

import sqlite3
import unittest

from _support import DbCase


class ScheduleItemLinkage(DbCase):
    def setUp(self):
        super().setUp()
        self.ev, self.vd = self.seed_event_vendor()

    def add(self, title, **links):
        return self.conn.execute(
            "INSERT INTO schedule_item (title, on_date, event_id, vendor_id)"
            " VALUES (?,?,?,?)",
            (title, "2026-10-20", links.get("event_id"), links.get("vendor_id")),
        ).lastrowid

    def row(self, sid):
        return self.conn.execute(
            "SELECT * FROM schedule_item WHERE id = ?", (sid,)).fetchone()

    def test_a_schedule_item_can_exist_alone(self):
        """A plain office schedule. THE central non-negotiable: if this
        raises, the product has been broken (kernel MUST 1)."""
        sid = self.add("과장님 결재 대기")
        r = self.row(sid)
        self.assertIsNone(r["event_id"])
        self.assertIsNone(r["vendor_id"])

    def test_a_general_office_schedule_is_not_forced_to_have_an_event(self):
        cols = {c["name"]: c for c in self.conn.execute(
            "PRAGMA table_info(schedule_item)")}
        self.assertEqual(
            0, cols["event_id"]["notnull"],
            "schedule_item.event_id is NOT NULL - general office schedules "
            "would be forced under an Event. That is a FAIL.")
        self.assertEqual(0, cols["vendor_id"]["notnull"])

    def test_link_to_event_only(self):
        r = self.row(self.add("행사장 설치", event_id=self.ev))
        self.assertEqual(self.ev, r["event_id"])
        self.assertIsNone(r["vendor_id"])

    def test_link_to_vendor_only(self):
        r = self.row(self.add("업체 방문 상담", vendor_id=self.vd))
        self.assertIsNone(r["event_id"])
        self.assertEqual(self.vd, r["vendor_id"])

    def test_link_to_both(self):
        r = self.row(self.add("부스 배정", event_id=self.ev, vendor_id=self.vd))
        self.assertEqual(self.ev, r["event_id"])
        self.assertEqual(self.vd, r["vendor_id"])

    def test_all_four_shapes_coexist_in_one_table(self):
        """kernel MUST 1: one system, not two."""
        self.add("혼자")
        self.add("행사", event_id=self.ev)
        self.add("업체", vendor_id=self.vd)
        self.add("둘다", event_id=self.ev, vendor_id=self.vd)
        self.assertEqual(4, self.conn.execute(
            "SELECT COUNT(*) FROM schedule_item").fetchone()[0])


class WorkItemLinkage(DbCase):
    def setUp(self):
        super().setUp()
        self.ev, self.vd = self.seed_event_vendor()
        self.sid = self.conn.execute(
            "INSERT INTO schedule_item (title, on_date) VALUES ('점검','2026-10-20')"
        ).lastrowid

    def test_work_item_links_only_to_what_it_needs(self):
        for links in (
            {},
            {"event_id": self.ev},
            {"vendor_id": self.vd},
            {"schedule_item_id": self.sid},
            {"event_id": self.ev, "vendor_id": self.vd,
             "schedule_item_id": self.sid},
        ):
            cols = ["title", "status"] + list(links)
            vals = ["업무", "future"] + list(links.values())
            self.conn.execute(
                "INSERT INTO work_item (%s) VALUES (%s)"
                % (",".join(cols), ",".join("?" * len(cols))), vals)
        self.assertEqual(5, self.conn.execute(
            "SELECT COUNT(*) FROM work_item").fetchone()[0])

    def test_future_current_and_completed_are_all_representable(self):
        """kernel MUST 7."""
        for st in ("future", "active", "done"):
            self.conn.execute(
                "INSERT INTO work_item (title, status) VALUES (?,?)", (st, st))
        self.assertEqual(
            ["active", "done", "future"],
            [r[0] for r in self.conn.execute(
                "SELECT DISTINCT status FROM work_item ORDER BY status")],
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO work_item (title, status) VALUES ('x','maybe')")


class AttachmentOwnership(DbCase):
    def setUp(self):
        super().setUp()
        self.ev, self.vd = self.seed_event_vendor()
        self.sid = self.conn.execute(
            "INSERT INTO schedule_item (title, on_date) VALUES ('점검','2026-10-20')"
        ).lastrowid
        self.wid = self.conn.execute(
            "INSERT INTO work_item (title, status) VALUES ('보고','active')"
        ).lastrowid

    def owner_cols(self):
        return ("event_id", "vendor_id", "schedule_item_id", "work_item_id")

    def test_attachment_keeps_exactly_one_owner(self):
        for col, val in zip(self.owner_cols(),
                            (self.ev, self.vd, self.sid, self.wid)):
            aid = self.conn.execute(
                "INSERT INTO attachment (kind, display_name, target, %s)"
                " VALUES ('file','계획서','C:/x.docx',?)" % col, (val,)).lastrowid
            row = self.conn.execute(
                "SELECT * FROM attachment WHERE id = ?", (aid,)).fetchone()
            owners = [c for c in self.owner_cols() if row[c] is not None]
            self.assertEqual([col], owners)

    def test_attachment_without_an_owner_is_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO attachment (kind, display_name, target)"
                " VALUES ('file','떠돌이','C:/x.docx')")

    def test_attachment_with_two_owners_is_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO attachment (kind, display_name, target,"
                " event_id, vendor_id) VALUES ('file','양다리','C:/x.docx',?,?)",
                (self.ev, self.vd))


if __name__ == "__main__":
    unittest.main()
