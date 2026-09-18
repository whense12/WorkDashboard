"""C5 - attachments are METADATA ONLY, and an archive is not a folder.
Kernel MUST 8."""

import sqlite3
import unittest

from _support import DbCase
from harness import db

KINDS = ("file", "folder", "archive", "link")


class AttachmentMetadata(DbCase):
    def setUp(self):
        super().setUp()
        self.ev, _ = self.seed_event_vendor()

    def add(self, kind, name, target, size=None):
        return self.conn.execute(
            "INSERT INTO attachment (kind, display_name, target, byte_size,"
            " event_id) VALUES (?,?,?,?,?)", (kind, name, target, size, self.ev)
        ).lastrowid

    def test_all_four_kinds_are_storable(self):
        self.add("file", "추진계획.hwpx", r"D:\행사\추진계획.hwpx", 40960)
        self.add("folder", "행사사진", r"D:\행사\사진")
        self.add("archive", "제출서류.zip", r"D:\행사\제출서류.zip", 1048576)
        self.add("link", "행사 공지", "https://example.invalid/notice")
        self.assertEqual(
            sorted(KINDS),
            [r[0] for r in self.conn.execute(
                "SELECT DISTINCT kind FROM attachment ORDER BY kind")])

    def test_archive_is_distinguishable_from_folder(self):
        """A ZIP and a directory must never collapse into one concept."""
        folder = self.add("folder", "제출서류", r"D:\행사\제출서류")
        archive = self.add("archive", "제출서류.zip", r"D:\행사\제출서류.zip")
        folders = [r["id"] for r in self.conn.execute(
            "SELECT id FROM attachment WHERE kind = 'folder'")]
        archives = [r["id"] for r in self.conn.execute(
            "SELECT id FROM attachment WHERE kind = 'archive'")]
        self.assertEqual([folder], folders)
        self.assertEqual([archive], archives)
        self.assertNotIn(archive, folders)

    def test_unknown_kind_is_rejected_at_v2(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.add("zipfolder", "애매", r"D:\x")

    def test_no_column_decides_managed_copy_vs_original_link(self):
        """C5 says leave that OPEN. Storage must therefore NOT encode it -
        if a column like storage_mode/copied/managed appears here, a product
        decision was made without authority."""
        cols = {c["name"] for c in self.conn.execute(
            "PRAGMA table_info(attachment)")}
        forbidden = {"storage_mode", "managed", "is_copy", "copied_path",
                     "copy_policy", "original_path", "cached_path"}
        self.assertEqual(set(), cols & forbidden)

    def test_metadata_only_no_blob_column(self):
        types = {c["name"]: (c["type"] or "").upper() for c in self.conn.execute(
            "PRAGMA table_info(attachment)")}
        self.assertNotIn("BLOB", set(types.values()))
        self.assertEqual(
            {"id", "kind", "display_name", "target", "byte_size",
             "event_id", "vendor_id", "schedule_item_id", "work_item_id"},
            set(types))

    def test_attachment_is_removed_with_its_owner_never_orphaned(self):
        self.add("archive", "제출서류.zip", r"D:\행사\제출서류.zip")
        self.conn.execute("DELETE FROM event WHERE id = ?", (self.ev,))
        self.assertEqual(0, self.conn.execute(
            "SELECT COUNT(*) FROM attachment").fetchone()[0])
        self.assertEqual([], self.conn.execute("PRAGMA foreign_key_check").fetchall())


if __name__ == "__main__":
    unittest.main()
