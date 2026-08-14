#!/usr/bin/env node
/**
 * assets/app-icon.svg -> src-tauri/icons/ 아이콘 세트 생성.
 *
 * Tauri 2 Windows/NSIS 번들러는 icon.ico 를 요구한다(16/24/32/48/64/256 레이어).
 * 개발 PC에 Rust 툴체인이 있으면 `cargo tauri icon assets/app-icon.svg` 가 같은 일을 한다.
 * 이 스크립트는 Rust 없이도 아이콘을 재생성할 수 있게 하는 대체 경로다.
 *
 * 실행:
 *   npm install --no-save sharp png-to-ico
 *   node tools/make-icons.mjs
 *
 * 생성물은 저장소에 커밋되므로 평소 빌드에는 이 스크립트가 필요 없다.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'assets/app-icon.svg');
const outDir = resolve(root, 'src-tauri/icons');

const PNGS = [
  ['32x32.png', 32],
  ['128x128.png', 128],
  ['128x128@2x.png', 256],
  ['icon.png', 512],
  ['Square44x44Logo.png', 44],
  ['Square89x89Logo.png', 89],
  ['Square107x107Logo.png', 107],
  ['Square142x142Logo.png', 142],
  ['Square150x150Logo.png', 150],
  ['Square284x284Logo.png', 284],
  ['Square310x310Logo.png', 310],
  ['StoreLogo.png', 50],
];

// Windows 는 .ico 안에서 이 크기들을 골라 쓴다.
const ICO_SIZES = [16, 24, 32, 48, 64, 256];

const { default: sharp } = await import('sharp');
const { default: pngToIco } = await import('png-to-ico');

await mkdir(outDir, { recursive: true });

const render = (size) => sharp(src, { density: 512 }).resize(size, size).png().toBuffer();

for (const [name, size] of PNGS) {
  await writeFile(resolve(outDir, name), await render(size));
}

const icoLayers = [];
for (const size of ICO_SIZES) icoLayers.push(await render(size));
await writeFile(resolve(outDir, 'icon.ico'), await pngToIco(icoLayers));

console.log(`icons written to ${outDir}: ${PNGS.length} png + icon.ico (${ICO_SIZES.join('/')})`);
