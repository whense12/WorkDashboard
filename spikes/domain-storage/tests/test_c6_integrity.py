"""C6 - SQLite integrity: foreign keys, migration, rollback, orphans, backup."""

import os
import pathlib
import sqlite3
import unittest

from _support import DbCase
from harness import db, snapshot

# A deliberately careless rebuild, used to prove the migration's
# foreign_key_check gate actually fires. See the file's own header.
CARELESS_REBUILD = str(
    pathlib.Path(__file__).resolve().parent / "careless_rebuild.sql")


# --------------------------------------------------------------- foreign keys
class ForeignKeys(DbCase):
    def test_pragma_is_actually_on(self):
        self.assertEqual(1, self.conn.execute("PRAGMA foreign_keys").fetchone()[0])

    def test_a_violation_is_really_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO schedule_item (title, on_date, event_id)"
                " VALUES ('유령','2026-10-20', 99999)")

    def test_the_same_insert_would_slip_through_with_the_pragma_off(self):
        """Proves the rejection above comes from the pragma, not luck -
        which is why connect() sets it on EVERY connection."""
        loose = db.connect(self.path, foreign_keys=False)
        self.addCleanup(loose.close)
        loose.execute(
            "INSERT INTO schedule_item (title, on_date, event_id)"
            " VALUES ('유령','2026-10-20', 99999)")
        self.assertEqual(
            1, len(loose.execute("PRAGMA foreign_key_check").fetchall()))
        loose.execute("DELETE FROM schedule_item")

    def test_exception_cannot_point_at_a_missing_plan(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO participation_exception (plan_id, on_date, kind)"
                " VALUES (4242,'2026-10-24','exclude')")


# ----------------------------------------------------------------- migration
class MigrationV1toV2(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = os.path.join(self.tmp.name, "mig.db")
        self.conn = db.init_v1(self.path)
        self.addCleanup(self.conn.close)

    def seed(self, attachment_kind="archive"):
        ev = self.conn.execute(
            "INSERT INTO event (name) VALUES ('축제')").lastrowid
        vd = self.conn.execute(
            "INSERT INTO vendor (name) VALUES ('업체')").lastrowid
        si = self.conn.execute(
            "INSERT INTO schedule_item (title, on_date, event_id)"
            " VALUES ('설치','2026-10-17',?)", (ev,)).lastrowid
        for i in range(3):
            self.conn.execute(
                "INSERT INTO attachment (kind, display_name, target,"
                " schedule_item_id) VALUES (?,?,?,?)",
                (attachment_kind, "첨부%d" % i, "D:/a%d" % i, si))
        return ev, vd, si

    def test_starts_at_v1(self):
        self.assertEqual(1, db.schema_version(self.conn))

    def test_v1_does_not_yet_enforce_the_attachment_kind_set(self):
        self.seed(attachment_kind="zipfolder")   # accepted at v1
        self.assertEqual(3, self.conn.execute(
            "SELECT COUNT(*) FROM attachment").fetchone()[0])

    def test_migration_reaches_v2_preserves_rows_and_orphans_nothing(self):
        ev, vd, si = self.seed()
        before = [tuple(r) for r in self.conn.execute(
            "SELECT * FROM attachment ORDER BY id")]

        violations = db.migrate_to_v2(self.conn)

        self.assertEqual([], violations)
        self.assertEqual(2, db.schema_version(self.conn))
        after = [tuple(r) for r in self.conn.execute(
            "SELECT * FROM attachment ORDER BY id")]
        self.assertEqual(before, after)
        # the rebuild must not have detached the children from their owner
        self.assertEqual(
            [si, si, si],
            [r[0] for r in self.conn.execute(
                "SELECT schedule_item_id FROM attachment ORDER BY id")])
        self.assertEqual(
            [], self.conn.execute("PRAGMA foreign_key_check").fetchall())
        self.assertEqual(
            "ok", self.conn.execute("PRAGMA integrity_check").fetchone()[0])

    def test_v2_enforces_the_new_constraint(self):
        ev, vd, si = self.seed()
        db.migrate_to_v2(self.conn)
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO attachment (kind, display_name, target,"
                " schedule_item_id) VALUES ('zipfolder','x','D:/x',?)", (si,))

    def test_migration_of_dirty_data_aborts_and_leaves_v1_intact(self):
        """A row v2 would reject must stop the migration loudly - not be
        dropped on the floor."""
        self.seed(attachment_kind="zipfolder")
        with self.assertRaises(sqlite3.IntegrityError):
            db.migrate_to_v2(self.conn)
        self.assertEqual(1, db.schema_version(self.conn))
        self.assertEqual(3, self.conn.execute(
            "SELECT COUNT(*) FROM attachment").fetchone()[0])
        self.assertNotIn("attachment_v2", db.table_names(self.conn))
        self.assertEqual(1, self.conn.execute("PRAGMA foreign_keys").fetchone()[0])

    def test_migration_refuses_to_run_twice(self):
        db.migrate_to_v2(self.conn)
        with self.assertRaises(RuntimeError):
            db.migrate_to_v2(self.conn)


# ------------------------------------------- the foreign_key_check gate itself
class RebuildOrphanGate(unittest.TestCase):
    """The rebuild step runs with foreign_keys OFF. That is the whole reason
    the 12-step procedure ends with PRAGMA foreign_key_check: nothing else
    will notice a rebuild that detaches child rows. These tests EXECUTE that
    gate rather than asserting that an empty result is empty."""

    def setUp(self):
        import tempfile
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = os.path.join(self.tmp.name, "gate.db")
        self.conn = db.init_v1(self.path)
        self.addCleanup(self.conn.close)
        self.ev = self.conn.execute(
            "INSERT INTO event (name) VALUES ('축제')").lastrowid
        # notes IS NULL, so the careless script's filter drops this row
        self.si = self.conn.execute(
            "INSERT INTO schedule_item (title, on_date, event_id)"
            " VALUES ('설치','2026-10-17',?)", (self.ev,)).lastrowid
        for i in range(3):
            self.conn.execute(
                "INSERT INTO attachment (kind, display_name, target,"
                " schedule_item_id) VALUES ('file',?,?,?)",
                ("첨부%d" % i, "D:/a%d" % i, self.si))
        self.conn.execute(
            "INSERT INTO work_item (title, status, schedule_item_id)"
            " VALUES ('부스 배치','active',?)", (self.si,))

    def count(self, table):
        return self.conn.execute(
            "SELECT COUNT(*) FROM %s" % table).fetchone()[0]

    def test_the_careless_rebuild_really_does_orphan_rows_when_unguarded(self):
        """Premise check: without the gate this damage commits silently.

        Run the same script by hand, with foreign_keys OFF and no gate, and
        confirm SQLite raises nothing while leaving 4 dangling children.
        """
        self.conn.execute("PRAGMA foreign_keys = OFF")
        self.conn.execute("BEGIN")
        db._run_script(self.conn, CARELESS_REBUILD)   # raises nothing at all
        # measured INSIDE the transaction - the rollback below undoes it
        surviving_parents = self.count("schedule_item")
        violations = self.conn.execute("PRAGMA foreign_key_check").fetchall()
        self.conn.execute("ROLLBACK")
        self.conn.execute("PRAGMA foreign_keys = ON")

        self.assertEqual(0, surviving_parents, "the parent row was dropped")
        self.assertEqual(1, self.count("schedule_item"), "rollback undid it")
        self.assertEqual(
            4, len(violations),
            "expected 3 attachment + 1 work_item rows left dangling")
        self.assertEqual(
            {"attachment", "work_item"}, {r[0] for r in violations})

    def test_the_gate_aborts_a_rebuild_that_would_orphan_children(self):
        with self.assertRaises(RuntimeError) as ctx:
            db.migrate_to_v2(self.conn, script=CARELESS_REBUILD)
        self.assertIn("orphan", str(ctx.exception))

    def test_an_aborted_rebuild_leaves_a_whole_usable_v1_database(self):
        with self.assertRaises(RuntimeError):
            db.migrate_to_v2(self.conn, script=CARELESS_REBUILD)

        self.assertEqual(1, db.schema_version(self.conn))
        self.assertEqual(1, self.count("schedule_item"))
        self.assertEqual(3, self.count("attachment"))
        self.assertEqual(1, self.count("work_item"))
        self.assertNotIn("schedule_item_v2", db.table_names(self.conn))
        self.assertEqual(
            [], self.conn.execute("PRAGMA foreign_key_check").fetchall())
        self.assertEqual(
            1, self.conn.execute("PRAGMA foreign_keys").fetchone()[0])

    def test_the_gate_also_catches_an_orphan_that_was_already_in_v1(self):
        """A v1 file whose FK pragma was off at some point carries bad rows.
        The migration must refuse to promote them into v2, not launder them."""
        loose = db.connect(self.path, foreign_keys=False)
        self.addCleanup(loose.close)
        loose.execute(
            "INSERT INTO attachment (kind, display_name, target,"
            " schedule_item_id) VALUES ('file','고아','D:/o',9999)")

        with self.assertRaises(RuntimeError) as ctx:
            db.migrate_to_v2(self.conn)
        self.assertIn("orphan", str(ctx.exception))
        self.assertEqual(1, db.schema_version(self.conn))
        self.assertNotIn("attachment_v2", db.table_names(self.conn))


# ------------------------------------------------------- rollback / orphans
class Rollback(DbCase):
    def test_rollback_undoes_every_statement_in_the_transaction(self):
        self.conn.execute("BEGIN")
        self.conn.execute("INSERT INTO vendor (name) VALUES ('가')")
        self.conn.execute("INSERT INTO vendor (name) VALUES ('나')")
        self.assertEqual(2, self.conn.execute(
            "SELECT COUNT(*) FROM vendor").fetchone()[0])
        self.conn.execute("ROLLBACK")
        self.assertEqual(0, self.conn.execute(
            "SELECT COUNT(*) FROM vendor").fetchone()[0])

    def test_a_failure_mid_transaction_leaves_nothing_behind(self):
        self.conn.execute("BEGIN")
        try:
            self.conn.execute("INSERT INTO vendor (name) VALUES ('가')")
            self.conn.execute(
                "INSERT INTO schedule_item (title, on_date, event_id)"
                " VALUES ('x','2026-10-20', 99999)")   # FK violation
            self.fail("expected IntegrityError")
        except sqlite3.IntegrityError:
            self.conn.execute("ROLLBACK")
        self.assertEqual(0, self.conn.execute(
            "SELECT COUNT(*) FROM vendor").fetchone()[0])
        self.assertEqual(0, self.conn.execute(
            "SELECT COUNT(*) FROM schedule_item").fetchone()[0])


class OrphanPrevention(DbCase):
    def setUp(self):
        super().setUp()
        self.ev, self.vd = self.seed_event_vendor()
        self.plan = self.conn.execute(
            "INSERT INTO participation_plan (event_id, vendor_id, period_start,"
            " period_end, pattern) VALUES (?,?,'2026-10-17','2026-11-01','weekends')",
            (self.ev, self.vd)).lastrowid
        for d in ("2026-10-24", "2026-10-21"):
            self.conn.execute(
                "INSERT INTO participation_exception (plan_id, on_date, kind)"
                " VALUES (?,?,'exclude')", (self.plan, d))

    def test_deleting_a_plan_takes_its_exceptions_with_it(self):
        self.conn.execute("DELETE FROM participation_plan WHERE id = ?", (self.plan,))
        self.assertEqual(0, self.conn.execute(
            "SELECT COUNT(*) FROM participation_exception").fetchone()[0])
        self.assertEqual([], self.conn.execute("PRAGMA foreign_key_check").fetchall())

    def test_deleting_an_event_that_a_schedule_item_points_at_is_refused(self):
        """RESTRICT, so a linked office schedule is never silently destroyed
        or silently detached. Whether the product should instead offer to
        unlink is OPEN - see NOTES.md OPEN-3."""
        self.conn.execute(
            "INSERT INTO schedule_item (title, on_date, event_id)"
            " VALUES ('설치','2026-10-17',?)", (self.ev,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute("DELETE FROM event WHERE id = ?", (self.ev,))
        self.assertEqual(1, self.conn.execute(
            "SELECT COUNT(*) FROM schedule_item").fetchone()[0])

    def test_no_orphan_survives_any_of_these_operations(self):
        self.conn.execute("DELETE FROM participation_exception")
        self.conn.execute("DELETE FROM participation_plan")
        self.conn.execute("DELETE FROM event WHERE id = ?", (self.ev,))
        self.conn.execute("DELETE FROM vendor WHERE id = ?", (self.vd,))
        self.assertEqual([], self.conn.execute("PRAGMA foreign_key_check").fetchall())


# -------------------------------------------------------------- backup
class BackupAndRestore(DbCase):
    SEED = 5
    LATE = 7

    def setUp(self):
        super().setUp()
        for i in range(self.SEED):
            self.conn.execute("INSERT INTO vendor (name) VALUES (?)", ("seed%d" % i,))
        # flush everything written so far into the main database file
        self.conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        # and keep the next commits in the -wal sidecar
        self.conn.execute("PRAGMA wal_autocheckpoint = 0")
        for i in range(self.LATE):
            self.conn.execute("INSERT INTO vendor (name) VALUES (?)", ("late%d" % i,))

    def total(self):
        return self.conn.execute("SELECT COUNT(*) FROM vendor").fetchone()[0]

    def test_journal_mode_is_wal(self):
        self.assertEqual(
            "wal", self.conn.execute("PRAGMA journal_mode").fetchone()[0].lower())

    def test_naive_file_copy_of_an_open_database_is_SILENTLY_STALE(self):
        """The counter-example. No error is raised; the data is simply old."""
        self.assertEqual(self.SEED + self.LATE, self.total())
        naive = snapshot.naive_file_copy(self.path, self.path_for("naive.db"))
        report = snapshot.inspect(naive)
        self.assertEqual(
            self.SEED, report["row_counts"]["vendor"],
            "expected the naive copy to miss the uncheckpointed commits")
        self.assertNotEqual(snapshot.digest(self.conn), report["digest"])

    def test_online_backup_api_snapshot_is_complete_and_consistent(self):
        backup = snapshot.online_backup(self.conn, self.path_for("backup.db"))
        report = snapshot.inspect(backup)
        self.assertEqual("ok", report["integrity_check"])
        self.assertEqual([], report["foreign_key_check"])
        self.assertEqual(2, report["schema_version"])
        self.assertEqual(self.SEED + self.LATE, report["row_counts"]["vendor"])
        self.assertEqual(snapshot.digest(self.conn), report["digest"])

    def test_backup_beats_naive_copy_on_the_same_database_at_the_same_moment(self):
        naive = snapshot.inspect(
            snapshot.naive_file_copy(self.path, self.path_for("n2.db")))
        backup = snapshot.inspect(
            snapshot.online_backup(self.conn, self.path_for("b2.db")))
        self.assertLess(naive["row_counts"]["vendor"], backup["row_counts"]["vendor"])
        self.assertEqual(snapshot.digest(self.conn), backup["digest"])

    def test_restore_round_trip_is_byte_for_byte_consistent(self):
        backup = snapshot.online_backup(self.conn, self.path_for("b3.db"))
        restored = snapshot.restore(backup, self.path_for("restored.db"))
        report = snapshot.inspect(restored)
        self.assertEqual("ok", report["integrity_check"])
        self.assertEqual([], report["foreign_key_check"])
        self.assertEqual(snapshot.digest(self.conn), report["digest"])
        self.assertEqual(snapshot.row_counts(self.conn), report["row_counts"])

    def test_backup_taken_during_an_uncommitted_write_excludes_that_write(self):
        """A snapshot must be a COMMITTED snapshot, never a half-written one."""
        writer = db.connect(self.path)
        self.addCleanup(writer.close)
        writer.execute("BEGIN IMMEDIATE")
        writer.execute("INSERT INTO vendor (name) VALUES ('uncommitted')")

        backup = snapshot.online_backup(self.conn, self.path_for("b4.db"))
        report = snapshot.inspect(backup)

        writer.execute("ROLLBACK")
        self.assertEqual("ok", report["integrity_check"])
        self.assertEqual([], report["foreign_key_check"])
        self.assertEqual(self.SEED + self.LATE, report["row_counts"]["vendor"])
        self.assertNotIn(
            ("uncommitted",),
            [tuple(r) for r in sqlite3.connect(str(backup)).execute(
                "SELECT name FROM vendor")])

    def test_restored_database_is_usable_not_just_readable(self):
        backup = snapshot.online_backup(self.conn, self.path_for("b5.db"))
        restored = snapshot.restore(backup, self.path_for("r5.db"))
        conn = db.connect(restored)
        self.addCleanup(conn.close)
        ev = conn.execute("INSERT INTO event (name) VALUES ('복구후')").lastrowid
        conn.execute(
            "INSERT INTO schedule_item (title, on_date, event_id)"
            " VALUES ('확인','2026-10-20',?)", (ev,))
        with self.assertRaises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO schedule_item (title, on_date, event_id)"
                " VALUES ('유령','2026-10-20', 99999)")
        self.assertEqual([], conn.execute("PRAGMA foreign_key_check").fetchall())


if __name__ == "__main__":
    unittest.main()
