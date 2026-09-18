-- TEST FIXTURE ONLY. Not a schema version, never run by the product path.
--
-- This is what a CARELESS SQLite table rebuild looks like. The product's
-- v2.sql rebuilds `attachment`, which nothing references, so it cannot
-- orphan anything. This fixture rebuilds `schedule_item`, which attachment /
-- work_item / reminder DO reference, and it loses a row on the way (a
-- mistyped filter in the copy step - the classic form of the bug).
--
-- Because harness.db.migrate_to_v2() runs a rebuild with foreign_keys = OFF,
-- SQLite raises nothing at all here. The children are simply left pointing
-- at a parent that no longer exists. Only PRAGMA foreign_key_check notices.
-- This fixture exists so that gate is actually EXECUTED by the suite instead
-- of being asserted about.

CREATE TABLE schedule_item_v2 (
    id        INTEGER PRIMARY KEY,
    title     TEXT NOT NULL,
    on_date   TEXT NOT NULL,
    starts_at TEXT,
    ends_at   TEXT,
    event_id  INTEGER REFERENCES event(id)  ON DELETE RESTRICT,
    vendor_id INTEGER REFERENCES vendor(id) ON DELETE RESTRICT,
    notes     TEXT
);

-- the careless part: this filter was meant to skip nothing.
INSERT INTO schedule_item_v2
    (id, title, on_date, starts_at, ends_at, event_id, vendor_id, notes)
SELECT
     id, title, on_date, starts_at, ends_at, event_id, vendor_id, notes
FROM schedule_item
WHERE notes IS NOT NULL;

DROP TABLE schedule_item;

ALTER TABLE schedule_item_v2 RENAME TO schedule_item;
