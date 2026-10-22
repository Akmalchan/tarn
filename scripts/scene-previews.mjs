// Copyright 2026 The Tarn Authors
// SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0

// Renders every scene's settings thumbnail into public/scenes/<id>.webp and
// its full-screen still into public/stills/<id>.webp, using the real
// shaders. Run after adding or changing a scene:
//
//   CHROME=/path/to/chrome node scripts/scene-previews.mjs
//
// Needs a Chrome or Chromium binary; nothing is downloaded.

import {spawn} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/** The moment (seconds of animation clock) each thumbnail and still shows. */
const MOMENTS = {
  tarn: 5,
  ember: 3,
  bloom: 30,
  wave: 12,
  aurora: 100,
  silk: 40,
  lumen: 20,
  contour: 20,
  clouds: 30,
  topology: 15,
  canopy: 35,
  convergence: 10,
  ribbons: 20,
  fringe: 120,
  nightsky: 40,
  matrix: 45,
};
/** Twice a ~160x100 tile, for sharp thumbnails on 2x screens. */
const WIDTH = 320;
const HEIGHT = 200;
const QUALITY = 0.8;
/**
 * The full-screen still per scene: width (16:10, shown with `cover`) and
 * WebP quality, picked by look per byte (docs/wallpapers.md, "Thumbnails
 * and stills"). Soft scenes look the same small, as their live versions
 * also render at a fraction of the screen. Fine lines need pixels, and at
 * 1920 a lower quality looks sharper than 1600 at 0.8 for the same bytes;
 * faint stars and glyphs (Night Sky, Matrix) vanish below 0.8.
 */
const STILLS = {
  tarn: [1280, 0.8],
  ember: [1600, 0.8],
  bloom: [1280, 0.8],
  wave: [1600, 0.8],
  aurora: [1280, 0.8],
  silk: [1280, 0.8],
  lumen: [1280, 0.8],
  contour: [1920, 0.6],
  clouds: [1280, 0.8],
  topology: [1920, 0.6],
  canopy: [1920, 0.6],
  convergence: [1280, 0.8],
  ribbons: [1600, 0.8],
  fringe: [1280, 0.8],
  nightsky: [1920, 0.8],
  matrix: [1920, 0.8],
};

const chrome = process.env.CHROME;
if (!chrome) throw new Error('Set CHROME to a Chrome or Chromium binary.');

const bundle = await build({
  configFile: false,
  logLevel: 'silent',
  build: {
    write: false,
    minify: false,
    lib: {
      entry: join(root, 'scripts/scene-preview-page.ts'),
      formats: ['iife'],
      name: 'previews',
    },
  },
});
const code = bundle[0].output[0].code;

const port = 9300 + Math.floor(Math.random() * 300);
// A throwaway profile (tens of MB), deleted on exit: left behind, one per
// run, they filled a disk.
const profile = mkdtempSync(join(tmpdir(), 'tarn-previews-'));
process.on('exit', () => {
  browser.kill();
  rmSync(profile, {recursive: true, force: true, maxRetries: 3});
});
const browser = spawn(chrome, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  // macOS: drive frames from a timer, so it works with the display off.
  '--disable-features=CADisplayLinkInGpu,CADisplayLinkInBrowser',
  'about:blank',
]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let target;
for (let i = 0; i < 80 && !target; i++) {
  await sleep(250);
  const list = await fetch(`http://127.0.0.1:${port}/json/list`)
    .then(r => r.json())
    .catch(() => []);
  target = list.find(t => t.type === 'page');
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => (ws.onopen = r));
let nextId = 0;
const pending = new Map();
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  pending.get(m.id)?.(m);
};
const evaluate = expression =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, m =>
      m.result?.exceptionDetails
        ? reject(new Error(m.result.exceptionDetails.exception?.description))
        : resolve(m.result?.result?.value),
    );
    ws.send(
      JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: {expression, returnByValue: true},
      }),
    );
  });

/** Renders one frame and writes it; returns its size in bytes. */
async function render(name, clock, width, height, quality, file) {
  const url = await evaluate(
    `previewScene(${JSON.stringify(name)}, ${clock}, ${width}, ${height}, ${quality})`,
  );
  const bytes = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(file, bytes);
  console.log(`${file}  ${(bytes.length / 1024).toFixed(1)} KB`);
  return bytes.length;
}

try {
  await evaluate(code);
  const ids = process.argv.slice(2).length
    ? process.argv.slice(2)
    : Object.keys(MOMENTS);
  const out = process.env.OUT ?? tmpdir();
  // Candidate still widths to compare, at STILL_QUALITY (default 0.8):
  // `STILLS=1280,1920 STILL_QUALITY=0.6 ... id@seconds`.
  const quality = Number(process.env.STILL_QUALITY ?? 0.8);
  const candidates = (process.env.STILLS ?? '')
    .split(',')
    .filter(Boolean)
    .map(Number);
  for (const dir of ['public/scenes', 'public/stills']) {
    mkdirSync(join(root, dir), {recursive: true});
  }
  let total = 0;
  for (const id of ids) {
    const [name, moment] = id.split('@');
    const clock = Number(moment ?? MOMENTS[name] ?? 20);
    if (moment) {
      await render(
        name,
        clock,
        WIDTH,
        HEIGHT,
        QUALITY,
        join(out, `${id}.webp`),
      );
      for (const w of candidates) {
        await render(
          name,
          clock,
          w,
          (w * 10) / 16,
          quality,
          join(out, `${id}-${w}.webp`),
        );
      }
      continue;
    }
    await render(
      name,
      clock,
      WIDTH,
      HEIGHT,
      QUALITY,
      join(root, 'public/scenes', `${name}.webp`),
    );
    const [w, q] = STILLS[name] ?? [1280, 0.8];
    total += await render(
      name,
      clock,
      w,
      (w * 10) / 16,
      q,
      join(root, 'public/stills', `${name}.webp`),
    );
  }
  if (total) console.log(`stills: ${(total / 1024).toFixed(0)} KB in all`);
} finally {
  ws.close();
  browser.kill();
}
