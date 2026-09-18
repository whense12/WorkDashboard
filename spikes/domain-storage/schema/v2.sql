-- schema v2 migration (applied on top of v1).
--
-- This is a TECHNICAL tightening only - it adds no entity, no column that
-- carries a product decision, and no behaviour change. It exists so the
-- C6 "v1 -> v2 migration simulation" exercises the real hazard: SQLite
-- cannot add a CHECK constraint with ALTER TABLE, so the table must be
-- rebuilt, and a rebuild is exactly where child rows get silently
-- orphaned if it is done carelessly.
--
-- Driven by harness.db.migrate_to_v2(), which wraps this file in the
-- documented 12-step procedure:
--     PRAGMA foreign_keys=OFF; BEGIN; <this file>;
--     PRAGMA foreign_key_check; COMMIT; PRAGMA foreign_keys=ON;

CREATE TABLE attachment_v2 (
    id               INTEGER PRIMARY KEY,
    -- the v2 tightening: attachment kinds become a closed set.
    -- 'archive' is its own kind so a ZIP is never conflated with a folder.
    kind             TEXT NOT NULL
                       CHECK (kind IN ('file','folder','archive','link')),
    display_name     TEXT NOT NULL,
    target           TEXT NOT NULL,
    byte_size        INTEGER,
    event_id         INTEGER REFERENCES event(id)         ON DELETE CASCADE,
    vendor_id        INTEGER REFERENCES vendor(id)        ON DELETE CASCADE,
    schedule_item_id INTEGER REFERENCES schedule_item(id) ON DELETE CASCADE,
    work_item_id     INTEGER REFERENCES work_item(id)     ON DELETE CASCADE,
    CHECK (
        ((event_id         IS NOT NULL)
       + (vendor_id        IS NOT NULL)
       + (schedule_item_id IS NOT NULL)
       + (work_item_id     IS NOT NULL)) = 1
    )
);

INSERT INTO attachment_v2
    (id, kind, display_name, target, byte_size,
     event_id, vendor_id, schedule_item_id, work_item_id)
SELECT
     id, kind, display_name, target, byte_size,
     event_id, vendor_id, schedule_item_id, work_item_id
FROM attachment;

DROP TABLE attachment;

ALTER TABLE attachment_v2 RENAME TO attachment;

CREATE INDEX idx_schedule_item_on_date        ON schedule_item(on_date);
CREATE INDEX idx_participation_exception_date ON participation_exception(plan_id, on_date);
CREATE INDEX idx_audit_event_entity           ON audit_event(entity_table, entity_id, id);
