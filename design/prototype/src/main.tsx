import React from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import { App } from "./app/App";
import { lightTheme, darkTheme } from "./theme";
import "./global.css";

/* 부서 양식 표 색: 머리행 #D9D9D9 · 문항행 #F2F2F2 · 주말 머리 한 단 어둡게. 다크는 같은 역할의 어두운 단계 */
const LIGHT_FORM = { "--wd-head": "oklch(0.876 0 0)", "--wd-head-sat": "oklch(0.82 0.004 260)", "--wd-sub": "oklch(0.955 0 0)" };
const DARK_FORM  = { "--wd-head": "oklch(0.32 0.006 260)", "--wd-head-sat": "oklch(0.37 0.01 260)", "--wd-sub": "oklch(0.25 0.006 260)" };

function Root() {
  const [dark, setDark] = React.useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", on); return () => mq.removeEventListener("change", on);
  }, []);
  return (
    <FluentProvider theme={dark ? darkTheme : lightTheme} style={{ minHeight: "100vh", ...(dark ? DARK_FORM : LIGHT_FORM) as React.CSSProperties }}>
      <App />
    </FluentProvider>
  );
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Root /></React.StrictMode>);
