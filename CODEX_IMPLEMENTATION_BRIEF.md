# Work Calendar Helper — Codex Context & Implementation Brief

**Document purpose:** handoff specification for a Codex agent with zero prior conversation context  
**Target:** Windows-first Tauri 2 desktop app + standalone web preview  
**Current baseline:** repository state named “v5”  
**Primary language:** Korean UI  
**Updated:** 2026-08-12

---

# 0. Read this as a product contract, not a suggestion list

This repository is the result of several failed/rejected dashboard experiments. The most important lesson is that **generic dashboard features are actively harmful here**.

The user does not want a “management platform” with lots of widgets. The user wants a **vendor-by-vendor calendar assistant** that is readable immediately, and that minimizes the number of steps required to record and advance work.

The product must feel closer to a clean planning calendar + compact desktop helper than to a BI dashboard, project-management suite, CRM, or construction ERP.

If a feature does not directly help the user answer one of these questions, it probably does not belong on the main screen:

1. **Which vendor has something coming up?**
2. **What exactly is the next thing?**
3. **On what date?**
4. **What is on the calendar today/this month?**
5. **What happened before, and what comes after this step?**
6. **Can I record the work and move to the next step with minimal effort?**

The user explicitly said that *operating the tool itself must not become another job*.

---

# 1. User/domain context

The user appears to be a public-sector employee managing construction-related or vendor-related administrative work. The precise administrative procedure varies, so **do not hardcode domain workflow rules**.

The seed workflow names currently in the repo are examples only:

- 시행계획
- 청렴이행서약
- 안전보건수준평가
- 계약의뢰
- 계약
- 착공계 확인
- 준공계
- 준공검사

These names are not authoritative policy. The product must allow the user to create, rename, reorder, add, remove, and reuse procedure templates.

A vendor can have one or more work/project records. The application therefore needs to keep these concepts separate:

- **Vendor/company master/template**
- **Work/project**
- **Procedure template**
- **Procedure-step instance belonging to a specific work/project**
- **Manual one-off schedule/event**
- **Work logs**
- **File attachments**

---

# 2. Product evolution and rejected directions

Codex must understand what was tried and rejected so it does not reintroduce the same problems.

## 2.1 Initial useful reference: “Dinosaur Expo” calendar dashboard

An earlier unrelated event dashboard had a structure the user liked conceptually:

- summary/control area on the left/top,
- a calendar as the primary visual surface,
- vendor/company names visible directly in calendar events,
- details edited only after clicking,
- responsive layout,
- direct manipulation of calendar dates.

The current work-calendar product should **borrow the clarity of that layout**, not its event-domain content.

## 2.2 Rejected: card-heavy “workflow dashboard”

Rejected because it made the user inspect too many components before understanding the situation.

Do **not** add:

- KPI cards,
- progress percentages,
- progress bars,
- “external waiting” states,
- “within 7 days” status categories,
- arbitrary health scores,
- charts,
- completion analytics,
- vendor color palettes,
- invented work-state taxonomies.

The user specifically objected to these because the system cannot know the true project progress merely from checked steps.

## 2.3 Rejected: line-item table as the main dashboard

A compact table improved density but still failed the user’s request because the desired mental model is **calendar-based schedule management**, not a spreadsheet substitute.

## 2.4 Rejected: calendar events that show D-day instead of task names

The calendar must show the actual schedule/task. Example:

**Correct**

`대한건설 · 안전보건수준평가`

**Wrong**

`대한건설 · D-2`

D-day is a secondary urgency representation for the left-side vendor cards and detail view.

---

# 3. Core product concept

The final information architecture is intentionally simple:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 업체별 업무 일정              D-day 도우미   템플릿   설정   +업무   +일정  │
├────────────────────────────┬────────────────────────────────────────────────┤
│ 다가오는 일정              │  2026년 8월                         < Today >  │
│ 기준 [D-14 ▾]              │                                                │
│                            │  일   월   화   수   목   금   토              │
│ ┌────────────────────────┐ │                                                │
│ │ 대한건설          D-2 │ │             12 TODAY                           │
│ │ 안전보건수준평가       │ │              │                                 │
│ │ 8.14 · 배수로정비공사  │ │              │ 대한건설 · 안전보건수준평가   │
│ └────────────────────────┘ │                                                │
│                            │      미래토건 · 계약의뢰                       │
│ ┌────────────────────────┐ │                                                │
│ │ 미래토건          D-4 │ │                            고성건설 · 착공계    │
│ │ 계약의뢰               │ │                                                │
│ │ 8.16 · 농로보수공사    │ │                                                │
│ └────────────────────────┘ │                                                │
│            scroll ↓        │                             calendar scroll ↓  │
└────────────────────────────┴────────────────────────────────────────────────┘
```

The main surface should remain understandable even if the user never opens settings/templates.

---

# 4. Glanceability (“한눈에 들어온다”) requirements

“Glanceable” does **not** mean “show more metrics.” It means the user can visually parse the important information without hunting.

## 4.1 Visual hierarchy

Priority order on the main screen:

1. vendor/company name,
2. actual schedule/task name,
3. date / D-day,
4. project/work name,
5. everything else is secondary or hidden until click.

## 4.2 Stable layout

- Left D-day column stays at a stable width.
- Calendar owns most of the viewport.
- Primary controls remain in stable positions.
- Avoid panels that appear/disappear and shift the whole layout for routine actions.
- Details use modal/popover overlays.

## 4.3 Visual noise budget

On the default main view, avoid:

- multiple badge systems,
- decorative icons in every row,
- multicolor vendor coding,
- status legends,
- KPI tiles,
- charts,
- secondary filters that are not essential.

Use color only for meaningful date urgency and Today/selection feedback.

---

# 5. Main layout specification

## 5.1 Desktop target

Primary target resolutions/scaling:

- 1920×1080 @ 100% Windows scaling,
- 1920×1080 @ 125% scaling,
- 1366×768,
- 1280×720 minimum practical layout.

Tauri main window currently starts around 1380×900. This is acceptable as a baseline, but the layout must remain usable at the smaller targets above.

## 5.2 Header

Recommended height: 56–64 px.

Left:
- app title: `업체별 업무 일정`
- optional one-line microcopy, visually subordinate

Right:
- `D-day 도우미`
- `템플릿`
- `설정`
- `+ 업무`
- primary `+ 일정`

Do not add global metrics to the header.

## 5.3 Left D-day rail

Recommended width: 290–340 px.

Header:

- title `다가오는 일정`
- D-day horizon selector

Horizon options:

- D-3
- D-5
- D-7
- D-14
- D-30
- **무제한** (`all`)
- **직접설정** (`custom`, positive integer days)

Behavior:

- One visible card per vendor, representing that vendor’s nearest incomplete scheduled item.
- Sort by actual date ascending. Overdue dates naturally appear before today; do not create a separate status category/tab.
- If the selected horizon is finite, show incomplete items with `diffDays <= horizon`; overdue items remain visible.
- If horizon is `all`, do not impose an upper future-date limit.
- Card click opens the corresponding detail modal.

Card contents — keep it strict:

```text
대한건설                         D-2
안전보건수준평가
8.14. · 배수로 정비공사
```

No progress bar. No project-health status. No invented state badge.

If the same vendor has several later items, do not clutter the main card with a large list. The detail modal can show the full work procedure and later schedules.

## 5.4 Calendar

The right side is the primary surface.

Requirements:

- Monthly grid.
- Weekday header remains visible/sticky while the calendar body scrolls.
- Calendar body itself is vertically scrollable.
- Week row/day-cell height is allowed to grow to preserve readable event text.
- Do not shrink event text to unreadable sizes just to force the entire month into one viewport.
- Avoid a scroll area inside each date cell.

### Today

Today must be visually obvious at first glance.

Use a combination such as:

- visible `TODAY` label,
- accent border or subtle fill for the entire cell,
- thin accent bar/marker at the top of the cell.

Do not rely on tiny colored date text alone.

### Calendar event label

Display:

`업체명 · 일정명`

Examples:

- `대한건설 · 안전보건수준평가`
- `미래토건 · 계약의뢰`
- `고성건설 · 현장 확인`

Do **not** include D-day in the event label.

Project/work name may appear in tooltip/detail, not necessarily in the main event label.

### Completed calendar items

Completed dated items may remain visible for context, using a subdued treatment and a simple check mark. Do not let completed styling dominate the calendar.

### Empty date click

Clicking unused space in an in-month date cell must open the Add Schedule modal with:

- date prefilled,
- date not requiring re-entry,
- focus starting on vendor or schedule name.

Clicking an existing event must open detail, not trigger the date-cell add action.

---

# 6. Add Schedule flow

Goal: allow a one-off schedule to be recorded in seconds.

Required fields:

1. date — prefilled when opened from calendar,
2. vendor,
3. connected work/project (optional; `일반 일정` allowed),
4. schedule/task name,
5. short memo (optional).

Do not force the user through a multi-step wizard.

After saving:

- modal closes,
- event appears immediately on the selected date,
- D-day rail recalculates,
- state persists.

Attachments can be added from detail after the event exists. Avoid overloading the create dialog.

---

# 7. Detail modal — central work surface

A D-day card click or calendar-event click opens the same detail surface.

This modal is where complexity is allowed because it is **progressive disclosure**.

## 7.1 Header/summary

Show clearly:

- vendor,
- project/work name or `일반 일정`,
- selected schedule/task,
- due date,
- D-day if incomplete / `완료` if completed,
- contact person/phone as secondary information.

## 7.2 Work-log recording

The user explicitly requested an easy place to record work content.

Provide:

- a compact multi-line text input,
- `기록 추가` button,
- `Ctrl+Enter` / `Cmd+Enter` shortcut,
- reverse-chronological log list,
- automatic timestamp,
- delete control with confirmation or immediate undo.

The log area is intended for:

- phone-call notes,
- vendor responses,
- requested documents,
- internal discussion,
- follow-up notes,
- status narrative.

Do not turn it into a rich-text document editor unless the user later asks for one.

## 7.3 File attachments

The user explicitly requested file attachments.

### Desktop/Tauri behavior — required target

Do **not** keep the final desktop implementation dependent on IndexedDB blobs.

Recommended design:

- store attachment metadata in app state,
- copy attachment file bytes into an application-local data directory, e.g. an `attachments/` subtree under Tauri AppLocalData/AppData,
- use a generated internal ID/path, not raw user filenames as storage keys,
- preserve original display filename and MIME/size metadata,
- allow open/save/export,
- delete both metadata and native file together,
- sanitize paths and keep filesystem capability scope narrow.

Tauri 2’s filesystem plugin supports application-specific base directories and scoped permissions; use the current official API rather than broad filesystem access.

### Browser fallback

Standalone web preview may use IndexedDB blobs as a fallback.

The UI should tell the user which persistence mode is active only when relevant; do not clutter the main screen.

### Attachment limits

The existing prototype uses 50 MB per file. Keep this unless there is a compelling implementation reason to change it.

### Backup concern

A JSON-only backup is insufficient once native attachments exist. See Section 16.

## 7.4 Procedure timeline — show all states simultaneously

The user explicitly asked to see **completed steps and steps that have not arrived yet**, not just the current step.

Example:

```text
✓ 시행계획               완료 · 8.7.
✓ 청렴이행서약           완료 · 8.9.
● 안전보건수준평가       현재 · 8.14.
4 계약의뢰               예정 · 날짜 미정
5 계약                   예정 · 날짜 미정
```

Rules:

- completed step -> completed marker + completion date,
- first incomplete step -> current marker,
- later incomplete steps -> future/예정,
- future step may have `날짜 미정` until it is activated,
- all steps stay visible in one ordered list.

Do not calculate or display a percentage from step count.

## 7.5 `OK 완료` behavior

For current project procedure step:

1. mark current step complete,
2. record completion date,
3. preserve logs/attachments/history,
4. find next incomplete step,
5. if next step has no due date, calculate:
   `completion date + next step offset`,
6. do not overwrite a manually assigned next-step date,
7. persist,
8. close or refresh detail cleanly,
9. recalculate D-day rail,
10. update calendar immediately.

If there is no next step, the work/project has no active procedure event. Do not invent a progress/finished dashboard indicator on the main screen.

### Correction flow

Provide a safe way inside detail/procedure editing to reverse an accidental completion or correct dates. This should be secondary, not a prominent main-screen button.

---

# 8. Procedure timing model

Current prototype uses an `offset` integer representing days after previous completion.

Keep this simple default model unless expanded later:

```json
{
  "name": "계약의뢰",
  "offset": 2
}
```

Meaning:

> when the previous current step is completed, this step’s default due date is completionDate + 2 days.

The user must be able to edit this offset in templates and in an individual work’s procedure.

A manually edited due date on a concrete step wins over future automatic calculation for that step.

---

# 9. Vendor template/master management

The user called this a template feature. Conceptually it is reusable vendor master data.

Fields:

- vendor/company name,
- contact person,
- phone/contact,
- memo.

Requirements:

- add,
- edit,
- delete when unused,
- selection during work/project creation,
- selection during one-off schedule creation.

Do not force the user to retype vendor contact data per work.

If a vendor is referenced by existing work/events, destructive deletion must be prevented or converted to an explicit migration/archive operation.

---

# 10. Work/procedure template management

A work template contains an ordered set of procedure steps.

Example only:

```text
일반 공사(예시)
  1. 시행계획 · +0일
  2. 청렴이행서약 · +2일
  3. 안전보건수준평가 · +2일
  4. 계약의뢰 · +2일
  ...
```

Template features:

- create template,
- rename,
- add step,
- remove step,
- rename step,
- reorder step,
- change offset,
- duplicate template if easy to implement cleanly.

### Snapshot rule — critical

When a new work/project is created from a template:

- deep-copy the ordered steps into the work/project,
- generate new step IDs,
- keep `templateId` only as provenance,
- later template edits must **not** mutate existing projects.

This prevents historical records from changing under the user.

### Individual work procedure editing

The user can edit the procedure on one concrete work/project without changing the source template.

Be careful around completed steps:

- do not silently delete completed history,
- avoid regenerating IDs for existing steps,
- preserve logs and attachments when reordering/editing.

---

# 11. Add Work / Project flow

Keep this compact.

Minimum fields:

- vendor,
- work template,
- work/project name,
- first schedule date,
- optional memo.

When saved:

- instantiate the template snapshot,
- only the first step receives the initial date by default,
- later step dates remain null until activation unless explicitly assigned,
- app updates calendar and D-day rail.

---

# 12. D-day desktop helper

The desktop helper is a companion, not another dashboard.

Current Tauri configuration already defines a small `helper` window. Preserve the concept and improve behavior.

Recommended size baseline: ~330×430 px.

Display only:

```text
오늘의 일정 / 다가오는 일정

대한건설                         D-2
안전보건수준평가
8.14. · 배수로 정비공사

미래토건                         D-4
계약의뢰
8.16. · 농로 보수공사
```

Requirements:

- uses the same horizon setting as the main app (`all` and `custom` included),
- state changes in main window update helper without restart,
- optional always-on-top,
- optional autostart,
- on helper-only autostart, main window remains hidden,
- window position/size restored,
- minimal chrome,
- must have a clear drag area if decorations are disabled,
- must have clear close/hide and open-main controls.

### Deep-link behavior

Current helper click merely opens/focuses the main window. Improve this:

- clicking a helper card should open/focus main,
- main should open the corresponding schedule detail automatically.

Implement with a simple cross-window event/message or shared selection state. Avoid complex routing if not needed.

---

# 13. Calendar scrolling behavior

The user explicitly requested that the calendar can be scrolled downward.

Recommended implementation:

- overall main layout height fits the Tauri window,
- header is fixed within app layout,
- left D-day list scrolls independently if necessary,
- right calendar has one vertical scroll container,
- weekday header is sticky inside that container,
- month week rows are not artificially squashed.

Do not create nested vertical scrollbars inside individual date cells.

At startup / Today button:

- move current month into view,
- position Today reasonably near the visible center of the calendar scroll area.

---

# 14. Calendar density / many events

Prefer showing real event names over collapsing too early.

Because the calendar itself can scroll, allow day/week height to grow with content.

Do not add a `+N` collapse merely because there are four events. If an extreme number of events makes the UI unusable, use a conservative overflow strategy only after testing with realistic high-density fixtures. Any overflow UI must still allow a one-click view of all events on that date.

---

# 15. Data model target (v6 suggested)

Codex may rename fields if migration remains clean, but preserve the conceptual separation.

```ts
type Settings = {
  horizon: '3' | '5' | '7' | '14' | '30' | 'all' | 'custom';
  customHorizon: number;
  helperAlwaysOnTop: boolean;
  autostart: boolean;
};

type Vendor = {
  id: string;
  name: string;
  person?: string;
  contact?: string;
  memo?: string;
};

type WorkTemplateStep = {
  id?: string;          // optional at template level
  name: string;
  offset: number;
};

type WorkTemplate = {
  id: string;
  name: string;
  steps: WorkTemplateStep[];
};

type WorkLog = {
  id: string;
  time: string;         // ISO timestamp
  text: string;
};

type AttachmentMeta = {
  id: string;
  name: string;         // original display name
  type?: string;
  size: number;
  addedAt?: string;
  backend: 'tauri-fs' | 'indexeddb';
  relativePath?: string; // desktop only
};

type ProcedureStep = {
  id: string;
  name: string;
  offset: number;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  memo?: string;
  logs: WorkLog[];
  attachments: AttachmentMeta[];
};

type Project = {
  id: string;
  vendorId: string;
  name: string;
  memo?: string;
  templateId?: string;
  steps: ProcedureStep[]; // snapshot
};

type ManualEvent = {
  id: string;
  vendorId: string;
  projectId?: string | null;
  date: string;
  name: string;
  memo?: string;
  completed: boolean;
  completedAt: string | null;
  logs: WorkLog[];
  attachments: AttachmentMeta[];
};
```

No server/multi-user model is required for this iteration.

---

# 16. Persistence, attachments, backup/restore

## 16.1 State persistence

Current desktop baseline uses Tauri Store for JSON-like state and browser localStorage fallback. This is acceptable.

## 16.2 Attachment persistence — change required

Current v5 stores blobs in IndexedDB even for desktop. Improve desktop mode to native application filesystem storage.

Recommended desktop folder shape:

```text
<AppLocalData>/
  state-or-store-files...
  attachments/
    <entity-id>/
      <attachment-id>.bin-or-original-extension
```

The exact implementation is flexible, but ensure:

- no path traversal,
- narrow Tauri fs capability scope,
- original filename kept only as metadata/display,
- delete is atomic enough to avoid orphan metadata,
- missing physical file is handled gracefully.

## 16.3 Backup/restore — recommended completion requirement

Because attachments are now first-class data, improve backup so a desktop backup can include both:

- state JSON,
- attachment files.

Preferred artifact: one portable backup archive (e.g. ZIP) or a clearly structured exported folder.

If implementing archive packaging in this iteration is too risky, at minimum:

- keep JSON backup,
- clearly warn that attachments are excluded,
- document the limitation,
- do not imply a full backup succeeded.

However, a **complete attachment-inclusive backup is strongly preferred before calling the desktop app production-ready**.

---

# 17. Current repository audit — what exists today

The v5 repository already contains:

```text
.github/workflows/windows-build.yml
README.md
build_windows.ps1
frontend/app.js
frontend/core.js
frontend/helper.html
frontend/helper.js
frontend/index.html
frontend/styles.css
src-tauri/Cargo.toml
src-tauri/build.rs
src-tauri/capabilities/default.json
src-tauri/src/lib.rs
src-tauri/src/main.rs
src-tauri/tauri.conf.json
web_standalone.html
```

## 17.1 Existing useful implementation

Already present and reusable:

- left D-day list,
- finite/custom/all horizon in state,
- calendar event labels with vendor + task,
- Today marking,
- empty day click to add schedule,
- procedure completion -> next due date calculation,
- vendor/work templates,
- individual project procedure editor,
- work logs,
- attachment metadata/UI,
- main/helper state sharing,
- Tauri main/helper windows,
- always-on-top command,
- autostart helper-only mode,
- window-state plugin,
- Windows NSIS configuration,
- GitHub Actions skeleton.

## 17.2 Areas to audit/refactor rather than blindly preserve

1. **Attachment backend**
   - v5 uses IndexedDB blobs universally.
   - desktop should use native Tauri app-local filesystem.

2. **Helper card deep link**
   - helper currently only opens/focuses main.
   - must open corresponding detail.

3. **Detail date editing**
   - current code uses `prompt()` for date changes.
   - replace with in-product date UI; native browser prompt is visually inconsistent and error-prone.

4. **Modal accessibility / focus management**
   - ensure focus enters modal, Escape closes, focus returns to trigger, and keyboard navigation is sane.

5. **Project procedure editing**
   - ensure reorder/edit does not drop logs/attachments/completion history.

6. **Template deletion semantics**
   - work-template deletion must not damage projects instantiated from it.
   - vendor deletion must remain protected while referenced.

7. **Calendar scaling**
   - test real density and Windows 125% scaling.

8. **Backup semantics**
   - v5 JSON state does not carry attachment blobs/files.

9. **Windows build validation**
   - existing workflow must be audited against current Tauri 2 official recommendations and made reliably reproducible.

---

# 18. Technical constraints and preferred implementation style

- Keep dependencies modest.
- Vanilla HTML/CSS/JS is acceptable and currently used.
- Do not introduce React/Vue/Svelte solely for fashion. A framework migration is justified only if it materially reduces implementation risk and comes with migration/test coverage.
- Preserve simple file structure where practical.
- Tauri 2 remains the native shell.
- Use current official Tauri 2 plugin APIs.
- Capabilities must be least-privilege.
- Keep native/web storage differences behind a small abstraction in `core.js` or a dedicated storage module.

---

# 19. Visual design specification

## 19.1 Tone

- Korean government/office utility,
- calm,
- precise,
- neutral,
- not flashy,
- not “startup analytics dashboard.”

## 19.2 Color

Use approximately:

- neutral warm/cool background,
- white panels,
- dark slate/green-black text,
- one restrained primary accent,
- overdue red only where date urgency requires it,
- Today accent strongly visible.

Do not use a different accent color for every vendor.

## 19.3 Typography

- Korean system UI fonts / Pretendard / Noto Sans KR stack is acceptable.
- Normal body text should remain readable around 13–14 px desktop CSS size.
- Calendar event text must not become microtext.
- D-day number can be visually stronger but should not overpower vendor/task names.

## 19.4 Spacing

Use compact office-tool density, but preserve clickable targets.

Typical targets:

- 8 px base rhythm,
- 10–14 px panel padding,
- 36–40 px standard control height,
- 8–12 px radii.

Avoid oversized 20+ px rounded “marketing cards.”

## 19.5 Iconography

Use icons sparingly, mainly for toolbar actions. Text labels are more important than decorative iconography.

---

# 20. Interaction rules

## 20.1 Click targets

- D-day card -> detail
- calendar event -> detail
- blank day area -> add schedule
- Today -> current month + scroll Today into good visible position
- procedure step in detail -> optional step detail/edit, if implemented

## 20.2 Prevent accidental actions

Destructive actions:

- deleting manual event,
- removing attachment,
- deleting template,
- reversing history

must have either confirmation or obvious undo where feasible.

`OK 완료` should be fast, but still preserve a correction path.

## 20.3 No double-entry

If the user clicks a date to create a schedule, do not ask them to select the date again.

If vendor master has contact information, do not ask for it again per project.

---

# 21. Migration from v5

Implement a versioned state migration rather than wiping existing data.

Suggested flow:

```text
v5 state
  -> normalize
  -> add new attachment backend metadata fields
  -> preserve all vendor templates
  -> preserve all work templates
  -> preserve project/step IDs
  -> preserve manual events/logs/completion dates
  -> migrate attachment metadata carefully
```

Existing IndexedDB attachments cannot magically become native filesystem files without reading blobs. If desktop migration can access the old IndexedDB data, provide a one-time copy migration. If that is too fragile, keep a compatibility read path and clearly document it.

Never silently discard existing work logs or attachments.

---

# 22. Acceptance criteria — product behavior

Codex should treat these as required tests, not illustrative ideas.

## A. Main D-day rail

- [ ] Preset D-day horizons work.
- [ ] `무제한` shows future incomplete items without upper date limit.
- [ ] `직접설정` accepts and persists a user-defined positive number.
- [ ] One nearest visible card per vendor.
- [ ] Cards sort by actual due date ascending.
- [ ] Card shows vendor, task, date, project/work name, D-day.
- [ ] No progress %, KPI, invented state badge, or analytics appear.

## B. Calendar

- [ ] Calendar event label is `업체명 · 일정명`.
- [ ] Calendar does not substitute D-day for the task name.
- [ ] Today is obvious without careful searching.
- [ ] Calendar body scrolls vertically.
- [ ] Weekday header stays visible while scrolling.
- [ ] Event names remain readable at Windows 125% scaling.
- [ ] Blank date click opens Add Schedule with that date already set.
- [ ] Event click opens detail and does not also open Add Schedule.
- [ ] Completed dated events remain inspectable.

## C. Detail / work logs

- [ ] Detail shows vendor/work/task/date clearly.
- [ ] Add work log persists after app reload.
- [ ] Logs show timestamps.
- [ ] Logs can be removed safely.

## D. Attachments

- [ ] Desktop attachment survives app restart.
- [ ] Attachment can be opened/exported again.
- [ ] Attachment deletion removes both metadata and physical stored file.
- [ ] Missing/corrupt physical file yields a clear non-destructive error.
- [ ] Web preview fallback remains functional.

## E. Procedure visibility

- [ ] Completed steps are visible.
- [ ] Current step is visible.
- [ ] Future/not-yet-due steps are visible.
- [ ] Future step may show `날짜 미정`.
- [ ] No progress percentage is derived from step count.

## F. OK -> next procedure

- [ ] Current step becomes completed with completion date.
- [ ] Next incomplete step becomes current.
- [ ] Next due date = completion date + configured offset when no manual date exists.
- [ ] A pre-existing manual due date is not overwritten.
- [ ] Main D-day rail updates immediately.
- [ ] Calendar updates immediately.
- [ ] Completion correction is possible from a secondary detail control.

## G. Templates

- [ ] Vendor template/master CRUD works.
- [ ] Work template CRUD works.
- [ ] Steps can be renamed, added, removed, reordered, and offsets changed.
- [ ] Existing work/project procedure is a snapshot and does not change when its source template changes.
- [ ] New project uses the newly edited template.
- [ ] Individual project procedure can be edited without mutating the template.

## H. Desktop helper

- [ ] Helper shows same D-day horizon as main.
- [ ] Helper updates live when main state changes.
- [ ] `무제한`/custom horizon works in helper as well.
- [ ] Helper card click opens/focuses main and opens matching detail.
- [ ] Always-on-top setting works.
- [ ] Autostart helper-only mode works.
- [ ] Window size/position restore works.

---

# 23. QA / test plan

## 23.1 Browser automated tests

Use Playwright or an equivalent browser harness.

Create deterministic fixtures with a mocked “today” or data-relative test helper.

Minimum flows:

1. render main dashboard,
2. change horizon to all/custom,
3. create schedule by blank-date click,
4. open event detail,
5. record work log,
6. complete a step,
7. verify next step/date,
8. edit template and verify existing project snapshot isolation,
9. create a project from changed template,
10. verify no console/page errors.

## 23.2 Visual regression screenshots

Generate at least:

- `1440x900` main dashboard,
- `1280x720` main dashboard,
- simulated 125% density check if practical,
- `330x430` helper,
- detail modal with full procedure + logs + attachments.

Inspect screenshots, not only DOM assertions.

## 23.3 Rust/Tauri checks

When toolchain exists:

- `cargo fmt --check`
- `cargo check`
- build with current Tauri CLI

## 23.4 Windows CI

GitHub Actions on `windows-latest` must:

1. checkout,
2. install current stable Rust,
3. install required frontend/Tauri tooling,
4. run JS/browser checks,
5. run Rust checks,
6. build NSIS target,
7. upload the installer artifact,
8. make build logs easy to inspect.

Prefer the current official Tauri GitHub pipeline guidance / `tauri-action` if appropriate for the repo.

Do not label a Windows build “verified” until the Windows job is green.

---

# 24. Windows packaging expectations

Primary distributable:

- NSIS setup `.exe`

Current Tauri config uses `targets: ["nsis"]`; preserve this unless there is a documented reason to change it.

Installer requirements:

- Korean product name can remain in installer UI,
- source repository/archive paths should remain ASCII-safe where practical,
- WebView2 behavior should follow current Tauri Windows guidance,
- application should install and launch without requiring manual data-folder setup.

---

# 25. Desktop-helper launch behavior

Expected startup behavior:

### Normal manual launch

- main window shown,
- helper hidden unless user opens it or a persisted preference says otherwise.

### OS autostart

- launch with helper-only argument,
- main stays hidden,
- helper appears in its restored position,
- helper remains lightweight.

The current Rust code already uses `--helper-only`; audit and preserve/fix this behavior.

---

# 26. Security and file-safety requirements

Because attachments are local files:

- use application-specific data directory,
- least-privilege fs capability scope,
- no arbitrary user-controlled path concatenation,
- generated IDs for physical storage names,
- protect against `..`/separator path injection,
- do not expose broad `$HOME/**/*` permissions unless absolutely necessary,
- opening/exporting should use safe Tauri APIs.

---

# 27. Out of scope for this iteration

Do not add these unless separately requested:

- accounts/login,
- server backend,
- multi-user concurrent editing,
- permissions/roles,
- cloud synchronization,
- construction-cost management,
- budget/payment accounting,
- project completion percentage,
- Gantt charts,
- maps,
- analytics dashboards,
- push notifications,
- AI summarization,
- email/Teams integration,
- arbitrary workflow-state taxonomy.

The goal is to finish the **single-user local scheduling assistant** cleanly first.

---

# 28. Implementation order

Codex should not start by repainting CSS. Use this order:

## Phase 1 — audit and tests

- read current code,
- capture current screenshots,
- add/repair smoke-test harness,
- document migration risks.

## Phase 2 — data/storage

- define v6 state migration,
- native Tauri attachment storage abstraction,
- preserve browser fallback,
- stabilize cross-window state and deep-link selection.

## Phase 3 — core interaction correctness

- detail all-step timeline,
- work logs,
- attachment lifecycle,
- OK -> next step rules,
- correction/reopen flow,
- template snapshot integrity.

## Phase 4 — main UI refinement

- enforce left D-day + right calendar composition,
- Today visibility,
- calendar scroll/sticky weekday,
- blank-day add,
- eliminate visual noise.

## Phase 5 — helper

- live state,
- deep-link to detail,
- always-on-top/autostart/window state.

## Phase 6 — Windows build and regression

- current official Tauri Windows pipeline,
- NSIS artifact,
- screenshots,
- final test report.

---

# 29. Deliverables expected from Codex

A completed implementation should leave the repository with:

1. updated source code,
2. migration code from v5,
3. automated browser smoke tests,
4. current Windows GitHub Actions workflow,
5. NSIS build artifact from a successful Windows run when CI is available,
6. updated `README.md`,
7. updated screenshots,
8. a short `IMPLEMENTATION_REPORT.md` containing:
   - what changed,
   - migration behavior,
   - tests executed,
   - Windows build result/link or artifact name,
   - known limitations.

---

# 30. Codex decision rule

If you have to choose between:

- showing more information vs. keeping the main calendar easy to scan,
- adding another control vs. making the existing interaction direct,
- introducing a new status model vs. using date/task context already present,

choose **clarity and fewer interactions**.

If a requirement is genuinely ambiguous and the decision would add visible UI or change user data semantics, **ask before inventing**.
