// Regression gate for architecture section 12: shell identical on every page, no stray network references.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pages = ['index', 'business-solutions', 'rise', 'about', 'contact'].map((p) => p + '.html');
const allowedHosts = ['calendar.app.google'];
const problems = [];

function block(html, name) {
  const m = html.match(new RegExp('<!-- shell:' + name + ':start -->([\\s\\S]*?)<!-- shell:' + name + ':end -->'));
  return m ? m[1].replace(/\s*aria-current="page"/g, '').trim() : null;
}

const shells = {};
for (const page of pages) {
  const file = path.join(root, page);
  if (!fs.existsSync(file)) { problems.push(page + ': missing'); continue; }
  const html = fs.readFileSync(file, 'utf8');
  for (const name of ['header', 'footer']) {
    const b = block(html, name);
    if (b === null) { problems.push(page + ': no ' + name + ' markers'); continue; }
    if (shells[name] === undefined) shells[name] = b;
    else if (shells[name] !== b) problems.push(page + ': ' + name + ' differs from index.html');
  }
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>)]+/g)) {
    const host = new URL(m[0]).host;
    if (!allowedHosts.includes(host)) problems.push(page + ': disallowed URL ' + m[0]);
  }
  for (const script of ['js/site.js', 'js/luna-math.js', 'js/luna.js']) {
    if (!html.includes('src="' + script + '"')) problems.push(page + ': missing script ' + script);
  }
  if (!/<html[^>]*\slang="en"/.test(html)) problems.push(page + ': missing lang="en"');
  if (!/<meta name="viewport"/.test(html)) problems.push(page + ': missing viewport meta');
  if (!/<title>[^<]+<\/title>/.test(html)) problems.push(page + ': missing title');
  if (!/<meta name="description" content="[^"]+"/.test(html)) problems.push(page + ': missing meta description');
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  if (levels.filter((l) => l === 1).length !== 1) problems.push(page + ': needs exactly one h1');
  levels.forEach((l, i) => { if (i > 0 && l > levels[i - 1] + 1) problems.push(page + ': heading jumps from h' + levels[i - 1] + ' to h' + l); });
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt="/.test(m[0])) problems.push(page + ': img without alt ' + m[0].slice(0, 60));
    if (!/\swidth="/.test(m[0]) || !/\sheight="/.test(m[0])) problems.push(page + ': img without width/height ' + m[0].slice(0, 60));
  }
  for (const m of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) {
    if (!m[1].replace(/<[^>]*>/g, '').trim()) problems.push(page + ': link with no text ' + m[0].slice(0, 60));
  }
  for (const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const ref = m[1];
    if (/^(https?:|mailto:|tel:)/.test(ref)) continue;
    if (!fs.existsSync(path.join(root, ref))) problems.push(page + ': broken reference ' + ref);
  }
}
for (const asset of ['css/site.css', 'js/site.js', 'js/luna-math.js', 'js/luna.js']) {
  const text = fs.readFileSync(path.join(root, asset), 'utf8');
  if (/https?:\/\/|fetch\(|XMLHttpRequest|@import/.test(text)) problems.push(asset + ': network reference');
  for (const m of text.matchAll(/url\("?([^")]+)"?\)/g)) {
    if (!fs.existsSync(path.join(root, path.dirname(asset), m[1]))) problems.push(asset + ': broken url() ' + m[1]);
  }
}

if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('ok: ' + pages.length + ' pages, shell identical, no disallowed network references, no broken local links');
