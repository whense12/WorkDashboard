-- WorkDashboard / Spike C — domain + storage semantics
-- schema v1 (baseline). Technically looser than v2 on purpose so that the
-- v1 -> v2 migration simulation in C6 has something real to migrate.
--
-- SCOPE NOTE: the entity list here is exactly the list given in the task
-- (C1). No extra domain entity is introduced. `schema_version` is storage
-- infrastructure, not a domain entity.
--
-- Dates are TEXT 'YYYY-MM-DD'. Timestamps are TEXT ISO-8601.

-- ---------------------------------------------------------------- infra
CREATE TABLE schema_version (
    version    INTEGER NOT NULL,
    applied_at TEXT    NOT NULL
);

-- ---------------------------------------------------------------- core
CREATE TABLE event (
    id        INTEGER PRIMARY KEY,
    name      TEXT NOT NULL,
    starts_on TEXT,
    ends_on   TEXT,
    location  TEXT,
    notes     TEXT
);

CREATE TABLE vendor (
    id      INTEGER PRIMARY KEY,
    name    TEXT NOT NULL UNIQUE,
    contact TEXT,
    notes   TEXT
);

-- A vendor's participation plan inside one event: a recurrence pattern over
-- a period. Per-date deviations live in participation_exception, NEVER here
-- (kernel MUST 4: single-date edit and whole-plan edit are distinct).
CREATE TABLE participation_plan (
    id             INTEGER PRIMARY KEY,
    event_id       INTEGER NOT NULL REFERENCES event(id)  ON DELETE CASCADE,
    vendor_id      INTEGER NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
    period_start   TEXT NOT NULL,
    period_end     TEXT NOT NULL,
    pattern        TEXT NOT NULL
                     CHECK (pattern IN ('daily','weekdays','weekends',
                                        'selected_weekdays','selected_dates')),
    -- JSON array. weekday numbers (0=Mon..6=Sun) for selected_weekdays,
    -- ISO dates for selected_dates, NULL for the closed patterns.
    pattern_detail TEXT,
    CHECK (period_end >= period_start),
    CHECK (
        (pattern IN ('daily','weekdays','weekends')  AND pattern_detail IS NULL)
     OR (pattern IN ('selected_weekdays','selected_dates') AND pattern_detail IS NOT NULL)
    ),
    UNIQUE (event_id, vendor_id)
);

CREATE TABLE participation_exception (
    id      INTEGER PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES participation_plan(id) ON DELETE CASCADE,
    on_date TEXT NOT NULL,
    kind    TEXT NOT NULL CHECK (kind IN ('include','exclude')),
    note    TEXT,
    -- one verdict per date: an include/exclude conflict is impossible
    UNIQUE (plan_id, on_date)
);

-- A calendar entry. event_id / vendor_id are BOTH NULLABLE on purpose:
-- a plain office schedule must be storable with no event and no vendor
-- (kernel MUST 1). Forcing event_id NOT NULL would be a product failure.
CREATE TABLE schedule_item (
    id        INTEGER PRIMARY KEY,
    title     TEXT NOT NULL,
    on_date   TEXT NOT NULL,
    starts_at TEXT,
    ends_at   TEXT,
    event_id  INTEGER REFERENCES event(id)  ON DELETE RESTRICT,
    vendor_id INTEGER REFERENCES vendor(id) ON DELETE RESTRICT,
    notes     TEXT
);

CREATE TABLE work_item (
    id               INTEGER PRIMARY KEY,
    title            TEXT NOT NULL,
    -- kernel MUST 7: future / current / completed must all be visible
    status           TEXT NOT NULL CHECK (status IN ('future','active','done')),
    due_on           TEXT,
    event_id         INTEGER REFERENCES event(id)         ON DELETE RESTRICT,
    vendor_id        INTEGER REFERENCES vendor(id)        ON DELETE RESTRICT,
    schedule_item_id INTEGER REFERENCES schedule_item(id) ON DELETE SET NULL,
    notes            TEXT
);

-- METADATA ONLY (C5). No bytes are stored and no managed-copy vs
-- original-link decision is encoded here - that is left OPEN.
CREATE TABLE attachment (
    id               INTEGER PRIMARY KEY,
    kind             TEXT NOT NULL,          -- v2 tightens this with a CHECK
    display_name     TEXT NOT NULL,
    target           TEXT NOT NULL,          -- path or URL, as recorded
    byte_size        INTEGER,
    event_id         INTEGER REFERENCES event(id)         ON DELETE CASCADE,
    vendor_id        INTEGER REFERENCES vendor(id)        ON DELETE CASCADE,
    schedule_item_id INTEGER REFERENCES schedule_item(id) ON DELETE CASCADE,
    work_item_id     INTEGER REFERENCES work_item(id)     ON DELETE CASCADE,
    -- an attachment always keeps exactly one owner relation
    CHECK (
        ((event_id         IS NOT NULL)
       + (vendor_id        IS NOT NULL)
       + (schedule_item_id IS NOT NULL)
       + (work_item_id     IS NOT NULL)) = 1
    )
);

-- ---------------------------------------------------------------- support
CREATE TABLE dday_pin (
    id           INTEGER PRIMARY KEY,
    label        TEXT NOT NULL,
    target_on    TEXT NOT NULL,
    slot         INTEGER,
    event_id     INTEGER REFERENCES event(id)     ON DELETE CASCADE,
    work_item_id INTEGER REFERENCES work_item(id) ON DELETE CASCADE
);

CREATE TABLE reminder (
    id               INTEGER PRIMARY KEY,
    remind_at        TEXT NOT NULL,
    message          TEXT,
    delivered        INTEGER NOT NULL DEFAULT 0 CHECK (delivered IN (0,1)),
    event_id         INTEGER REFERENCES event(id)         ON DELETE CASCADE,
    schedule_item_id INTEGER REFERENCES schedule_item(id) ON DELETE CASCADE,
    work_item_id     INTEGER REFERENCES work_item(id)     ON DELETE CASCADE
);

-- Append-only change log. entity_id is deliberately NOT a foreign key:
-- history must survive deletion of the entity it describes, and undo must
-- never be able to cascade a row out of here (C4).
CREATE TABLE audit_event (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at      TEXT NOT NULL,
    actor            TEXT NOT NULL,
    entity_table     TEXT NOT NULL,
    entity_id        INTEGER NOT NULL,
    action           TEXT NOT NULL
                       CHECK (action IN ('create','update','delete','undo')),
    before_json      TEXT,
    after_json       TEXT,
    undo_of_audit_id INTEGER REFERENCES audit_event(id)
);

CREATE TRIGGER audit_event_is_append_only_update
BEFORE UPDATE ON audit_event
BEGIN
    SELECT RAISE(ABORT, 'audit_event is append-only: UPDATE rejected');
END;

CREATE TRIGGER audit_event_is_append_only_delete
BEFORE DELETE ON audit_event
BEGIN
    SELECT RAISE(ABORT, 'audit_event is append-only: DELETE rejected');
END;

CREATE TABLE layout_profile (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    surface     TEXT NOT NULL,
    layout_json TEXT NOT NULL
);

CREATE TABLE template (
    id        INTEGER PRIMARY KEY,
    name      TEXT NOT NULL,
    kind      TEXT NOT NULL CHECK (kind IN ('work_item','vendor','procedure')),
    body_json TEXT NOT NULL,
    UNIQUE (name, kind)
);

INSERT INTO schema_version (version, applied_at) VALUES (1, '1970-01-01T00:00:00Z');
