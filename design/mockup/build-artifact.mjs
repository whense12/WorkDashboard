/* index.html → dist/artifact.html (Artifact 퍼블리시용)
 * 아티팩트는 <!doctype>/<html>/<head>/<body>를 호스트가 감싸므로 본문만 남기고,
 * CSS는 <style>로 인라인한다(본문 <link>는 보장되지 않음). JS는 보조 파일로 같이 올린다.
 * index.html을 손으로 복사하지 않고 생성해 드리프트를 막는다. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(resolve(here, f), "utf8");

const html = read("index.html");
const rootAttrs = /<html([^>]*)>/.exec(html)[1];
const dataset = {};
rootAttrs.replace(/data-([a-z]+)="([^"]*)"/g, (_, k, v) => { dataset[k] = v; return ""; });
/* theme은 심지 않는다 — 스탬프가 없어야 뷰어의 시스템 테마(prefers-color-scheme)를 따른다.
 * 제어 막대의 라이트/다크 버튼을 누르면 그때 명시 스탬프가 붙어 그쪽이 이긴다. */
delete dataset.theme;
const body = html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>"))
  .replace(/<script src="[^"]*"><\/script>\s*/g, "");

const out = `<title>직거래 일정관리 시안</title>
<style>
${read("tokens.css")}
${read("base.css")}
</style>
${body}
<script>
/* 아티팩트에서는 <html>을 호스트가 만들므로 초기 상태를 여기서 심는다 */
(function () {
  var d = ${JSON.stringify(dataset)};
  for (var k in d) if (!document.documentElement.hasAttribute("data-" + k)) document.documentElement.setAttribute("data-" + k, d[k]);
})();
<\/script>
<script src="fixtures.js"><\/script>
<script src="expand.js"><\/script>
<script src="app.js"><\/script>
`;
mkdirSync(resolve(here, "dist"), { recursive: true });
writeFileSync(resolve(here, "dist/artifact.html"), out);
console.log("dist/artifact.html " + (out.length / 1024).toFixed(0) + "KB · 루트 기본 상태 " + JSON.stringify(dataset));
