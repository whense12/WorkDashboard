/* 기간표 — 업체 × 운영일. 명세 §3 "업체 20~30곳이면 주력 보조 view". 부서 양식의 일반형 표 문법(머리행 음영, 괘선).
   셀 = ■ 참가 / □ 회신 없음 / ─ 그날만 빠짐. 셀 클릭ㆍSpace = '이 날짜만 수정' 대화상자(즉시 저장 아님, ux-acceptance F4).
   role=grid + 방향키(셀이 상호작용하므로 grid가 맞음, accessibility.md). */
import React from "react";
import { Button, makeStyles, tokens, mergeClasses } from "@fluentui/react-components";
import { ArrowDownload20Regular } from "@fluentui/react-icons";
import { useApp } from "../context";
import { useDoc, useMark, useType } from "../styles";
import { byId, eventDays, plansOfEvent, eventSummary, weekdayChars } from "../../domain/derived";
import { comesOn, plannedOn } from "../../domain/expandPlan";
import { weekdayISO } from "../../domain/date";
import { dateFull, dateMD, period, MID_CSV } from "../../domain/format";
import { C } from "../copy";

const useStyles = makeStyles({
  cmd: { display: "flex", alignItems: "center", columnGap: "8px", marginTop: "10px", flexWrap: "wrap" },
  legend: { fontSize: "12px", lineHeight: "16px", color: tokens.colorNeutralForeground2, marginRight: "auto" },
  chk: { backgroundColor: "transparent", border: "0", cursor: "pointer", padding: "0 2px", fontSize: "14px", color: "inherit", fontFamily: "inherit" },
  empty: { paddingTop: "28px", paddingBottom: "28px", fontSize: "14px", lineHeight: "20px", color: tokens.colorNeutralForeground2 },
});

export function MatrixView() {
  const s = useStyles(); const D = useDoc(); const M = useMark(); const ty = useType();
  const { db, state, dispatch, store, notify } = useApp();
  const ev = byId(db.events, state.selection.eventId) ?? db.events[0];
  const ps = plansOfEvent(db, ev.id).slice().sort((a, b) => byId(db.vendors, a.vendor_id)!.name.localeCompare(byId(db.vendors, b.vendor_id)!.name, "ko"));
  const days = eventDays(db, ev);
  const tableRef = React.useRef<HTMLTableElement>(null);

  const onKey = (e: React.KeyboardEvent<HTMLTableElement>) => {
    const cell = e.target as HTMLElement;
    if (cell.getAttribute("role") !== "gridcell") return;
    const tr = cell.parentElement!, idx = Array.prototype.indexOf.call(tr.children, cell), tb = tr.parentElement!, ri = Array.prototype.indexOf.call(tb.children, tr);
    let next: Element | null = null;
    if (e.code === "ArrowRight") next = tr.children[idx + 1]; else if (e.code === "ArrowLeft") next = tr.children[idx - 1];
    else if (e.code === "ArrowDown") next = tb.children[ri + 1]?.children[idx] ?? null; else if (e.code === "ArrowUp") next = tb.children[ri - 1]?.children[idx] ?? null;
    else if (e.code === "Home") next = tr.children[1]; else if (e.code === "End") next = tr.children[tr.children.length - 3];
    if (next && next.getAttribute("role") === "gridcell") { (cell as HTMLElement).tabIndex = -1; (next as HTMLElement).tabIndex = 0; (next as HTMLElement).focus(); e.preventDefault(); }
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [["업체", ...days.map(dateMD), "일수", "비고"]];
    for (const p of ps) { const v = byId(db.vendors, p.vendor_id)!; let n = 0; const row: (string | number)[] = [v.name];
      for (const d of days) { const on = comesOn(p, db.exceptions, d); if (on) n++; row.push(on ? (p.status === "confirmed" ? "O" : "?") : ""); }
      const ex = db.exceptions.filter((x) => x.participation_plan_id === p.id).map((x) => `${dateMD(x.date)} ${x.type === "include" ? "나옴" : "빠짐"}`).join(` ${MID_CSV} `);
      row.push(n, ex); rows.push(row); }
    const body = rows.map((r) => r.map((c) => /[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c)).join(",")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" })); a.download = `${ev.name}_운영표.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    notify(C.matrix.exported);
  };

  return (
    <div data-testid="matrix">
      <h1 className={D.docTitle}>{ev.name} 참가업체 운영표</h1>
      <p className={D.lead}>❖ {eventSummary(db, ev)}</p>
      <dl className={D.meta}>
        <dt className={D.metaLabel}>기&nbsp;&nbsp;간</dt><dd>{days.length ? period(days[0], days[days.length - 1], days.length) : period(ev.start_date, ev.end_date)}</dd>
        <dt className={D.metaLabel}>장&nbsp;&nbsp;소</dt><dd>{ev.location}</dd>
        <dt className={D.metaLabel}>운영일</dt><dd>{days.length ? `${weekdayChars(days)}요일` : "없음"}</dd>
      </dl>
      {ps.length === 0 ? <p className={s.empty}>{C.matrix.empty}</p> : (
      <>
      <div className={D.tableWrap}>
        <table role="grid" aria-label={`${ev.name} 업체 × 날짜 운영표`} className={D.table} ref={tableRef} onKeyDown={onKey}>
          <colgroup><col style={{ width: 212 }} />{days.map((d) => <col key={d} style={{ width: 26 }} />)}<col style={{ width: 44 }} /><col style={{ width: 108 }} /></colgroup>
          <thead>
            <tr>
              <th rowSpan={2} className={mergeClasses(D.th, D.thLeft)} scope="col">{C.matrix.vendorCol}</th>
              {(() => { const out: React.ReactNode[] = []; let m = -1, span = 0;
                days.forEach((d, i) => { const mo = +d.slice(5, 7); if (mo !== m) { if (span) out.push(<th key={`m${i}`} colSpan={span} className={D.th}>{m}월</th>); m = mo; span = 1; } else span++; });
                if (span) out.push(<th key="mlast" colSpan={span} className={D.th}>{m}월</th>); return out; })()}
              <th rowSpan={2} className={D.th} scope="col">{C.matrix.days}</th>
              <th rowSpan={2} className={mergeClasses(D.th, D.thLeft)} scope="col">{C.matrix.memo}</th>
            </tr>
            <tr>{days.map((d) => { const wd = weekdayISO(d); return <th key={d} scope="col" className={mergeClasses(D.th, wd >= 6 && D.thSat, wd === 1 && D.tdWeekStart)} title={dateFull(d)} aria-label={dateFull(d)}>{+d.slice(8, 10)}<br />{["월","화","수","목","금","토","일"][wd - 1]}</th>; })}</tr>
          </thead>
          <tbody>
            {ps.map((p, pi) => { const v = byId(db.vendors, p.vendor_id)!; let n = 0;
              const memo = db.exceptions.filter((x) => x.participation_plan_id === p.id).sort((a, b) => a.date.localeCompare(b.date)).map((x) => `${dateMD(x.date)} ${x.type === "include" ? "나옴" : "빠짐"}`).join("ㆍ");
              const selected = state.selection.vendorId === v.id;
              return (
                <tr key={p.id} role="row" aria-selected={selected || undefined}>
                  <th scope="row" className={mergeClasses(D.rowHead, selected && D.rowHeadSel)} title={v.name}>
                    <button type="button" className={s.chk} title={p.status === "confirmed" ? "회신 받음. 누르면 되돌림" : "회신 없음. 누르면 받음으로 표시"} data-testid={`reply-${p.id}`}
                      onClick={() => { const ok = p.status !== "confirmed"; store.setPlanStatus(p.id, ok ? "confirmed" : "needs_confirmation"); notify(C.toast.reply(v.name, ok), { undo: true }); }}>{p.status === "confirmed" ? "■" : "□"}</button>
                    {" "}<button type="button" className={s.chk} style={{ fontSize: 14 }} onClick={() => dispatch({ type: "select", selection: { vendorId: v.id, eventId: ev.id } })} data-testid={`vendor-${v.id}`}>{v.name}</button>
                  </th>
                  {days.map((d, di) => { const on = comesOn(p, db.exceptions, d); if (on) n++; const x = db.exceptions.find((e) => e.participation_plan_id === p.id && e.date === d); const wd = weekdayISO(d);
                    const mark = on ? (p.status === "confirmed" ? "■" : "□") : plannedOn(p, d) ? "─" : "";
                    return (
                      <td key={d} role="gridcell" tabIndex={pi === 0 && di === 0 ? 0 : -1} data-testid={`cell-${p.id}-${d}`}
                        className={mergeClasses(D.td, D.tdDay, wd >= 6 && D.tdSat, wd === 1 && D.tdWeekStart, x && D.tdEx)}
                        title={`${dateFull(d)} ${v.name} ${on ? (x ? C.status.changed : C.status.confirmed) : (x ? C.status.cancelled : "해당 없음")}`}
                        aria-label={`${dateFull(d)} ${v.name} ${on ? "참가" : "참가 없음"}`}
                        onClick={() => dispatch({ type: "dialog", dialog: { kind: "dayException", planId: p.id, date: d } })}
                        onKeyDown={(e) => { if (e.code === "Space") { e.preventDefault(); dispatch({ type: "dialog", dialog: { kind: "dayException", planId: p.id, date: d } }); } if (e.code === "Enter") dispatch({ type: "select", selection: { vendorId: v.id, eventId: ev.id, date: d } }); }}>
                        <span className={mergeClasses(M.mark, !on ? M.cancelled : p.status !== "confirmed" ? M.needs : x ? M.changed : M.confirmed)}>{mark}</span>
                      </td>); })}
                  <td className={mergeClasses(D.td, D.tdNum, ty.num)}>{n}</td>
                  <td className={mergeClasses(D.td, D.tdMemo)} title={memo}>{memo}</td>
                </tr>); })}
          </tbody>
        </table>
      </div>
      <div className={s.cmd}>
        <span className={s.legend}>{C.matrix.legend}</span>
        <Button appearance="primary" icon={<ArrowDownload20Regular />} onClick={exportCsv} data-testid="export-csv">{C.matrix.export}</Button>
      </div>
      </>)}
    </div>
  );
}
