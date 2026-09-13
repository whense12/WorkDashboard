/* 레이어 라우터. L0 위젯은 바탕화면 물건이라 항상 고정 위치. L1은 위젯이 펼쳐진 것(같은 자리 위로). L2는 창 전체.
   브라우저에서는 창을 만들 수 없으므로 L2가 화면을 대신하고 위젯은 그 뒤에 있는 것으로 본다(감춤). */
import { Toaster, makeStyles, tokens, Button } from "@fluentui/react-components";
import { AppProvider, useApp, TOASTER_ID } from "./context";
import { Store } from "../domain/store";
import { makeDB } from "../fixtures/sample-data";
import { Widget } from "./Widget";
import { Today } from "./Today";
import { Workspace } from "./Workspace";
import { DialogHost } from "./dialogs/DialogHost";
import { C } from "./copy";

const useStyles = makeStyles({
  desktop: { minHeight: "100vh", backgroundColor: tokens.colorNeutralBackground4, position: "relative" },
  widgetSlot: { position: "fixed", right: "24px", bottom: "24px", zIndex: 5, display: "flex", flexDirection: "column", alignItems: "flex-end", rowGap: "6px" },
  panelSlot: { position: "fixed", right: "24px", bottom: "172px", zIndex: 6 },
  tray: { display: "flex", columnGap: "4px" },
});

const store = new Store(makeDB());

function Shell() {
  const s = useStyles();
  const { state, dispatch } = useApp();
  if (state.layer === 2) return <><Workspace /><DialogHost /><Toaster toasterId={TOASTER_ID} position="bottom-end" /></>;
  return (
    <div className={s.desktop} data-testid="desktop">
      {state.layer === 1 && <div className={s.panelSlot}><Today /></div>}
      <div className={s.widgetSlot}>
        <Widget />
        {/* 트레이 대역: 실제로는 트레이 메뉴. 브라우저에서는 위젯 아래 명령 3개 */}
        <div className={s.tray} role="group" aria-label="트레이">
          <Button size="small" appearance="subtle" onClick={() => dispatch({ type: "clickThrough", on: !state.clickThrough })} data-testid="tray-click-through">
            {state.clickThrough ? "클릭 통과 끄기" : "클릭 통과 켜기"}
          </Button>
          <Button size="small" appearance="subtle" onClick={() => dispatch({ type: "widget", widget: state.widget === "edit" ? "locked" : "edit" })}>
            {state.widget === "edit" ? "위치 저장" : "위치 조정"}
          </Button>
          <Button size="small" appearance="subtle" onClick={() => dispatch({ type: "layer", layer: 2 })}>{C.layer1.openCalendar}</Button>
        </div>
      </div>
      <DialogHost />
      <Toaster toasterId={TOASTER_ID} position="bottom-end" />
    </div>
  );
}
export function App() { return <AppProvider store={store}><Shell /></AppProvider>; }
