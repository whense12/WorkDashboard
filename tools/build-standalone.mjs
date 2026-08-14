#!/usr/bin/env node
/**
 * frontend/ 를 단일 원본으로 삼아 단독 실행 HTML 을 생성한다.
 *
 *   frontend/index.html  + styles.css + core.js + app.js    -> web_standalone.html
 *   frontend/helper.html + styles.css + core.js + helper.js -> helper_preview.html
 *
 * 왜 필요한가: 이전에는 core.js(11KB) 가 frontend/, web_standalone.html,
 * helper_preview.html 세 곳에 그대로 복제돼 있었다. 한 곳을 고치면 나머지 둘이 조용히
 * 어긋난다. 생성물을 커밋하고 CI 에서 `git diff --exit-code` 로 드리프트를 막는다.
 *
 *   npm run build:standalone
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fe = join(root, 'frontend');
const read = (name) => readFile(join(fe, name), 'utf8');

const BANNER = `<!--
  이 파일은 tools/build-standalone.mjs 가 frontend/ 에서 생성한 결과물입니다.
  직접 수정하지 마세요. frontend/ 를 고친 뒤 npm run build:standalone 을 실행하세요.
-->
`;

/** <link rel=stylesheet> 와 <script src> 를 실제 내용으로 치환한다. */
async function inline(htmlName, scripts) {
  let html = await read(htmlName);
  const css = await read('styles.css');

  html = html.replace(/<link rel="stylesheet" href="styles\.css">/, `<style>\n${css}\n</style>`);
  if (html.includes('styles.css')) throw new Error(`${htmlName}: styles.css 링크를 치환하지 못했습니다.`);

  for (const src of scripts) {
    const js = await read(src);
    const tag = new RegExp(`<script src="${src.replace('.', '\\.')}"></script>`);
    if (!tag.test(html)) throw new Error(`${htmlName}: <script src="${src}"> 를 찾지 못했습니다.`);
    // </script> 가 JS 문자열 안에 있으면 파서가 조기 종료한다. 실제로 있는지 확인만 하고 막는다.
    if (/<\/script/i.test(js)) throw new Error(`${src}: 문자열 안의 </script> 때문에 인라인할 수 없습니다.`);
    html = html.replace(tag, `<script>\n${js}\n</script>`);
  }
  return BANNER + html;
}

const targets = [
  ['index.html', ['core.js', 'app.js'], 'web_standalone.html'],
  ['helper.html', ['core.js', 'helper.js'], 'helper_preview.html'],
];

for (const [src, scripts, out] of targets) {
  await writeFile(join(root, out), await inline(src, scripts));
  console.log(`generated ${out}  <- frontend/${src} + ${scripts.join(' + ')} + styles.css`);
}
