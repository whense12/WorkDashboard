"""Shared fixtures. No UI framework, stdlib unittest only."""

from __future__ import annotations

import os
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from harness import db  # noqa: E402


class DbCase(unittest.TestCase):
    """Each test gets its own on-disk database (WAL needs a real file)."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = os.path.join(self.tmp.name, "spike.db")
        self.conn = db.init_current(self.path)
        self.addCleanup(self.conn.close)

    def path_for(self, name):
        return os.path.join(self.tmp.name, name)

    def seed_event_vendor(self):
        ev = self.conn.execute(
            "INSERT INTO event (name, starts_on, ends_on) VALUES"
            " ('가을 농특산물 대축제','2026-10-17','2026-11-01')"
        ).lastrowid
        vd = self.conn.execute(
            "INSERT INTO vendor (name) VALUES ('고성한과')"
        ).lastrowid
        return ev, vd
