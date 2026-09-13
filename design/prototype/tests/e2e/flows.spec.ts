/* ux-acceptance F1~F5 + 공통 검증(키보드만으로 진입·완료·복귀, Esc 사다리 한 단계씩, 되돌리기).
   브라우저에서 검증 가능한 것만 있다. 창 동작(always-on-bottom·click-through·트레이)은 여기 없다 → 미검증(Linux 작성). */
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";

async function toToday(page: Page) {
  await page.goto("/");
  await page.getByTestId("widget").click();
  await expect(page.getByTestId("layer1")).toBeVisible();
}
async function toWorkspace(page: Page) {
  await toToday(page);
  await page.getByTestId("open-calendar").click();
  await expect(page.getByTestId("layer2")).toBeVisible();
  await expect(page.getByTestId("view-matrix")).toBeVisible();
}

test.describe("레이어 전이", () => {
  test("위젯 클릭 → 오늘 → 캘린더, Esc는 한 단계씩 내려온다", async ({ page }) => {
    await toWorkspace(page);
    await expect(page.getByTestId("inspector-event")).toBeVisible();
    await page.keyboard.press("Escape");                       // 인스펙터 접힘
    await expect(page.getByTestId("inspector-event")).toBeHidden();
    await expect(page.getByTestId("layer2")).toBeVisible();
    await page.keyboard.press("Escape");                       // 작업공간 → 오늘
    await expect(page.getByTestId("layer1")).toBeVisible();
    await page.keyboard.press("Escape");                       // 오늘 → 위젯
    await expect(page.getByTestId("layer1")).toBeHidden();
    await expect(page.getByTestId("widget")).toBeVisible();
  });
  test("트레이 명령으로 위젯에서 바로 캘린더 (Ctrl+2는 브라우저가 탭 전환으로 가로채 여기서 검증 불가)", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("group", { name: "트레이" }).getByRole("button", { name: "캘린더 열기" }).click();
    await expect(page.getByTestId("layer2")).toBeVisible();
  });
  test("클릭 통과가 켜지면 위젯 클릭은 아무것도 열지 않는다", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("tray-click-through").click();
    await page.getByTestId("widget").click();
    await expect(page.getByTestId("layer1")).toHaveCount(0);
  });
  test("위젯 정보 4개: 날짜ㆍ행사ㆍ몇 곳ㆍ회신", async ({ page }) => {
    await page.goto("/");
    const w = page.getByTestId("widget");
    await expect(w).toContainText("9. 24.");
    await expect(w).toContainText("가을 직거래장터");
    await expect(w).toContainText("2곳 나옴");
    await expect(w.locator("button, input, textarea")).toHaveCount(0);   // rest에 버튼ㆍ입력 0
  });
});

test.describe("F1 일정 추가", () => {
  test("제목+일시만으로 저장, 해석 문장 동기, 되돌리기", async ({ page }) => {
    await toToday(page);
    const before = await page.getByTestId("task-row").count();
    await page.keyboard.press("Control+n");
    await expect(page.getByTestId("qa-title")).toBeFocused();
    await expect(page.getByTestId("qa-echo")).toContainText("2026. 9. 24.(목)");
    await expect(page.getByTestId("qa-echo")).toContainText("업체 연결 없음");
    await page.getByTestId("qa-title").fill("군수 보고 자료 인쇄");
    await page.getByTestId("qa-date").fill("2026-09-25");
    await expect(page.getByTestId("qa-echo")).toContainText("2026. 9. 25.(금)");
    await page.getByTestId("qa-date").fill("2026-09-24");
    await page.getByTestId("qa-title").press("Enter");
    await expect(page.getByTestId("qa-title")).toHaveCount(0);
    await expect(page.getByText("저장함. 군수 보고 자료 인쇄", { exact: true })).toBeVisible();
    await expect(page.getByTestId("task-row")).toHaveCount(before + 1);
    await page.getByText("실행 취소", { exact: true }).click();
    await expect(page.getByTestId("task-row")).toHaveCount(before);
  });
  test("빈 제목은 저장되지 않고 사유가 보인다", async ({ page }) => {
    await toToday(page);
    await page.keyboard.press("Control+n");
    await page.getByTestId("qa-save").click();
    await expect(page.getByText("제목을 적을 것")).toBeVisible();
    await expect(page.getByTestId("qa-title")).toBeFocused();
  });
  test("한글 조합 중 Enter(keyCode 229)는 무시된다", async ({ page }) => {
    await toToday(page);
    await page.keyboard.press("Control+n");
    await page.getByTestId("qa-title").fill("조합중");
    await page.getByTestId("qa-title").evaluate((el) => el.dispatchEvent(new KeyboardEvent("keydown", { key: "Process", code: "Enter", keyCode: 229, bubbles: true })));
    await expect(page.getByTestId("qa-title")).toBeVisible();      // 아직 열려 있음
    await page.getByTestId("qa-title").press("Enter");
    await expect(page.getByTestId("qa-title")).toHaveCount(0);
  });
});

test.describe("F2 업체 등록", () => {
  test("요일 0개면 저장 대신 사유+포커스, 미리보기는 요일마다 갱신, 저장 후 운영표에 행", async ({ page }) => {
    await toWorkspace(page);
    await page.getByTestId("add-vendor").click();
    await page.getByTestId("vr-name").fill("시험농원");
    await expect(page.getByTestId("vr-preview")).toContainText("참가일 없음");
    await page.getByTestId("vr-save").click();
    await expect(page.getByText("나오는 요일을 한 개 이상 고를 것")).toBeVisible();
    await expect(page.getByTestId("vr-wd-1")).toBeFocused();
    await page.getByTestId("vr-wd-6").click();
    await expect(page.getByTestId("vr-preview")).toContainText("토 참가ㆍ8일ㆍ첫 9. 12.(토)ㆍ마지막 10. 31.(토)");
    await page.getByTestId("vr-wd-7").click();
    await expect(page.getByTestId("vr-preview")).toContainText("토ㆍ일 참가ㆍ15일");
    await page.getByTestId("vr-save").click();
    await expect(page.getByText("업체 등록함. 시험농원", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "시험농원" })).toBeVisible();
    await page.getByTestId("undo").click();
    await expect(page.getByRole("button", { name: "시험농원" })).toHaveCount(0);
  });
  test("동명 업체는 차단하지 않고 경고 + 기존 업체 열기", async ({ page }) => {
    await toWorkspace(page);
    await page.getByTestId("add-vendor").click();
    await page.getByTestId("vr-name").fill("고성수산");
    await expect(page.getByText("같은 이름 고성수산 1곳 있음")).toBeVisible();
    await page.getByText("기존 업체 열기", { exact: true }).click();
    await expect(page.getByTestId("inspector-vendor")).toBeVisible();
    await expect(page.getByTestId("inspector-title")).toHaveText("고성수산");
  });
});

test.describe("F3 계획 편집", () => {
  test("진입은 인스펙터뿐, diff 두 열, 의미 잃은 예외를 정하기 전엔 저장 불가, 되돌리기", async ({ page }) => {
    await toWorkspace(page);
    await page.getByTestId("cell-P01-2026-09-12").click();
    await expect(page.getByTestId("de-save")).toBeVisible();
    await expect(page.locator('[data-testid^="pe-wd-"]')).toHaveCount(0);   // 날짜 셀 맥락에 계획 필드 없음
    await page.keyboard.press("Escape");
    await page.getByTestId("vendor-V01").click();
    await page.getByTestId("plan-edit-P01").click();
    await expect(page.getByTestId("pe-save")).toBeDisabled();               // 바뀐 것이 없음
    await page.getByLabel("끝").fill("2026-10-03");
    await expect(page.getByTestId("pe-rem")).toContainText("10. 9.(금)");
    await expect(page.getByTestId("pe-rem")).toContainText("10. 31.(토)");
    await expect(page.getByText("기존 그날만 변경 1건이 의미를 잃음")).toBeVisible();   // X01 10. 10. 빠짐이 범위 밖
    await expect(page.getByTestId("pe-save")).toBeDisabled();
    await page.getByTestId("pe-drop-X01").click();
    await expect(page.getByTestId("pe-save")).toBeEnabled();
    await expect(page.getByTestId("pe-save")).toContainText("−7일");   // 10. 9.~10. 31. 금ㆍ토 8일 중 10. 10.은 이미 빠져 있음
    await page.getByTestId("pe-save").click();
    await expect(page.getByTestId("cell-P01-2026-10-09")).toHaveText("");
    await expect(page.getByTestId("cell-P01-2026-10-02")).toHaveText("■");
    await page.getByTestId("undo").click();
    await expect(page.getByTestId("cell-P01-2026-10-09")).toHaveText("■");
  });
});

test.describe("F4 하루만 변경", () => {
  test("Space는 대화상자를 열 뿐 저장하지 않음, 저장 후 다른 날짜 불변, 되돌리기", async ({ page }) => {
    await toWorkspace(page);
    const cell = page.getByTestId("cell-P01-2026-09-12");
    await cell.focus();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("de-save")).toBeVisible();
    await expect(page.getByTestId("de-save")).toBeDisabled();               // 계획과 같음
    await expect(page.getByTestId("de-effect")).toContainText("계획과 같음");
    await page.getByTestId("de-skip").click();
    await expect(page.getByTestId("de-effect")).toContainText("이 날짜만 빠짐으로 표시함. 계획은 바뀌지 않음.");
    await page.getByTestId("de-save").click();
    await expect(cell).toHaveText("─");
    await expect(page.getByTestId("cell-P01-2026-09-18")).toHaveText("■");   // 다른 날짜 불변
    await expect(cell).toBeFocused();                                        // 포커스는 떠난 자리로
    await page.keyboard.press("Control+z");
    await expect(cell).toHaveText("■");
  });
  test("인스펙터 참가일 목록에서도 같은 대화상자", async ({ page }) => {
    await toWorkspace(page);
    await page.getByTestId("vendor-V01").click();
    await page.getByTestId("day-row-P01-2026-09-12").click();
    await expect(page.getByTestId("de-save")).toBeVisible();
    await expect(page.getByText("2026. 9. 12.(토)", { exact: true })).toBeVisible();
  });
});

test.describe("F5 복원", () => {
  test("고르기만 해서는 불변, 미리보기 뒤 실행, 복원 취소", async ({ page }) => {
    await toWorkspace(page);
    await expect(page.getByTestId("cell-P01-2026-10-10")).toHaveText("─");   // X01
    await page.getByTestId("open-restore").click();
    await expect(page.getByTestId("rs-run")).toBeDisabled();
    await page.getByTestId("rs-B2").click();
    await expect(page.getByTestId("cell-P01-2026-10-10")).toHaveText("─");   // 선택만으로 불변
    await expect(page.getByTestId("rs-run")).toBeEnabled();
    await expect(page.getByText("그날만 변경")).toBeVisible();
    await page.getByTestId("rs-run").click();
    await expect(page.getByText("복원함 ㆍ 어제 02:00")).toBeVisible();
    await expect(page.getByTestId("cell-P01-2026-10-10")).toHaveText("■");   // X01 사라짐
    await page.getByRole("button", { name: "복원 취소 (보관본으로 되돌리기)" }).click();
    await expect(page.getByTestId("cell-P01-2026-10-10")).toHaveText("─");
  });
});

test.describe("기간표ㆍ뷰", () => {
  test("방향키로 셀 이동, 1/2/3ㆍTㆍF6 단축키", async ({ page }) => {
    await toWorkspace(page);
    await page.getByTestId("cell-P01-2026-09-12").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("cell-P01-2026-09-13")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator(":focus")).toHaveAttribute("data-testid", /^cell-P\d+-2026-09-13$/);
    await page.keyboard.press("1"); await expect(page.getByTestId("view-month")).toBeVisible();
    await page.keyboard.press("2"); await expect(page.getByTestId("view-week")).toBeVisible();
    await page.keyboard.press("3"); await expect(page.getByTestId("view-matrix")).toBeVisible();
    await page.getByRole("button", { name: "다음 달" }).click();
    await expect(page.getByTestId("month-label")).toHaveText("2026년 10월");
    await page.keyboard.press("t");
    await expect(page.getByTestId("month-label")).toHaveText("2026년 9월");
    await page.keyboard.press("F6"); await expect(page.getByTestId("inspector-event")).toBeHidden();
    await page.keyboard.press("F6"); await expect(page.getByTestId("inspector-event")).toBeVisible();
  });
  test("월간은 업체명을 숨기지 않는다(+N 없음), 오늘 셀은 배지 아님", async ({ page }) => {
    await toWorkspace(page);
    await page.keyboard.press("1");
    const sat = page.getByTestId("day-2026-09-12");
    await expect(sat).toContainText("거류우리밀");
    await expect(sat).toContainText("회화양봉");
    await expect(page.getByText(/\+\d+ more|외 \d+/)).toHaveCount(0);
    await expect(page.getByTestId("day-2026-09-24")).toContainText("24");
  });
  test("회신 토글은 즉시 반영되고 되돌릴 수 있다", async ({ page }) => {
    await toWorkspace(page);
    const chk = page.locator('[data-testid^="reply-"]', { hasText: "□" }).first();
    const id = await chk.getAttribute("data-testid");
    await chk.click();
    await expect(page.getByTestId(id!)).toHaveText("■");
    await page.getByTestId("undo").click();
    await expect(page.getByTestId(id!)).toHaveText("□");
  });
  test("CSV 내려받기: 기계용 가운뎃점(U+00B7), 화면용(U+318D) 아님", async ({ page }) => {
    await toWorkspace(page);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-csv").click()]);
    // 파일명: 이 헤드리스 Chromium 은 한글 download 속성을 "download" 로 바꾼다(ASCII 는 그대로). 제품(Tauri)은 네이티브 저장 대화상자 → 미검증(Linux 작성)
    const body = fs.readFileSync((await dl.path())!, "utf8");
    expect(body).toContain("고성수산");
    expect(body).not.toContain("ㆍ");
    expect(body.split("\r\n")[0]).toContain("업체,9. 12.");
  });
});
