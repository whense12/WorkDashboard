"""C2 - participation patterns, exceptions, and the separation of the two
kinds of edit (kernel MUST 3 / MUST 4)."""

import json
import sqlite3
import unittest

from _support import DbCase
from harness import audit, participation


class PlanFixture(DbCase):
    """Helpers only - deliberately holds no test methods, so subclasses do
    not silently re-run each other's cases against a different fixture."""

    def setUp(self):
        super().setUp()
        self.ev, self.vd = self.seed_event_vendor()

    def plan(self, pattern, detail=None, start="2026-10-17", end="2026-11-01"):
        return self.conn.execute(
            "INSERT INTO participation_plan"
            " (event_id, vendor_id, period_start, period_end, pattern, pattern_detail)"
            " VALUES (?,?,?,?,?,?)",
            (self.ev, self.vd, start, end, pattern,
             None if detail is None else json.dumps(detail)),
        ).lastrowid

class Patterns(PlanFixture):
    def test_daily(self):
        got = participation.resolve(self.conn, self.plan("daily"))
        self.assertEqual(16, len(got))
        self.assertEqual("2026-10-17", got[0])
        self.assertEqual("2026-11-01", got[-1])

    def test_weekdays(self):
        got = participation.resolve(self.conn, self.plan("weekdays"))
        self.assertEqual(
            ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23",
             "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"],
            got,
        )

    def test_weekends(self):
        got = participation.resolve(self.conn, self.plan("weekends"))
        self.assertEqual(
            ["2026-10-17", "2026-10-18", "2026-10-24",
             "2026-10-25", "2026-10-31", "2026-11-01"],
            got,
        )

    def test_selected_weekdays(self):
        # Tue(1) and Thu(3)
        got = participation.resolve(self.conn, self.plan("selected_weekdays", [1, 3]))
        self.assertEqual(
            ["2026-10-20", "2026-10-22", "2026-10-27", "2026-10-29"], got
        )

    def test_selected_dates(self):
        picked = ["2026-10-18", "2026-10-23", "2026-10-30"]
        got = participation.resolve(self.conn, self.plan("selected_dates", picked))
        self.assertEqual(picked, got)

    def test_selected_dates_outside_period_are_not_produced(self):
        got = participation.resolve(
            self.conn,
            self.plan("selected_dates", ["2026-10-18", "2026-12-25"]),
        )
        self.assertEqual(["2026-10-18"], got)

    def test_pattern_detail_shape_is_enforced_by_the_schema(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.plan("selected_weekdays")          # detail required
        with self.assertRaises(sqlite3.IntegrityError):
            self.plan("daily", [1, 2])              # detail forbidden
        with self.assertRaises(sqlite3.IntegrityError):
            self.plan("fortnightly")                # unknown pattern


class WorkedExampleFixture(PlanFixture):
    """period 2026-10-17~2026-11-01, weekends, EXCLUDE 10/24, INCLUDE 10/21.
    Helpers only."""

    EXPECTED = ["2026-10-17", "2026-10-18", "2026-10-21",
                "2026-10-25", "2026-10-31", "2026-11-01"]

    def setUp(self):
        super().setUp()
        self.plan_id = self.plan("weekends")
        self.conn.execute(
            "INSERT INTO participation_exception (plan_id, on_date, kind)"
            " VALUES (?,?,'exclude')", (self.plan_id, "2026-10-24"))
        self.conn.execute(
            "INSERT INTO participation_exception (plan_id, on_date, kind)"
            " VALUES (?,?,'include')", (self.plan_id, "2026-10-21"))

    def plan_row(self):
        return dict(self.conn.execute(
            "SELECT * FROM participation_plan WHERE id = ?", (self.plan_id,)
        ).fetchone())

    def exception_rows(self):
        return [dict(r) for r in self.conn.execute(
            "SELECT * FROM participation_exception WHERE plan_id = ? ORDER BY on_date",
            (self.plan_id,))]


class WorkedExample(WorkedExampleFixture):
    def test_exact_result(self):
        self.assertEqual(
            self.EXPECTED, participation.resolve(self.conn, self.plan_id)
        )

    def test_excluded_date_is_gone_and_included_date_is_present(self):
        got = participation.resolve(self.conn, self.plan_id)
        self.assertNotIn("2026-10-24", got)   # was a weekend, excluded
        self.assertIn("2026-10-21", got)      # was a Wednesday, included
        self.assertEqual(6, len(got))

    def test_one_verdict_per_date(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO participation_exception (plan_id, on_date, kind)"
                " VALUES (?,?,'include')", (self.plan_id, "2026-10-24"))

    def test_calendar_can_name_the_vendor_not_just_count_it(self):
        # kernel MUST 2 / NEVER 3
        self.assertEqual(
            ["고성한과"], participation.vendor_names_on(self.conn, "2026-10-21")
        )
        self.assertEqual([], participation.vendor_names_on(self.conn, "2026-10-24"))


class SeparateOperations(WorkedExampleFixture):
    """kernel MUST 4: single-date edit and whole-plan edit are DISTINCT
    operations. Neither may silently perform the other."""

    def test_single_date_exception_does_not_rewrite_the_plan(self):
        before = self.plan_row()
        audit.create(self.conn, "participation_exception",
                     plan_id=self.plan_id, on_date="2026-10-19", kind="include")
        self.assertEqual(before, self.plan_row())
        self.assertIn("2026-10-19", participation.resolve(self.conn, self.plan_id))

    def test_plan_edit_does_not_drop_existing_exceptions(self):
        before = self.exception_rows()
        self.assertEqual(2, len(before))
        audit.update(self.conn, "participation_plan", self.plan_id,
                     pattern="weekdays", period_end="2026-11-01")
        self.assertEqual(before, self.exception_rows())

    def test_plan_edit_keeps_the_exceptions_effective(self):
        audit.update(self.conn, "participation_plan", self.plan_id,
                     pattern="weekdays")
        got = participation.resolve(self.conn, self.plan_id)
        # weekdays minus nothing, plus include 10/21 (already a weekday),
        # and 10/24 exclude is a Saturday so it removes nothing now.
        self.assertIn("2026-10-21", got)
        self.assertNotIn("2026-10-24", got)
        # the exclusion row still exists and still applies if the pattern
        # ever produces that date again
        self.assertEqual(2, len(self.exception_rows()))
        audit.update(self.conn, "participation_plan", self.plan_id,
                     pattern="daily")
        got = participation.resolve(self.conn, self.plan_id)
        self.assertNotIn("2026-10-24", got)
        self.assertEqual(15, len(got))

    def test_the_two_edits_are_audited_against_different_entities(self):
        a1 = audit.create(self.conn, "participation_exception",
                          plan_id=self.plan_id, on_date="2026-10-19",
                          kind="include")[1]
        a2 = audit.update(self.conn, "participation_plan", self.plan_id,
                          pattern="daily")
        rows = {r["id"]: r for r in audit.history(self.conn)}
        self.assertEqual("participation_exception", rows[a1]["entity_table"])
        self.assertEqual("participation_plan", rows[a2]["entity_table"])


if __name__ == "__main__":
    unittest.main()
