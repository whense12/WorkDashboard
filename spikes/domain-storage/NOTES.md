# Spike C — Domain / Storage Semantics

목적: 제품의 **데이터 의미**가 UI 와 무관하게 성립하는지 검증한다.
이것은 production DB 가 아니다. 측정 결과이며 제품 결정이 아니다.

- worktree: `/home/user/wt-s`, branch `spike/domain-storage`
- 범위: `spikes/domain-storage/` 안에서만 작업했다. 그 밖의 파일은 수정하지 않았다.

---

## 0. 실행 방법과 실제 결과

```
cd spikes/domain-storage
./run-tests.sh            # python3 -m unittest discover
python3 demo_backup.py    # C6 backup 주장을 숫자로 출력
```

**실제 실행 결과 (측정값, 추정 아님):**

```
Ran 66 tests in 0.675s
OK
```

| 항목 | 테스트 수 | 결과 |
|---|---|---|
| C1 minimum domain | 4 | **PASS** |
| C2 participation semantics | 15 | **PASS** |
| C3 relations | 11 | **PASS** |
| C4 undo vs audit | 8 | **PASS** |
| C5 attachment metadata | 6 | **PASS** |
| C6 SQLite integrity | 22 | **PASS** |
| 합계 | **66** | **66 passed / 0 failed** |

실행 중 발견되어 고친 실패는 1건이며, 테스트 코드 자체의 버그였다
(`sqlite3.Row` 를 tuple 과 비교). acceptance 조건은 바꾸지 않았다.

### 런타임 선택: python3 sqlite3 (node:sqlite 아님)

측정한 사실:

- `python3` 3.11.15, sqlite library **3.45.1**, `Connection.backup()` 존재 → C6 의
  Online Backup 요구를 그대로 충족한다.
- `node:sqlite` 도 존재하고 `backup` 을 노출하지만 `require('node:sqlite')` 가
  `ExperimentalWarning: SQLite is an experimental feature and might change at any time`
  을 출력한다.

선택 근거: 저장 의미를 검증하는 harness 자체가 "언제든 바뀔 수 있는" API 위에
서 있으면 측정 결과의 수명이 짧다. 또 python3 `unittest` 는 표준 라이브러리라
npm 의존성이 0 이고, 어떤 UI framework 와도 묶이지 않는다 (요구사항: UI 비의존).
**이것은 런타임 선택일 뿐이며 제품의 저장 스택 결정이 아니다.** 실제 제품의
언어/런타임은 Spike A/B 결과와 함께 사람이 정할 문제다 (OPEN-9).

---

## 1. 산출물

| 경로 | 내용 |
|---|---|
| `schema/v1.sql` | 기준 스키마 (12 domain entity + `schema_version`) |
| `schema/v2.sql` | v1 → v2 migration DDL (table rebuild) |
| `harness/db.py` | 연결·PRAGMA·스키마 생성·migration 절차 |
| `harness/participation.py` | 참가계획 해석 (순수 read, 쓰기 없음) |
| `harness/audit.py` | 감사 기록이 붙은 write path + undo |
| `harness/snapshot.py` | Online Backup / restore / naive copy 반례 |
| `tests/test_c1..c6*.py` | 66개 테스트 |
| `demo_backup.py` | C6 주장을 숫자로 재현 |

---

## 2. C1 — 최소 도메인, 그 이상 없음 · PASS

Core 7: `event`, `vendor`, `participation_plan`, `participation_exception`,
`schedule_item`, `work_item`, `attachment`
Support 5: `dday_pin`, `reminder`, `audit_event`, `layout_profile`, `template`

`test_no_entity_beyond_the_required_list` 가 **엔티티 추가를 실패로 만든다.**
테이블은 정확히 13개이고, 13번째 `schema_version` 은 도메인 엔티티가 아니라
마이그레이션 인프라이므로 `db.INFRA_TABLES` 로 분리해 명시했다.

의도적으로 **만들지 않은 것**: ScheduleItem↔Event/Vendor 연결용 junction 테이블.
nullable FK 컬럼으로 해결했으므로 새 엔티티가 필요 없다. 절차(procedure) 도
별도 엔티티로 만들지 않았다 → **OPEN-1**.

## 3. C2 — 참가 의미론 · PASS

패턴 5종 모두 검증: `daily` / `weekdays` / `weekends` / `selected_weekdays` /
`selected_dates`. 예외 2종: `include` / `exclude`.

해석 순서는 하나로 고정되어 있다:

```
dates(period, pattern)  −  {exclude}  +  {include}
```

`UNIQUE(plan_id, on_date)` 때문에 한 날짜에 include 와 exclude 가 동시에 걸릴 수
없다 → 충돌 해석 규칙을 임의로 만들 필요 자체가 없앴다.

### 요구된 worked example — 실제 출력

period `2026-10-17`~`2026-11-01`, pattern `weekends`,
exception `10/24 exclude`, `10/21 include`:

```
pattern only : 2026-10-17, 2026-10-18, 2026-10-24, 2026-10-25, 2026-10-31, 2026-11-01
with except. : 2026-10-17, 2026-10-18, 2026-10-21, 2026-10-25, 2026-10-31, 2026-11-01
10/21 vendors: ['고성한과']      # 수요일인데 include 로 들어옴
10/24 vendors: []                # 토요일인데 exclude 로 빠짐
```

정확히 6일. 10/24 는 사라졌고 10/21 이 들어왔다.
연도는 과제문에 없어 **2026** 으로 두었다 (오늘 기준 다음에 오는 10/17).
`test_c2_participation.py::WorkedExample::test_exact_result` 가 이 목록을 리터럴로
비교한다.

### 전체 수정 ≠ 특정 날짜 수정 (kernel MUST 4) · PASS

- `test_single_date_exception_does_not_rewrite_the_plan`
  — 예외 1건 추가 후 `participation_plan` row 전체를 dict 로 비교해 **완전히 동일**함을 단언한다.
- `test_plan_edit_does_not_drop_existing_exceptions`
  — plan 의 pattern/period 를 바꾼 뒤 예외 row 2건이 **필드 단위로 그대로**임을 단언한다.
- `test_the_two_edits_are_audited_against_different_entities`
  — 두 조작이 서로 다른 `entity_table` 로 기록된다. 즉 이력상으로도 구별된다.

구조적으로도 이게 보장된다: plan 은 예외를 저장하지 않고, 예외는 plan 을 쓰지
않는다. 해석은 읽기 전용이다.

## 4. C3 — 관계 · PASS

`schedule_item.event_id` 와 `vendor_id` 는 **둘 다 NULL 허용**이다.
검증된 4가지 형태가 한 테이블에 공존한다: 단독 / Event 만 / Vendor 만 / 둘 다.

`test_a_general_office_schedule_is_not_forced_to_have_an_event` 는 문서가 아니라
`PRAGMA table_info` 의 `notnull` 플래그를 직접 읽는다. 누군가 나중에
`event_id NOT NULL` 로 조이면 이 테스트가 즉시 FAIL 난다 (kernel MUST 1).

`work_item` 은 필요한 것에만 연결된다 (무연결 포함 5가지 조합 검증).
`status` 는 `future`/`active`/`done` 로 제한 — kernel MUST 7.

`attachment` 는 **정확히 하나의** 소유 관계를 유지한다
(`CHECK(...)= 1`). 소유자 없음과 소유자 2개 모두 거부된다.
polymorphic `owner_type/owner_id` 대신 nullable FK 4개를 쓴 이유는, 그래야
FK 가 실제로 강제되고 C6 의 고아 방지가 DB 수준에서 증명 가능하기 때문이다.
이것은 **내부 구조 결정**이지 제품 규칙이 아니다.

## 5. C4 — undo 와 audit 은 다른 것 · PASS

`audit_event` 는 append-only 이고, 그것을 주석이 아니라 트리거로 강제한다:

```sql
CREATE TRIGGER audit_event_is_append_only_delete
BEFORE DELETE ON audit_event
BEGIN SELECT RAISE(ABORT, 'audit_event is append-only: DELETE rejected'); END;
```

검증된 것:

- 변경 → undo 후 이력에 **둘 다** 남는다: `['create', 'update', 'undo']`.
  undo row 는 `undo_of_audit_id` 로 원본을 가리킨다.
- undo 는 오직 **추가**만 한다 (row 수 +2, 삭제 0).
- `DELETE FROM audit_event` / `UPDATE audit_event` 는 DB 가 거부한다.
- `audit_event.entity_id` 는 **일부러 FK 가 아니다.** 그래서 엔티티를 지워도
  이력이 cascade 로 따라 지워지지 않는다 (`test_history_survives_deleting_the_entity`).
- create 의 undo, delete 의 undo 도 각각 검증했다.

## 6. C5 — 첨부는 메타데이터만 · PASS

`kind IN ('file','folder','archive','link')` — v2 에서 CHECK 로 닫힌 집합이 된다.
`archive` 는 `folder` 와 **별개 kind** 이므로 `제출서류.zip` 과 `제출서류\` 폴더가
한 개념으로 뭉개지지 않는다 (`test_archive_is_distinguishable_from_folder`).

바이트를 저장하지 않는다: BLOB 컬럼이 없고, 컬럼 집합을 테스트가 고정한다.

**managed-copy vs original-link 는 결정하지 않았다.**
그것을 지키기 위해 `test_no_column_decides_managed_copy_vs_original_link` 가
`storage_mode`, `managed`, `is_copy`, `copied_path`, `copy_policy`,
`original_path`, `cached_path` 같은 컬럼이 **생기면 실패**한다. → **OPEN-5**

## 7. C6 — SQLite 무결성 · PASS (5개 요구 전부)

| 요구 | 결과 | 증거 |
|---|---|---|
| foreign_keys ON + 위반이 실제로 거부됨 | PASS | 위반 INSERT 가 `IntegrityError`. 추가로 pragma OFF 인 연결에서는 **같은 INSERT 가 통과**하고 `foreign_key_check` 가 1건을 보고함 → 거부가 pragma 때문임을 증명 |
| v1 → v2 migration 시뮬레이션 | PASS | 아래 |
| transaction rollback | PASS | 명시적 ROLLBACK, 그리고 트랜잭션 중간 FK 실패 후 ROLLBACK — 둘 다 아무것도 남기지 않음 |
| orphan 방지 | PASS | plan 삭제 → 예외 cascade 삭제; 연결된 event 삭제는 RESTRICT 로 거부; 모든 조작 후 `PRAGMA foreign_key_check` 가 빈 결과 |
| backup / restore 일관성 | PASS | 아래 |

### migration v1 → v2

v2 는 **기술적 조임만** 한다: `attachment.kind` 에 CHECK 를 추가하고 인덱스 3개를
만든다. SQLite 는 ALTER TABLE 로 CHECK 를 못 붙이므로 테이블 재구축이 필요하고,
재구축은 바로 자식 row 가 조용히 고아가 되는 지점이다. 그래서 이걸 골랐다.

절차는 문서화된 순서 그대로다:
`PRAGMA foreign_keys=OFF` → `BEGIN` → rebuild → `PRAGMA foreign_key_check` →
`COMMIT` → `PRAGMA foreign_keys=ON`.

검증:
- v2 도달, row 가 **필드 단위로 동일**하게 보존, 자식의 `schedule_item_id` 가 여전히
  같은 부모를 가리킴, `foreign_key_check` 빈 결과, `integrity_check = ok`.
- v2 의 새 제약이 실제로 강제됨.
- **v2 가 거부할 데이터가 v1 에 있으면 migration 이 시끄럽게 중단된다.**
  row 를 버리지 않는다. ROLLBACK 후 DB 는 멀쩡한 v1 로 남고
  `attachment_v2` 잔해도 남지 않으며 `foreign_keys` 는 ON 으로 복구된다.
- 두 번 실행하면 거부된다.

`harness/db.py` 는 `executescript()` 를 쓰지 않는다. `executescript()` 는 실행 전에
pending transaction 을 **COMMIT** 해버려서 migration 의 명시적 트랜잭션을 조용히
깨뜨린다. 대신 `sqlite3.complete_statement()` 로 직접 분할한다.

### backup — naive file copy 가 왜 실패하는지 숫자로

`demo_backup.py` 실제 출력:

```
live database        vendor rows = 12   wal bytes = 57712
naive file copy      vendor rows = 5    integrity = ok   digest matches live = False
online backup API    vendor rows = 12   integrity = ok   digest matches live = True
restored from backup vendor rows = 12   integrity = ok   fk_check = []   digest matches live = True
```

방법: WAL 모드에서 5건을 쓰고 `wal_checkpoint(TRUNCATE)` 로 본체 파일에 반영한 뒤,
`wal_autocheckpoint=0` 으로 두고 7건을 더 commit 한다. 이 7건은 `-wal` 사이드카에
있다. 이 상태에서 본체 `.db` 만 복사하는 것이 "열린 채 파일 복사" 다.

무서운 부분은 **naive copy 도 `integrity_check = ok` 를 반환한다**는 것이다.
손상된 게 아니라 **조용히 과거**다. commit 된 7건이 통째로 사라졌는데 아무 에러도
없다. 이래서 파일 복사는 백업으로 인정할 수 없다.

Online Backup API (`sqlite3.Connection.backup()`) 는 같은 순간에 12건 전부를 담고
digest 가 live 와 일치한다. 추가로:

- **restore round-trip**: backup → restore 후 `integrity_check=ok`,
  `foreign_key_check` 빈 결과, 모든 도메인 테이블 row count 일치, 전체 내용 digest 일치.
- **commit 안 된 쓰기 중의 backup**: 다른 연결이 `BEGIN IMMEDIATE` 로 쓰는 중에 backup 을
  떠도 그 미완 row 는 들어가지 않고 스냅샷은 일관적이다. 반쯤 쓰인 상태가 아니다.
- **복구본은 읽기만 되는 게 아니라 쓸 수 있다**: restore 한 DB 에 INSERT 가 되고
  FK 위반은 여전히 거부된다.

---

## 8. OPEN — 구현하지 않고 남긴 제품 판단

| # | 항목 | 왜 여기서 결정하지 않았나 |
|---|---|---|
| OPEN-1 | **절차(procedure) 를 별도 엔티티로 둘 것인가.** 현재는 `template.kind='procedure'` 와 `work_item` 뿐이고, 다단계 절차의 상위-하위 관계를 표현할 수단이 없다. kernel MUST 7 은 "업무/절차" 를 함께 말한다. | 엔티티 추가는 제품 결정이다. C1 은 목록 외 추가를 금지했다. |
| OPEN-2 | **plan 의 기간을 줄였을 때 기간 밖으로 밀려난 예외 row 를 유지할 것인가 삭제할 것인가.** 현재는 유지하고 해석에서만 무시한다 (데이터 손실 없음). 기간을 되돌리면 되살아난다. | 사용자가 "그 예외는 없앤 셈" 으로 기대하는지 "보관" 을 기대하는지는 UX 판단이다. |
| OPEN-3 | **ScheduleItem 이 참조하는 Event 를 지우려 할 때.** 현재 RESTRICT(거부). 대안은 "연결만 끊고 일정은 남긴다"(SET NULL) 또는 사용자에게 묻기. | 어느 쪽도 데이터가 아니라 제품 판단이다. RESTRICT 는 파괴하지 않는 쪽이라서 골랐을 뿐이다. |
| OPEN-4 | **redo / undo 의 undo.** 현재 `NotImplementedError` 로 명시적으로 거부한다. | 되돌리기 스택의 모양은 제품 결정이다. 추측해서 구현하지 않았다. |
| OPEN-5 | **첨부를 원본 링크로 둘지 관리 사본을 만들지** (C5 가 명시적으로 OPEN 으로 지정). | 지정된 대로 남겼고, 컬럼이 생기면 테스트가 실패하도록 막아두었다. |
| OPEN-6 | **undo 의 단위.** 현재는 audit row 1건 = undo 1회. 사용자가 한 번에 한 조작(예: plan 수정 + 예외 추가)을 통째로 되돌리길 기대한다면 operation/transaction 묶음 개념이 필요하다. | 사용자 기대의 문제라 임의로 정하지 않았다. |
| OPEN-7 | **한 Event 안에서 한 Vendor 가 참가계획을 2개 이상 가질 수 있는가.** 현재 `UNIQUE(event_id, vendor_id)` 로 1개만 허용. | 서로 떨어진 두 구간에 참가하는 업체가 실제로 있다면 이 제약은 틀린 것이다. 확인 필요. |
| OPEN-8 | **참가일을 ScheduleItem 으로 실체화할 것인가.** 현재는 계산으로만 구한다 (`resolve`). Calendar 가 업체명을 보여주는 데는 충분하다. | 실체화하면 참가일 하나하나에 메모·첨부를 붙일 수 있게 되는데, 그건 새 제품 능력이다. |
| OPEN-9 | **제품의 실제 저장 런타임/언어.** 여기서 python3 을 쓴 것은 harness 선택일 뿐이다. | Spike A/B 결과와 함께 사람이 정할 문제다. |

---

## 9. 검증하지 않은 것 (NOT TESTED)

정직하게 남긴다. 아래는 PASS 가 아니다.

- **Windows 에서의 동작 — NOT TESTED.** 이 환경은 Ubuntu 24.04 headless 컨테이너다.
  제품 목표는 Windows 데스크톱이고 SQLite 의 파일 잠금 의미는 Windows 에서 다르다.
  WAL 사이드카 처리, 파일 잠금, 경로 의미는 Windows 에서 다시 측정해야 한다.
- **다중 프로세스 동시성 — NOT TESTED.** 한 프로세스 안의 두 연결까지만 확인했다.
- **크래시 / 정전 내구성 — NOT TESTED.** 프로세스를 강제 종료한 뒤의 복구는 측정하지 않았다.
- **규모·성능 — NOT TESTED.** 수년치 데이터에서의 `resolve()` 비용과 인덱스 효과는
  측정하지 않았다. 현재 `resolve()` 는 하루치 업체명을 구할 때 plan 마다 전 기간을
  순회하므로, 데이터가 커지면 이 접근이 유지될지 별도 측정이 필요하다.
- **시간대 / DST — NOT APPLICABLE (이번 범위에서).** 날짜는 지역 날짜 TEXT 로만 다뤘고
  시각 연산을 하지 않았다. 알림(`reminder.remind_at`) 이 실제 시각 연산을 하게 되면
  그때 다뤄야 한다.
