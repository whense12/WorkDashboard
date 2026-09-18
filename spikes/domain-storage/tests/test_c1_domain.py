"""C1 - the minimum domain, and nothing more."""

import unittest

from _support import DbCase
from harness import db


class MinimumDomain(DbCase):
    def test_all_required_entities_exist(self):
        present = set(db.table_names(self.conn))
        for t in db.CORE_TABLES + db.SUPPORT_TABLES:
            self.assertIn(t, present, "required entity missing: %s" % t)

    def test_no_entity_beyond_the_required_list(self):
        """If this fails, someone added a domain concept nobody asked for."""
        present = set(db.table_names(self.conn))
        extra = present - set(db.DOMAIN_TABLES) - set(db.INFRA_TABLES)
        self.assertEqual(
            set(), extra,
            "extra table(s) beyond C1; a new entity is a product decision "
            "and must be reported as OPEN, not implemented: %r" % sorted(extra),
        )

    def test_only_infra_table_is_schema_version(self):
        self.assertEqual(("schema_version",), db.INFRA_TABLES)
        self.assertEqual(13, len(db.table_names(self.conn)))  # 12 domain + 1 infra

    def test_counts(self):
        self.assertEqual(7, len(db.CORE_TABLES))
        self.assertEqual(5, len(db.SUPPORT_TABLES))


if __name__ == "__main__":
    unittest.main()
