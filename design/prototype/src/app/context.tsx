/* 앱 상태 — 레이어(0 위젯 → 1 오늘 → 2 작업공간 + 3 인스펙터), 선택, 대화상자, 되돌리기 토스트.
   공개 리듬(독트린): 앞으로 = 클릭/Enter 1회, 뒤로 = Esc 1회, 포커스는 떠난 자리로. */
import React from "react";
import { useToastController, Toast, ToastTitle, ToastBody, ToastTrigger, Link } from "@fluentui/react-components";
import { Store, useDB } from "../domain/store";
import type { DB, LocalDate } from "../domain/types";
import { TODAY } from "../fixtures/sample-data";

export type View = "month" | "week" | "matrix";
export type Dialog =
  | { kind: "quickAdd" }
  | { kind: "vendor" }
  | { kind: "planEdit"; planId: string }
  | { kind: "dayException"; planId: string; date: LocalDate }
  | { kind: "restore" }
  | null;
export interface Selection { date: LocalDate; vendorId?: string; eventId?: string; taskId?: string; }

export interface AppState {
  layer: 0 | 1 | 2;
  view: View;
  month: string;
  selection: Selection;
  inspectorOpen: boolean;
  dialog: Dialog;
  widget: "locked" | "edit";
  clickThrough: boolean;
  restoredFrom: string | null;
}
export type Action =
  | { type: "layer"; layer: 0 | 1 | 2 }
  | { type: "view"; view: View }
  | { type: "month"; month: string }
  | { type: "select"; selection: Partial<Selection> }
  | { type: "inspector"; open: boolean }
  | { type: "dialog"; dialog: Dialog }
  | { type: "widget"; widget: AppState["widget"] }
  | { type: "clickThrough"; on: boolean }
  | { type: "restored"; from: string | null };

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "layer": return { ...s, layer: a.layer };
    case "view": return { ...s, view: a.view };
    case "month": return { ...s, month: a.month };
    case "select": return { ...s, selection: { ...s.selection, ...a.selection }, inspectorOpen: s.layer === 2 ? true : s.inspectorOpen };
    case "inspector": return { ...s, inspectorOpen: a.open };
    case "dialog": return { ...s, dialog: a.dialog };
    case "widget": return { ...s, widget: a.widget };
    case "clickThrough": return { ...s, clickThrough: a.on };
    case "restored": return { ...s, restoredFrom: a.from };
  }
}
export const initialState: AppState = {
  layer: 0, view: "matrix", month: TODAY.slice(0, 7),
  selection: { date: TODAY, eventId: "E1" }, inspectorOpen: true, dialog: null, widget: "locked", clickThrough: false, restoredFrom: null,
};

export interface AppCtx {
  store: Store; db: DB; state: AppState; dispatch: React.Dispatch<Action>; today: LocalDate;
  /** 되돌릴 수 있는 변경의 표준 피드백: 토스트 + 실행 취소(U1). 오류는 여기로 오지 않는다(MessageBar). */
  notify: (message: string, opts?: { undo?: boolean }) => void;
  undo: () => void;
}
const Ctx = React.createContext<AppCtx | null>(null);
export const useApp = () => { const c = React.useContext(Ctx); if (!c) throw new Error("AppProvider 밖"); return c; };

export const TOASTER_ID = "wd-toaster";

export function AppProvider({ store, children }: { store: Store; children: React.ReactNode }) {
  const db = useDB(store);
  const [state, rawDispatch] = React.useReducer(reducer, initialState);
  /* 대화상자를 연 자리(포커스)를 dispatch 시점에 기억하고, 닫히면 그 자리로 돌려놓는다(독트린 공개 리듬: 포커스는 떠난 자리로).
     자식 effect 가 먼저 실행돼 Dialog 가 포커스를 옮긴 뒤라면 늦으므로 effect 가 아니라 dispatch 에서 기록한다. */
  const opener = React.useRef<HTMLElement | null>(null);
  const dispatch = React.useCallback((a: Action) => {
    if (a.type === "dialog" && a.dialog && !opener.current) opener.current = document.activeElement as HTMLElement | null;
    rawDispatch(a);
  }, []);
  React.useEffect(() => {
    if (state.dialog) return;
    const el = opener.current; opener.current = null;
    if (el && el.isConnected) requestAnimationFrame(() => el.focus());
  }, [state.dialog]);
  const { dispatchToast } = useToastController(TOASTER_ID);

  const undo = React.useCallback(() => {
    const label = store.undo();
    if (label) dispatchToast(<Toast><ToastTitle>되돌렸음. {label}</ToastTitle></Toast>, { intent: "info", timeout: 4000 });
  }, [store, dispatchToast]);

  const notify = React.useCallback((message: string, opts?: { undo?: boolean }) => {
    dispatchToast(
      <Toast>
        <ToastTitle action={opts?.undo ? <ToastTrigger><Link onClick={undo}>실행 취소</Link></ToastTrigger> : undefined}>{message}</ToastTitle>
        {opts?.undo ? <ToastBody>Ctrl+Z</ToastBody> : null}
      </Toast>,
      { intent: "success", timeout: 8000, politeness: "polite" },
    );
  }, [dispatchToast, undo]);

  /* 전역 키: Ctrl+Z 되돌리기, Ctrl+N 일정 추가, Ctrl+2 캘린더, Esc 사다리. 한글 조합 중(isComposing/229)은 무시(U5). 단축키는 event.code(한/영 무관). */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ" && !typing) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyN") { e.preventDefault(); dispatch({ type: "dialog", dialog: { kind: "quickAdd" } }); return; }
      if ((e.ctrlKey || e.metaKey) && e.code === "Digit2") { e.preventDefault(); dispatch({ type: "layer", layer: 2 }); return; }
      if (e.code === "Escape") {
        if (state.dialog) return;                       // 대화상자는 Fluent가 닫는다(한 단계씩)
        if (state.layer === 2 && state.inspectorOpen) { dispatch({ type: "inspector", open: false }); return; }
        if (state.layer === 2) { dispatch({ type: "layer", layer: 1 }); return; }
        if (state.layer === 1) { dispatch({ type: "layer", layer: 0 }); return; }
      }
      if (typing || state.dialog || e.ctrlKey || e.metaKey || e.altKey) return;
      if (state.layer === 2) {
        if (e.code === "Digit1") dispatch({ type: "view", view: "month" });
        else if (e.code === "Digit2") dispatch({ type: "view", view: "week" });
        else if (e.code === "Digit3") dispatch({ type: "view", view: "matrix" });
        else if (e.code === "KeyT") { dispatch({ type: "month", month: TODAY.slice(0, 7) }); dispatch({ type: "select", selection: { date: TODAY } }); }
        else if (e.code === "F6") { e.preventDefault(); dispatch({ type: "inspector", open: !state.inspectorOpen }); }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [state.dialog, state.layer, state.inspectorOpen, undo]);

  const value = React.useMemo<AppCtx>(() => ({ store, db, state, dispatch, today: TODAY, notify, undo }), [store, db, state, notify, undo]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
