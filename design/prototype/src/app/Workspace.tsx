/* Layer 2 — 캘린더 작업공간. 창을 채운다. 좌 행사 목록 / 명령 행 1줄 / 뷰 / 우 인스펙터(InlineDrawer). 햄버거ㆍmax-widthㆍ페이지네이션 없음. */
import { Button, TabList, Tab, InlineDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody, Tooltip, makeStyles, tokens, mergeClasses, MessageBar, MessageBarBody, MessageBarActions } from "@fluentui/react-components";
import { ChevronLeft20Regular, ChevronRight20Regular, PanelRightContract20Regular, PanelRightExpand20Regular, Dismiss20Regular, ArrowUndo20Regular, Add20Regular, Table20Regular, CalendarLtr20Regular, CalendarWorkWeek20Regular } from "@fluentui/react-icons";
import { useApp, type View } from "./context";
import { useLayout, useType } from "./styles";
import { MonthView } from "./views/MonthView";
import { WeekView } from "./views/WeekView";
import { MatrixView } from "./views/MatrixView";
import { Inspector } from "./Inspector";
import { shiftMonth } from "../domain/date";
import { dateMD } from "../domain/format";
import { byId } from "../domain/derived";
import { FONT_MYEONGJO } from "../theme";
import { C } from "./copy";

const useStyles = makeStyles({
  evHead: { fontFamily: FONT_MYEONGJO, fontSize: "12px", lineHeight: "16px", color: tokens.colorNeutralForeground2, paddingLeft: "14px", paddingBottom: "8px" },
  ev: { display: "block", width: "100%", textAlign: "left", backgroundColor: "transparent", border: "0", paddingTop: "8px", paddingBottom: "8px", paddingLeft: "14px", paddingRight: "14px", cursor: "pointer", color: tokens.colorNeutralForeground1, fontFamily: "inherit", fontSize: "14px", lineHeight: "20px",
    transitionProperty: "background-color", transitionDuration: tokens.durationFast, ":hover": { backgroundColor: tokens.colorNeutralBackground3 },
    ":focus-visible": { outlineWidth: "2px", outlineStyle: "solid", outlineColor: tokens.colorStrokeFocus2, outlineOffset: "-2px" } },
  evCur: { backgroundColor: tokens.colorNeutralBackground1, boxShadow: `inset 0 0 0 1px ${tokens.colorNeutralStroke1}` },
  evPd: { display: "block", fontSize: "12px", lineHeight: "16px", color: tokens.colorNeutralForeground3, fontWeight: 400 },
  monthLabel: { fontFamily: "inherit", fontSize: "16px", lineHeight: "22px", minWidth: "8ch", textAlign: "center" },
  sideFoot: { marginTop: "16px", paddingTop: "12px", paddingLeft: "14px", paddingRight: "14px", borderTop: `1px solid ${tokens.colorNeutralStroke2}`, display: "grid", rowGap: "4px" },
});

export function Workspace() {
  const s = useStyles(); const L = useLayout(); const ty = useType();
  const { db, state, dispatch, store, notify, today } = useApp();
  const ev = byId(db.events, state.selection.eventId) ?? db.events[0];
  const sel = state.selection;
  const inspectorTitle = byId(db.tasks, sel.taskId)?.title ?? byId(db.vendors, sel.vendorId)?.name ?? byId(db.events, sel.eventId)?.name ?? "선택 없음";
  const [ym] = [state.month];

  return (
    <div className={L.shell} data-testid="layer2">
      <nav className={L.side} aria-label="행사">
        <div className={s.evHead}>행사</div>
        {db.events.map((e) => (
          <button key={e.id} type="button" className={mergeClasses(s.ev, e.id === ev.id && s.evCur)} aria-current={e.id === ev.id ? "true" : undefined} data-testid={`event-${e.id}`}
            onClick={() => { dispatch({ type: "select", selection: { eventId: e.id, vendorId: undefined, taskId: undefined, date: e.start_date > today ? e.start_date : today } }); dispatch({ type: "month", month: (e.start_date > today ? e.start_date : today).slice(0, 7) }); }}>
            {e.name}<span className={s.evPd}>{dateMD(e.start_date)}~{dateMD(e.end_date)}</span>
          </button>
        ))}
        <div className={s.sideFoot}>
          <Button appearance="subtle" size="small" icon={<Add20Regular />} onClick={() => dispatch({ type: "dialog", dialog: { kind: "vendor" } })} data-testid="add-vendor">업체 등록</Button>
          <Button appearance="subtle" size="small" onClick={() => dispatch({ type: "dialog", dialog: { kind: "restore" } })} data-testid="open-restore">보관본에서 복원</Button>
          <Button appearance="subtle" size="small" onClick={() => dispatch({ type: "layer", layer: 1 })} data-testid="to-widget">위젯으로</Button>
        </div>
      </nav>

      <div className={L.main}>
        <div className={L.content}>
          <div className={L.cmdRow}>
            <TabList selectedValue={state.view} onTabSelect={(_, d) => dispatch({ type: "view", view: d.value as View })} size="small">
              <Tab value="month" icon={<CalendarLtr20Regular />}>{C.views.month}</Tab>
              <Tab value="week" icon={<CalendarWorkWeek20Regular />}>{C.views.week}</Tab>
              <Tab value="matrix" icon={<Table20Regular />}>{C.views.matrix}</Tab>
            </TabList>
            <Tooltip content={C.views.prev} relationship="label"><Button size="small" appearance="subtle" icon={<ChevronLeft20Regular />} onClick={() => dispatch({ type: "month", month: shiftMonth(ym, -1) })} /></Tooltip>
            <span className={mergeClasses(s.monthLabel, ty.num)} data-testid="month-label">{+ym.slice(0, 4)}년 {+ym.slice(5, 7)}월</span>
            <Tooltip content={C.views.next} relationship="label"><Button size="small" appearance="subtle" icon={<ChevronRight20Regular />} onClick={() => dispatch({ type: "month", month: shiftMonth(ym, 1) })} /></Tooltip>
            <Tooltip content="오늘로 이동 (T)" relationship="description"><Button size="small" onClick={() => { dispatch({ type: "month", month: today.slice(0, 7) }); dispatch({ type: "select", selection: { date: today } }); }}>{C.views.today}</Button></Tooltip>
            <span className={L.spacer} />
            <Tooltip content="되돌리기 (Ctrl+Z)" relationship="label"><Button size="small" appearance="subtle" icon={<ArrowUndo20Regular />} disabled={!store.canUndo} onClick={() => { const l = store.undo(); if (l) notify(`${C.toast.undone} ${l}`); }} data-testid="undo" /></Tooltip>
            <Tooltip content={`${state.inspectorOpen ? C.views.inspectorClose : C.views.inspectorOpen} (F6)`} relationship="label">
              <Button size="small" appearance="subtle" icon={state.inspectorOpen ? <PanelRightContract20Regular /> : <PanelRightExpand20Regular />} onClick={() => dispatch({ type: "inspector", open: !state.inspectorOpen })} data-testid="toggle-inspector" />
            </Tooltip>
          </div>
          {state.restoredFrom && (
            <MessageBar intent="info" layout="singleline">
              <MessageBarBody>{C.dialog.restore.bar(state.restoredFrom)}</MessageBarBody>
              <MessageBarActions containerAction={<Button appearance="transparent" icon={<Dismiss20Regular />} onClick={() => dispatch({ type: "restored", from: null })} aria-label="닫기" />}>
                <Button size="small" onClick={() => { store.undo(); dispatch({ type: "restored", from: null }); notify(C.toast.undone); }}>{C.dialog.restore.undo}</Button>
              </MessageBarActions>
            </MessageBar>
          )}
          <div className={L.viewArea} data-testid={`view-${state.view}`}>
            {state.view === "month" ? <MonthView /> : state.view === "week" ? <WeekView /> : <MatrixView />}
          </div>
        </div>
        <InlineDrawer open={state.inspectorOpen} position="end" separator style={{ width: 400, flexShrink: 0 }}>
          <DrawerHeader>
            <DrawerHeaderTitle action={<Button appearance="subtle" aria-label={C.views.inspectorClose} icon={<Dismiss20Regular />} onClick={() => dispatch({ type: "inspector", open: false })} />}>
              <span className={ty.title} data-testid="inspector-title">{inspectorTitle}</span></DrawerHeaderTitle>
          </DrawerHeader>
          <DrawerBody><Inspector /></DrawerBody>
        </InlineDrawer>
      </div>
    </div>
  );
}
