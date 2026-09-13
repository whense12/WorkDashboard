import React from "react";
import { useApp } from "../context";
import { QuickAdd } from "./QuickAdd";
import { VendorRegister } from "./VendorRegister";
import { PlanEdit } from "./PlanEdit";
import { DayException } from "./DayException";
import { Restore } from "./Restore";

export function DialogHost() {
  const { state, dispatch } = useApp();
  const close = React.useCallback(() => dispatch({ type: "dialog", dialog: null }), [dispatch]);
  const d = state.dialog;
  if (!d) return null;
  switch (d.kind) {
    case "quickAdd": return <QuickAdd onClose={close} />;
    case "vendor": return <VendorRegister onClose={close} />;
    case "planEdit": return <PlanEdit planId={d.planId} onClose={close} />;
    case "dayException": return <DayException planId={d.planId} date={d.date} onClose={close} />;
    case "restore": return <Restore onClose={close} />;
  }
}
