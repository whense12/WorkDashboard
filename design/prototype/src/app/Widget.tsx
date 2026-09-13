/* Layer 0 — 320×110 고정. 정보 4개(날짜ㆍ몇 곳ㆍ회신 없는 곳ㆍ행사)만. rest에 버튼ㆍ입력ㆍ아이콘 줄ㆍ테두리ㆍ그림자 0.
   주어는 '오늘'이 아니라 다음 운영일 — 9~10월 61일 중 27일은 아무것도 없어 '오늘'은 화면 절반이 빈다. */
import { makeStyles, tokens, mergeClasses, Tooltip } from "@fluentui/react-components";
import { ReOrder16Regular } from "@fluentui/react-icons";
import { useApp } from "./context";
import { nextOperatingDay, participationsOn } from "../domain/derived";
import { dateFull, weekdayLabel } from "../domain/format";
import { FONT_TITLE, FONT_MYEONGJO } from "../theme";
import { C } from "./copy";

const useStyles = makeStyles({
  w: { width: "320px", height: "110px", backgroundColor: tokens.colorNeutralBackground1, border: `1px solid ${tokens.colorNeutralStroke1}`,
    paddingTop: "10px", paddingBottom: "10px", paddingLeft: "14px", paddingRight: "14px",
    display: "grid", gridTemplateColumns: "1fr 2.4fr", columnGap: "12px", alignItems: "start", position: "relative", overflow: "hidden",
    cursor: "pointer", textAlign: "left", color: tokens.colorNeutralForeground1, fontFamily: "inherit",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1 } },
  edit: { outlineWidth: "1px", outlineStyle: "solid", outlineColor: tokens.colorBrandStroke1, outlineOffset: "-1px", cursor: "move" },
  d: { fontFamily: FONT_TITLE, fontSize: "27px", lineHeight: "32px", fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" },
  dw: { fontFamily: FONT_MYEONGJO, fontSize: "12px", lineHeight: "16px", color: tokens.colorNeutralForeground2 },
  r: { minWidth: 0 },
  n: { fontSize: "12px", lineHeight: "17px", color: tokens.colorNeutralForeground2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  big: { fontSize: "16px", lineHeight: "22px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  no: { color: tokens.colorPaletteDarkOrangeForeground1, fontWeight: 700 },
  mode: { position: "absolute", top: 0, left: 0, backgroundColor: tokens.colorBrandBackground, color: tokens.colorNeutralForegroundOnBrand, fontSize: "12px", lineHeight: "16px", paddingLeft: "6px", paddingRight: "6px", paddingTop: "1px", paddingBottom: "1px" },
  handle: { position: "absolute", right: "2px", top: "50%", transform: "translateY(-50%)", color: tokens.colorNeutralForeground3, display: "flex" },
});

export function Widget() {
  const s = useStyles();
  const { db, state, dispatch, today } = useApp();
  const next = nextOperatingDay(db, today);
  const ps = next ? participationsOn(db, next.date, next.event.id).filter((p) => p.state !== "cancelled") : [];
  const noReply = ps.filter((p) => p.state === "needs_attention").length;
  const label = next
    ? `${dateFull(next.date)} ${next.event.name}, ${C.widget.comes(ps.length)}, ${noReply ? C.widget.noReply(noReply) : C.widget.allReplied}`
    : C.widget.none;
  const [m, d] = next ? next.date.split("-").slice(1).map(Number) : [0, 0];

  return (
    <button type="button" className={mergeClasses(s.w, state.widget === "edit" && s.edit)} aria-label={label} data-testid="widget" data-state={state.widget}
      onClick={() => { if (state.clickThrough) return; dispatch({ type: "layer", layer: 1 }); }}
      title={state.clickThrough ? C.widget.clickThrough : undefined}>
      <div>
        {next ? <><div className={s.d}>{m}. {d}.</div><div className={s.dw}>({weekdayLabel(next.date)})</div></> : null}
      </div>
      <div className={s.r}>
        {next ? <>
          <div className={s.n}>{next.event.name}</div>
          <div className={s.big}>{C.widget.comes(ps.length)}</div>
          <div className={s.n}>{noReply ? <span className={s.no}>{C.widget.noReply(noReply)}</span> : C.widget.allReplied}</div>
        </> : <div className={s.big}>{C.widget.none}</div>}
      </div>
      {state.widget === "edit" && <><Tooltip content={C.widget.editTip} relationship="description"><span className={s.mode}>{C.widget.edit}</span></Tooltip><span className={s.handle} aria-hidden="true"><ReOrder16Regular /></span></>}
    </button>
  );
}
