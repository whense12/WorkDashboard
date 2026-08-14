# AGENTS.md — Work Calendar Helper

## Read this first

Before changing code, **read `CODEX_IMPLEMENTATION_BRIEF.md` in full**. It is the product/UX contract for this repository.

Do not infer missing product requirements from generic dashboard conventions. This product has already gone through several rejected UI directions. The repository brief records what the user explicitly wants and what must not be reintroduced.

## Product mission

Build a low-friction Windows-first calendar dashboard for a public-sector office worker who manages vendor/company-specific work schedules and procedural tasks.

The app should reduce cognitive load. **Using the app must not become another job.**

The primary question the main screen must answer immediately is:

> “Which vendor has what coming up, and when?”

## Non-negotiable UI contract

1. Main screen = **left upcoming D-day vendor cards + right monthly calendar**.
2. Do not add KPI cards, progress percentages, analytics, charts, status dashboards, “external waiting”, “within 7 days”, or other invented management states.
3. The calendar event text must show **`vendor name · actual schedule/task name`**, not `D-?`.
4. D-day belongs in the **left vendor cards and detail surfaces**, not inside the calendar event label.
5. **Today must be visually obvious** in the calendar using a strong but restrained marker.
6. The calendar body must be vertically scrollable; do not compress week rows until text becomes unreadable.
7. Clicking an **empty date cell** must open “Add schedule” with that date already selected.
8. Clicking a D-day card or calendar event must open a **detail dialog/popover**, not navigate to a new page.
9. Detail must show:
   - vendor and work/project context,
   - selected schedule/task and date,
   - work-log entry area,
   - file attachments,
   - **all procedure steps: completed, current, and future**, in order.
10. Completing the current procedure step via `OK` must activate the next step and calculate its date according to the configured rule.
11. D-day horizon must support finite presets, custom days, and **unlimited/all**.
12. Vendor templates/master data and work/procedure templates must be user-editable.
13. A work instantiated from a template must own a **snapshot** of its procedure steps. Later template edits must not silently rewrite active/historical work.
14. The desktop helper window must remain minimal: vendor, nearest task, date, D-day. No dashboard clutter.
15. Prefer fewer controls, stable placement, and progressive disclosure over feature visibility.

## Visual constraints

- Work-tool aesthetic, not a decorative consumer dashboard.
- Default palette is neutral/light. Use one primary accent and reserve warning/red only for date urgency/overdue semantics.
- Do not assign arbitrary colors per vendor.
- Avoid nested cards and excessive badges/chips.
- Body text and calendar event names must remain readable at 125% Windows display scaling.
- Korean is the primary UI language.

## Architecture expectations

- Tauri 2 desktop app is the primary target; standalone web mode remains a useful preview/fallback.
- JSON-like application state may stay in Tauri Store.
- **Tauri attachments should migrate away from IndexedDB to native app-local filesystem storage.** Browser mode may keep IndexedDB fallback.
- Keep a migration path from existing v5 state.
- Main and helper windows must share state reliably.

## Windows/Tauri requirements

Use official Tauri 2 APIs/plugins and keep capabilities narrowly scoped.

Expected plugins/features include:
- store,
- autostart,
- window-state,
- filesystem for native attachment persistence,
- opener/dialog only if required by the implementation.

The project must build an NSIS Windows installer in GitHub Actions on `windows-latest`.

## Required validation before finishing

Run all checks that exist or that you add. At minimum:

1. JavaScript syntax/static checks.
2. Browser UI smoke tests (prefer Playwright) covering main flows.
3. `cargo check` for the Tauri crate when Rust is available.
4. Windows GitHub Actions build for the NSIS installer.
5. Verify there are no console/page errors in the main dashboard or helper.
6. Produce/update screenshots at desktop and helper sizes for visual regression.

Do not claim Windows-native functionality is verified unless the Windows build/job actually ran successfully.

## Key acceptance smoke flows

- Set D-day horizon to `all` and `custom`.
- Click a blank calendar date -> create schedule -> event appears on that exact date.
- Open an event -> add work log -> reload -> log persists.
- Attach a file -> reload desktop app -> attachment still exists and can be opened/saved.
- Open a project step -> see completed/current/future steps simultaneously.
- Click `OK` on current step -> current completes -> next step gets correct due date -> left card and calendar update.
- Edit a work template -> existing project snapshot does not mutate.
- Create a new project from edited template -> new project uses the new template.
- Open helper -> it uses the same D-day horizon/state as main app.
- Click helper card -> main window opens focused on the corresponding detail.

## If product ambiguity remains

Do not add speculative UI. Ask a focused question or preserve the simpler behavior.
