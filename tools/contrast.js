// WCAG AA contrast gate for the text/background pairs the site uses. Reads the :root tokens so a changed hex is rechecked.
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'site.css'), 'utf8');
const t = {};
for (const m of css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) t[m[1]] = m[2];

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [label, text, background, minimum ratio]. 4.5 for body text, 3 for large text and UI borders.
const pairs = [
  ['body on white', t.ink, t.white, 4.5],
  ['soft text on white', t['ink-soft'], t.white, 4.5],
  ['soft text on mist', t['ink-soft'], t.mist, 4.5],
  ['navy heading on mist', t.navy, t.mist, 4.5],
  ['link blue on white', t.blue, t.white, 4.5],
  ['link blue on mist', t.blue, t.mist, 4.5],
  ['eyebrow blue on white', t.blue, t.white, 4.5],
  ['white on navy', t.white, t.navy, 4.5],
  ['gold on navy', t.gold, t.navy, 4.5],
  ['navy on gold button', t.navy, t.gold, 4.5],
  ['white on navy-soft', t.white, t['navy-soft'], 4.5],
  ['cyan on navy', t.cyan, t.navy, 4.5],
  ['footer legal on navy', '#9fb3c6', t.navy, 4.5],
  ['rise notice text on band', '#0b5560', '#e1f4f7', 4.5],
  ['navy on gold-fill hover', t.navy, t.gold, 4.5],
  ['navy on champagne hover (Home)', t.navy, '#f3e3b8', 4.5],
  ['gold footer/brand hover on navy', t.gold, t.navy, 4.5],
  ['hero/stat copy on navy', '#cfdbe7', t.navy, 4.5],
  ['stat before-text on navy', '#8aa0b6', t.navy, 4.5],
  ['fine print on navy', '#b6c7d8', t.navy, 4.5],
  ['tag live', '#6b4d0f', '#fbf1da', 4.5],
  ['tag in development', '#0b5560', '#e1f4f7', 4.5],
  ['phase number navy on cyan', t.navy, t.cyan, 4.5],
  ['cyan eyebrow on navy', t.cyan, t.navy, 4.5],
  ['focus ring blue on white (UI)', t.blue, t.white, 3],
  ['focus ring blue on mist (UI)', t.blue, t.mist, 3],
  ['focus ring cyan on navy (UI)', t.cyan, t.navy, 3],
];

let bad = 0;
for (const [label, fg, bg, min] of pairs) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) bad++;
  console.log((ok ? 'ok   ' : 'FAIL ') + r.toFixed(2).padStart(5) + ' (min ' + min + ')  ' + label + '  ' + fg + ' on ' + bg);
}
process.exit(bad ? 1 : 0);
