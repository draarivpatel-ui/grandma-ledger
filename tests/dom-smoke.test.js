'use strict';
/* Smoke tests for the page: the files, the markup, the rules, and a stand-in page
   that really runs app.js. There is no browser library, so the stand-in is small. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const E = require('../js/engine.js');
const R = require('../render.js').create(E);

const html = read('index.html');
const tokens = read('tokens.css');
const styles = read('styles.css');
const appSource = read('app.js');

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (['.git', 'node_modules', '.hallmark'].includes(entry.name)) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  });
  return out;
}
const TEXT = /\.(html|css|js|json|md|svg|txt|yml|yaml)$/i;
const textFiles = walk(ROOT, []).filter((f) => TEXT.test(f) && f !== path.join(ROOT, 'package-lock.json'));

const idsIn = (text) => [...text.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);

/* ---------- the page markup ---------- */

test('tables never keep the device default gray border, which the two crayon check reads as a third color', () => {
  // Chromium 148's default styles give table, thead, tbody and tr a gray
  // border-color. The live check on aariv.me said "Not yet" in that Chromium until this rule existed.
  assert.match(styles, /table,\s*thead,\s*tbody,\s*tfoot,\s*tr\s*\{\s*border-color:\s*currentColor;\s*\}/);
});

test('the page itself says the four demands were picked by us and that it is not an entry', () => {
  assert.match(html, /Grandma did not hand them out/);
  assert.match(html, /not an entry in Help Grandma Out/);
});

test('the page has a doctype, a language, a title and a viewport', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>Two-Crayon Kitchen &amp; Bill Book<\/title>/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(html, /<meta name="color-scheme" content="only light">/);
});

test('there is exactly one h1 and the headings never skip a level', () => {
  const heads = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  assert.equal(heads.filter((h) => h === 1).length, 1);
  let last = 0;
  heads.forEach((h) => {
    assert.ok(h <= last + 1, 'heading jumped from ' + last + ' to ' + h);
    last = h;
  });
});

test('the page has a skip link and the four landmarks', () => {
  assert.match(html, /<a class="skip[^"]*" href="#kitchen">/);
  ['<header', '<nav', '<main', '<footer'].forEach((tag) => assert.ok(html.includes(tag), tag));
  assert.match(html, /<nav[^>]*aria-label="/);
});

test('every id on the page is unique', () => {
  const ids = idsIn(html);
  assert.equal(new Set(ids).size, ids.length);
});

test('every id that app.js asks for is on the page', () => {
  const ids = new Set(idsIn(html));
  const asked = [...appSource.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]);
  const dynamic = [...appSource.matchAll(/\$\(([a-z]+(?:\[0\])? \+ '[^)]+)\)/g)];
  assert.ok(asked.length > 40);
  asked.forEach((id) => assert.ok(ids.has(id), 'missing id ' + id));
  assert.ok(dynamic.length >= 4);
  ['pf', 'pt'].forEach((p) => ['shape', 'size', 'width', 'height'].forEach((f) => assert.ok(ids.has(p + '-' + f), p + '-' + f)));
});

test('every form box has a label', () => {
  const labelled = new Set([...html.matchAll(/<label[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]));
  const boxes = [...html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)];
  assert.ok(boxes.length > 20);
  boxes.forEach((m) => {
    const id = /\bid="([^"]+)"/.exec(m[2]);
    const wrapped = /type="(radio|checkbox)"/.test(m[2]);
    assert.ok(wrapped || (id && labelled.has(id[1])), 'no label for ' + m[0].slice(0, 60));
  });
});

test('every picture is an icon hidden from readers or a labelled diagram', () => {
  const all = [...html.matchAll(/<svg\b([^>]*)>/g)];
  assert.ok(all.length > 5);
  all.forEach((m) => assert.ok(/aria-hidden="true"/.test(m[1]) || /role="img"[^>]*aria-label=/.test(m[1]), m[0]));
  [R.panFigure({ shape: 'round', size: 9 }, { shape: 'rect', width: 9, height: 13 }, E.panPlan({ shape: 'round', size: 9 }, { shape: 'rect', width: 9, height: 13 })),
    R.settlementFigure(E.settleHouseholdBills({ people: ['A', 'B'], expenses: [{ payer: 'A', cents: 500 }] }))
  ].forEach((svg) => assert.match(svg, /^<svg class="figure" viewBox="[^"]+" role="img" aria-label="[^"]+">/));
});

test('every icon points at a symbol that exists', () => {
  const symbols = new Set([...html.matchAll(/<symbol id="(i-[a-z]+)"/g)].map((m) => m[1]));
  const used = new Set([...html.matchAll(/<use href="#(i-[a-z]+)"/g)].map((m) => m[1]));
  [R.careItemList([{ kind: 'medicine', name: 'A' }, { kind: 'plant', name: 'B' }, { kind: 'pantry', name: 'C' }]),
    R.expenseList([{ label: 'x', payer: 'A', amount: '$1.00', sharedBy: [] }]),
    R.auditRows([{ label: 'a', ok: true, detail: 'x' }, { label: 'b', ok: false, detail: 'x' }, { label: 'c', ok: null, detail: 'x' }])
  ].forEach((part) => [...part.matchAll(/<use href="#(i-[a-z]+)"/g)].forEach((m) => used.add(m[1])));
  assert.ok(used.size >= 6);
  used.forEach((id) => assert.ok(symbols.has(id), 'no symbol ' + id));
});

test('every link to a part of the page lands somewhere', () => {
  const ids = new Set(idsIn(html));
  const links = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]).filter((id) => !id.startsWith('i-'));
  assert.ok(links.length >= 6);
  links.forEach((id) => assert.ok(ids.has(id), 'dead link #' + id));
});

test('the page uses no inline event code and no inline style colors', () => {
  assert.equal(/\son[a-z]+="/.test(html), false);
  assert.equal(/<style/i.test(html), false);
  assert.equal(/\bstyle="/.test(html), false);
});

test('the scripts load in the order they need each other', () => {
  const order = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.deepEqual(order, ['./files.js', './js/engine.js', './share.js', './render.js', './app.js']);
});

/* ---------- the two crayons ---------- */

test('only the two crayon hex codes appear anywhere in the project', () => {
  const found = new Set();
  textFiles.forEach((f) => {
    (fs.readFileSync(f, 'utf8').match(/#[0-9a-fA-F]{6}\b/g) || []).forEach((h) => {
      if (/\.(html|css|json|svg)$/.test(f) || /#(FAF5E8|142850)/i.test(h)) found.add(h.toUpperCase());
    });
  });
  const allowed = new Set(['#FAF5E8', '#142850']);
  found.forEach((h) => assert.ok(allowed.has(h), 'third color ' + h));
  assert.equal(found.size, 2);
});

test('styles.css writes no color at all, only var(--name)', () => {
  const css = styles.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(css), false);
  assert.equal(/\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb|color-mix)\(/i.test(css), false);
  assert.deepEqual(E.auditCss(styles).offenders, []);
  assert.ok(E.auditCss(styles).declarations > 300);
});

test('tokens.css holds the crayons and every shade is ink or paper thinned out', () => {
  assert.match(tokens, /--paper: #FAF5E8;/);
  assert.match(tokens, /--ink: #142850;/);
  const shades = [...tokens.matchAll(/rgba\(([^)]*)\)/g)].map((m) => m[1].split(',').slice(0, 3).map(Number).join(','));
  assert.ok(shades.length >= 10);
  shades.forEach((s) => assert.ok(s === '20,40,80' || s === '250,245,232', s));
  assert.deepEqual(E.auditCss(tokens).offenders, []);
});

test('every var(--name) in the styles and the page is defined', () => {
  const defined = new Set([...(tokens + styles).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...(styles + html).matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
  assert.ok(used.size > 30);
  used.forEach((name) => assert.ok(defined.has(name), 'undefined ' + name));
});

test('type is set through the font tokens, never by name', () => {
  const css = styles.replace(/@font-face\s*{[^}]*}/g, '');
  const names = [...css.matchAll(/font-family\s*:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(names.length >= 5);
  names.forEach((n) => assert.match(n, /^var\(--font-(display|body|mono)\)$/));
});

test('headings are always upright and nothing is shouted in capitals', () => {
  assert.equal(/font-style\s*:\s*italic/i.test(styles), false);
  assert.equal(/text-transform\s*:\s*uppercase/i.test(styles), false);
  assert.equal(/<(em|i)\b/.test(html), false);
});

test('the check, the stamp and the cursor stay in the two crayons', () => {
  assert.match(styles, /::selection/);
  assert.match(styles, /::placeholder/);
  assert.match(styles, /accent-color: var\(--ink\)/);
  assert.match(styles, /scrollbar-color: var\(--ink\) var\(--paper\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});

/* ---------- works without internet ---------- */

test('the list of saved files names real files', () => {
  const sandbox = { self: {} };
  vm.runInNewContext(read('files.js'), sandbox);
  const files = sandbox.self.BOOK_FILES;
  assert.ok(files.length >= 15);
  assert.equal(new Set(files).size, files.length);
  files.filter((f) => f !== './').forEach((f) => assert.ok(fs.existsSync(path.join(ROOT, f)), 'missing ' + f));
  assert.match(sandbox.self.BOOK_VERSION, /^two-crayon-v\d+$/);
});

test('everything the page loads is in the saved list', () => {
  const sandbox = { self: {} };
  vm.runInNewContext(read('files.js'), sandbox);
  const saved = new Set(sandbox.self.BOOK_FILES);
  const wanted = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((f) => f.startsWith('./'));
  assert.ok(wanted.length >= 12);
  wanted.forEach((f) => assert.ok(saved.has(f), 'not saved ' + f));
  [...styles.matchAll(/url\("([^"]+)"\)/g)].forEach((m) => assert.ok(saved.has(m[1]), 'not saved ' + m[1]));
});

test('nothing in the project asks for another web address or an absolute path', () => {
  const external = E.auditExternalRequests({ 'index.html': html, 'styles.css': styles, 'tokens.css': tokens,
    'app.js': appSource, 'render.js': read('render.js'), 'share.js': read('share.js'), 'sw.js': read('sw.js'),
    'engine.js': read('js/engine.js') });
  assert.deepEqual(external, []);
  assert.equal(/(?:src|href)="\/(?!\/)/.test(html), false);
  assert.equal(/url\("\/[^"]/.test(styles), false);
  assert.equal(/"(?:start_url|scope)"\s*:\s*"\/[^"]/.test(read('manifest.json')), false);
});

test('the saved copy watches the same list and cleans up old copies', () => {
  const sw = read('sw.js');
  assert.match(sw, /importScripts\('\.\/files\.js'\)/);
  assert.match(sw, /self\.BOOK_FILES/);
  assert.match(sw, /cache: 'reload'/);
  assert.match(sw, /caches\.delete/);
  assert.match(sw, /ignoreSearch: true/);
  assert.match(sw, /method !== 'GET'/);
});

test('the manifest names the two crayons and a real icon', () => {
  const m = JSON.parse(read('manifest.json'));
  assert.equal(m.name, 'Two-Crayon Kitchen & Bill Book');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.equal(m.display, 'standalone');
  assert.equal(m.theme_color, '#142850');
  assert.equal(m.background_color, '#FAF5E8');
  m.icons.forEach((icon) => assert.ok(fs.existsSync(path.join(ROOT, icon.src))));
  assert.match(html, /<meta name="theme-color" content="#142850">/);
});

test('the fonts are kept in the book with their licenses', () => {
  const urls = [...styles.matchAll(/url\("\.\/(fonts\/[^"]+)"\)/g)].map((m) => m[1]);
  assert.equal(urls.length, 3);
  urls.forEach((u) => {
    assert.ok(fs.existsSync(path.join(ROOT, u)), u);
    assert.ok(fs.statSync(path.join(ROOT, u)).size > 10000);
    assert.match(html, new RegExp('<link rel="preload" href="\\./' + u.replace(/[.]/g, '\\.') + '"'));
  });
  ['fraunces', 'plus-jakarta-sans', 'jetbrains-mono'].forEach((n) => {
    assert.match(read('fonts/OFL-' + n + '.txt'), /SIL OPEN FONT LICENSE Version 1\.1/);
  });
});

/* ---------- zero libraries and plain English ---------- */

test('package.json lists no libraries of any kind', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.deepEqual(pkg.dependencies, {});
  assert.deepEqual(pkg.devDependencies, {});
  assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.scripts.test, 'node --test tests/');
  assert.equal(fs.existsSync(path.join(ROOT, 'node_modules')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'package-lock.json')), false);
});

test('the page passes all four of Grandma\'s demands, read from the real files', () => {
  const scripts = {};
  ['app.js', 'render.js', 'share.js', 'sw.js', 'files.js', 'js/engine.js'].forEach((f) => { scripts[f] = read(f); });
  const result = E.auditGrandmaDemands({ html, css: tokens + '\n' + styles, scripts, packageJson: read('package.json') });
  result.checks.forEach((c) => assert.equal(c.ok, true, c.label + ' ' + JSON.stringify(c.offenders)));
  assert.equal(result.ok, true);
});

test('no hard computer words reach the reader, in the page or in anything the code writes', () => {
  assert.deepEqual(E.findJargon(E.visibleText(html)), []);
  const quoted = [...appSource.matchAll(/'([^'\n]{12,})'/g)].map((m) => m[1]).filter((s) => /^[A-Z][^<>=\[\]{}]*\s/.test(s));
  assert.ok(quoted.length > 30);
  assert.deepEqual(E.findJargon(quoted.join(' . ')), []);
});

test('no long dashes, no emoji, no eyebrow labels anywhere in the project', () => {
  assert.ok(textFiles.length >= 15);
  textFiles.forEach((f) => {
    const text = fs.readFileSync(f, 'utf8');
    const slop = E.findSlop(text);
    const rel = path.relative(ROOT, f);
    assert.equal(slop.dashes, false, 'long dash in ' + rel);
    assert.equal(slop.emoji, false, 'emoji in ' + rel);
  });
  assert.equal(/class="[^"]*\b(eyebrow|kicker|overline)\b/i.test(html), false);
  assert.equal(/\.(eyebrow|kicker|overline)\b/.test(styles), false);
});

test('the project keeps its private details out of public files', () => {
  textFiles.forEach((f) => {
    const text = fs.readFileSync(f, 'utf8');
    assert.equal(new RegExp('gmail' + '\\.com', 'i').test(text), false, f);
    assert.equal(new RegExp('Tan' + 'yard', 'i').test(text), false, f);
  });
});

/* ---------- the little pieces of page ---------- */

test('the hero sample matches what the engine really says', () => {
  const lines = ['1 3/4 cups all-purpose flour', '2/3 cup brown sugar', '1/2 cup butter, melted', '2 eggs', '3 ripe bananas',
    '1 tsp baking soda', 'a pinch of salt', '2 tsp vanilla', '3 tbsp milk'];
  lines.forEach((line) => assert.ok(appSource.includes("'" + line + "'"), line));
  const items = E.parseRecipeText(lines.join('\n')).items;
  const shown = R.ingredientList(E.scaleRecipeIngredients(items, E.servingsFactor(4, 6)).slice(0, 6));
  const inPage = /<ul class="slip" id="hero-slip">([\s\S]*?)<\/ul>/.exec(html)[1].replace(/>\s+</g, '><').trim();
  assert.equal(inPage, shown);
});

test('words typed by people are made safe before they reach the page', () => {
  const nasty = '<img src=x onerror=alert(1)>';
  assert.equal(R.esc(nasty), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(R.esc('"\'&'), '&quot;&#39;&amp;');
  const result = E.settleHouseholdBills({ people: [nasty, 'B'], expenses: [{ payer: nasty, cents: 1000 }] });
  [R.settlementFigure(result), R.settlementList(result), R.ledgerTable(result), R.expenseList([{ label: nasty, payer: nasty, amount: '$1', sharedBy: [nasty] }]),
    R.careItemList([{ kind: 'medicine', name: nasty, dose: nasty }]), R.ingredientList([{ name: nasty, text: nasty, exactText: nasty, rounded: true, note: '' }]),
    R.careCard(E.buildWeeklyCareCard([{ kind: 'plant', name: nasty }]))
  ].forEach((part) => assert.equal(part.includes('<img'), false));
});

test('the pan picture draws both pans to one scale and says so in words', () => {
  const a = { shape: 'round', size: 8 };
  const b = { shape: 'rect', width: 9, height: 13 };
  const svg = R.panFigure(a, b, E.panPlan(a, b), 'x');
  assert.match(svg, /<circle class="fig-pan"/);
  assert.match(svg, /<rect class="fig-pan"/);
  assert.match(svg, /8 inch round/);
  assert.match(svg, /9 by 13 inch/);
  assert.match(svg, /id="x-hatch"/);
  assert.match(svg, /fill="url\(#x-hatch\)"/);
  const same = R.panFigure(a, a, E.panPlan(a, a));
  assert.match(same, /same depth/);
  assert.deepEqual(E.auditSvgAttributes(svg).offenders, []);
});

test('the settling picture has one arrow per handoff and a plain words summary', () => {
  const result = E.settleHouseholdBills({ people: ['Alma', 'Ben', 'Cora', 'Dev'], expenses: [{ payer: 'Alma', amount: '100' }] });
  const svg = R.settlementFigure(result);
  assert.equal((svg.match(/class="fig-arrow"/g) || []).length, 3);
  assert.equal((svg.match(/class="fig-node"/g) || []).length, 4);
  assert.match(svg, /aria-label="Diagram of who hands what to whom\. Ben hands Alma \$25\.00/);
  const square = R.settlementFigure(E.settleHouseholdBills({ people: ['A'], expenses: [] }));
  assert.match(square, /Everyone is square/);
  const crowd = [];
  for (let i = 0; i < 8; i++) crowd.push('P' + i);
  const many = R.settlementFigure(E.settleHouseholdBills({ people: crowd, expenses: [{ payer: 'P0', cents: 8001 }] }));
  assert.equal((many.match(/class="fig-node"/g) || []).length, 8);
  assert.equal(/NaN/.test(many), false);
});

test('the weekly card draws seven days with a box to tick for each task', () => {
  const card = E.buildWeeklyCareCard([{ kind: 'medicine', name: 'Vitamin D', dose: '1 tablet', slots: ['morning', 'evening'] },
    { kind: 'pantry', name: 'Tins' }]);
  const out = R.careCard(card);
  assert.equal((out.match(/<section class="care-day"/g) || []).length, 7);
  assert.equal((out.match(/class="box"/g) || []).length, card.tasks);
  assert.match(out, /Sunday check/);
  assert.match(out, /Vitamin D, 1 tablet/);
  assert.equal(R.careCard(E.buildWeeklyCareCard([])).split('Nothing due.').length - 1, 7);
});

test('the ledger table totals match and its figures line up', () => {
  const result = E.settleHouseholdBills({ people: ['A', 'B'], expenses: [{ payer: 'A', amount: '10.01' }] });
  const out = R.ledgerTable(result);
  assert.match(out, /<th scope="row">A<\/th><td>\$10\.01<\/td><td>\$5\.01<\/td><td>gets \$5\.00<\/td>/);
  assert.match(out, /All slips<\/th><td>\$10\.01<\/td><td>\$10\.01<\/td><td>1 handoff</);
  assert.match(out, /<caption>/);
});

test('every part of the page handles an empty list in words', () => {
  assert.match(R.careItemList([]), /Nothing on the card yet/);
  assert.match(R.expenseList([]), /No slips yet/);
  assert.match(R.settlementList(E.settleHouseholdBills({ people: ['A', 'B'], expenses: [] })), /Everyone is square/);
  assert.match(R.auditRows([{ label: 'a', ok: null, detail: 'x' }]), /data-state="wait"/);
  assert.match(R.auditRows([{ label: 'a', ok: false, detail: 'x' }]), /data-state="no"/);
});

test('the schedule words read naturally', () => {
  assert.equal(R.describeSchedule({ kind: 'pantry' }), 'Sunday check');
  assert.equal(R.describeSchedule({ kind: 'medicine', slots: ['morning', 'evening'] }), 'every day, morning and evening');
  assert.equal(R.describeSchedule({ kind: 'plant', everyDays: 3, slots: ['morning'] }), 'water every 3 days, morning');
  assert.equal(R.describeSchedule({ kind: 'plant', everyDays: 1 }), 'every day, morning');
});

test('sharing a copy squeezes the book and brings it back whole', async () => {
  const S = require('../share.js');
  const state = { v: 1, recipeText: 'x '.repeat(400), expenses: [{ label: 'Caf\u00e9', payer: 'A', amount: '$1.00', sharedBy: [] }] };
  const packed = await S.pack(state, E);
  assert.ok(S.canSqueeze());
  assert.match(packed, /^z1\./);
  assert.ok(packed.length < E.packState(state).length);
  assert.deepEqual(await S.unpack('#' + packed, E), state);
  const small = await S.pack({ v: 1 }, E);
  assert.match(small, /^p1\./);
  assert.deepEqual(await S.unpack(small, E), { v: 1 });
  assert.equal(await S.unpack('z1.not-real', E), null);
  assert.equal(await S.unpack('nonsense', E), null);
});

/* ---------- a stand-in page that really runs app.js ---------- */

class FakeEl {
  constructor(id, page) {
    this.id = id;
    this.page = page;
    this.value = '';
    this.checked = false;
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.innerHTML = '';
    this.attrs = {};
    this.listeners = {};
    this.dataset = {};
    this.classList = { add() {}, remove() {}, contains: () => false };
  }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  fire(type, extra) { (this.listeners[type] || []).forEach((fn) => fn.call(this, Object.assign({ preventDefault() {}, target: this }, extra))); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  querySelector() { return this.page.statsEl; }
  querySelectorAll(sel) {
    if (sel === 'input') {
      return [...this.innerHTML.matchAll(/<input type="checkbox" value="([^"]*)"( checked)?>/g)].map((m) => ({
        value: m[1].replace(/&amp;/g, '&'), checked: Boolean(m[2])
      }));
    }
    return [];
  }
  closest() { return null; }
  select() { this.selected = true; }
  scrollIntoView() {}
  get offsetWidth() { return 1; }
}

function makePage(overrides) {
  const ids = new Set(idsIn(html));
  const page = { els: {}, store: {}, statsEl: { textContent: '' } };
  page.get = (id) => {
    assert.ok(ids.has(id), 'app.js asked for an id that is not on the page: ' + id);
    if (!page.els[id]) page.els[id] = new FakeEl(id, page);
    return page.els[id];
  };
  const radios = ['by-people', 'by-pan'].map((id) => page.get(id));
  radios[0].value = 'people';
  radios[1].value = 'pan';
  page.get('care-kind').value = 'medicine';
  page.get('care-every').value = '3';
  page.get('exp-payer').value = 'Alma';
  const slots = ['morning', 'noon', 'evening'].map((v) => Object.assign(new FakeEl('slot-' + v, page), { value: v, checked: v === 'morning' }));
  const body = new FakeEl('body', page);
  body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(html)[1];
  const document = {
    readyState: 'complete',
    body,
    documentElement: new FakeEl('html', page),
    getElementById: (id) => page.get(id),
    addEventListener() {},
    querySelectorAll(sel) {
      if (sel === 'input[name="scale-by"]') return radios;
      if (sel === 'input[name="care-slot"]') return slots;
      if (sel === '.tabs a') return [];
      return [];
    }
  };
  const written = {};
  const window = {
    document,
    location: { hash: '', href: 'http://book.test/index.html', protocol: 'http:' },
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(page.store, k) ? page.store[k] : null),
      setItem: (k, v) => { page.store[k] = v; }
    },
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout() {},
    addEventListener() {},
    print() { written.printed = true; },
    getComputedStyle: () => ({ getPropertyValue: () => '', content: 'none' }),
    fetch: (name) => {
      const file = name.replace(/^\.\//, '');
      if (!fs.existsSync(path.join(ROOT, file))) return Promise.resolve({ ok: false });
      return Promise.resolve({ ok: true, text: () => Promise.resolve(fs.readFileSync(path.join(ROOT, file), 'utf8')) });
    },
    navigator: { onLine: true },
    Date
  };
  window.window = window;
  Object.assign(window, overrides || {});
  const context = vm.createContext(Object.assign({ Promise, console, JSON, Number, Math, String, Object, Array, Set, Map, Date,
    navigator: window.navigator, document }, window));
  vm.runInContext(read('files.js').replace('typeof self !== \'undefined\' ? self : this', 'window'), context);
  window.GrandmaEngine = E;
  window.GrandmaRender = require('../render.js');
  window.GrandmaShare = require('../share.js');
  Object.assign(context, { window, GrandmaEngine: E });
  context.window = Object.assign(window, { window });
  return { page, context, window, written };
}

async function boot(overrides) {
  const made = makePage(overrides);
  made.context.window.document = made.context.document;
  vm.runInContext(appSource, vm.createContext(Object.assign(made.context, { window: made.context.window })));
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  return made;
}

test('app.js starts on a stand-in page and fills every part', async () => {
  const { page } = await boot();
  assert.match(page.get('ingredient-list').innerHTML, /all-purpose flour/);
  assert.match(page.get('scale-readout').textContent, /Everything times 1 1\/2, 6 people instead of 4\./);
  assert.match(page.get('pan-figure').innerHTML, /<svg class="figure"/);
  assert.match(page.get('pan-advice-scaled').textContent, /Bigger pan/);
  assert.match(page.get('settle-list').innerHTML, /hands/);
  assert.match(page.get('ledger').innerHTML, /<table class="ledger">/);
  assert.equal((page.get('care-card').innerHTML.match(/care-day/g) || []).length >= 7, true);
  assert.match(page.get('exp-payer').innerHTML, /<option value="Alma">/);
  assert.equal(page.get('recipe-text').value.split('\n').length, 9);
  assert.equal(page.get('servings-to').value, 6);
});

test('the check on the stand-in page reads the real files and passes three rules', async () => {
  const { page } = await boot();
  const rows = page.get('audit-list').innerHTML;
  assert.equal((rows.match(/class="audit-row"/g) || []).length, 4);
  assert.match(rows, /Two crayons only/);
  assert.match(rows, /data-state="yes"/);
  const states = [...rows.matchAll(/data-state="(yes|no|wait)"/g)].map((m) => m[1]);
  assert.equal(states.filter((s) => s === 'yes').length, 3);
  assert.match(rows, /This device cannot keep a saved copy/);
  assert.equal(page.get('stamp').attrs['data-state'], 'no');
  assert.equal(page.statsEl.textContent, 'see the list');
});

test('the check says all four kept once a saved copy exists', async () => {
  const kept = [];
  const files = (() => { const s = { self: {} }; vm.runInNewContext(read('files.js'), s); return s.self.BOOK_FILES; })();
  files.forEach((f) => kept.push(f));
  const { page } = await boot({
    caches: { open: () => Promise.resolve({ keys: () => Promise.resolve(kept) }) },
    navigator: { onLine: false, serviceWorker: { register: () => Promise.resolve(), ready: Promise.resolve() } }
  });
  await new Promise((r) => setTimeout(r, 20));
  const rows = page.get('audit-list').innerHTML;
  const states = [...rows.matchAll(/data-state="(yes|no|wait)"/g)].map((m) => m[1]);
  assert.deepEqual(states, ['yes', 'yes', 'yes', 'yes']);
  assert.match(rows, /You are offline right now and the book still works/);
  assert.equal(page.get('stamp').attrs['data-state'], 'yes');
  assert.equal(page.get('hero-stamp').attrs['data-state'], 'yes');
});

test('changing the number of people changes the amounts', async () => {
  const { page } = await boot();
  const to = page.get('servings-to');
  to.value = '8';
  to.fire('input');
  assert.match(page.get('scale-readout').textContent, /times 2, 8 people instead of 4/);
  assert.match(page.get('ingredient-list').innerHTML, /3 1\/2 cups/);
  to.value = '0';
  to.fire('input');
  assert.match(page.get('recipe-problems').textContent, /whole numbers/);
  assert.equal(page.get('recipe-text').attrs['aria-invalid'], 'true');
});

test('a line with no amount is reported by its number and the rest still work', async () => {
  const { page } = await boot();
  const box = page.get('recipe-text');
  box.value = '1 cup flour\nsome salt\n2 eggs';
  box.fire('input');
  assert.match(page.get('recipe-problems').textContent, /Line 2 needs an amount/);
  assert.match(page.get('ingredient-list').innerHTML, /flour/);
  box.value = '';
  box.fire('input');
  assert.match(page.get('scale-readout').textContent, /Add an ingredient/);
});

test('scaling by the pan uses the pan answer and says where it came from', async () => {
  const { page } = await boot();
  page.get('use-pan-scale').fire('click');
  assert.match(page.get('scale-readout').textContent, /Everything times 1 3\/8, from the new pan\./);
  const to = page.get('pt-width');
  to.value = 'wide';
  to.fire('input');
  assert.match(page.get('pan-problems').textContent, /could not read that amount/);
  assert.equal(page.get('use-pan-scale').disabled, true);
  assert.match(page.get('recipe-problems').textContent, /Fill in both pans/);
});

test('a slip can be added, then taken off again', async () => {
  const { page } = await boot();
  const before = (page.get('expense-list').innerHTML.match(/care-item/g) || []).length;
  page.get('exp-amount').value = '$12.50';
  page.get('exp-label').value = 'Milk';
  page.get('bill-form').fire('submit');
  assert.equal((page.get('expense-list').innerHTML.match(/care-item/g) || []).length, before + 1);
  assert.match(page.get('expense-list').innerHTML, /Milk/);
  assert.match(page.get('expense-list').innerHTML, /\$12\.50/);
  assert.match(page.get('ledger').innerHTML, /\$190\.35/);
  page.get('expense-list').closest = () => ({ getAttribute: () => String(before) });
  page.get('expense-list').fire('click');
  assert.equal((page.get('expense-list').innerHTML.match(/care-item/g) || []).length, before);
});

test('a bad slip is explained and nothing is added', async () => {
  const { page } = await boot();
  page.get('exp-amount').value = 'lots';
  page.get('bill-form').fire('submit');
  assert.match(page.get('slip-problems').textContent, /could not read that money/);
  assert.equal(page.get('exp-amount').attrs['aria-invalid'], 'true');
  page.get('exp-amount').value = '0';
  page.get('bill-form').fire('submit');
  assert.match(page.get('slip-problems').textContent, /bigger than nothing/);
});

test('a name that vanishes from the house is reported, not hidden', async () => {
  const { page } = await boot();
  const people = page.get('people-input');
  people.value = 'Alma, Ben';
  people.fire('input');
  assert.match(page.get('people-problems').textContent, /Nobody named Cora/);
  assert.equal(page.get('settle-list').innerHTML, '');
  people.value = 'Alma, Ben, Cora';
  people.fire('input');
  assert.equal(page.get('people-problems').textContent, '');
  assert.match(page.get('settle-list').innerHTML, /hands/);
});

test('things can be added to the care card and repeats are named', async () => {
  const { page } = await boot();
  const name = page.get('care-name');
  name.value = 'Fish oil';
  page.get('care-form').fire('submit');
  assert.match(page.get('care-items').innerHTML, /Fish oil/);
  assert.match(page.get('care-card').innerHTML, /Fish oil/);
  name.value = 'Vitamin D';
  page.get('care-form').fire('submit');
  assert.match(page.get('care-conflicts').textContent, /left off the card/);
  assert.match(page.get('care-conflicts').textContent, /Vitamin D is already on Monday morning/);
  name.value = '';
  page.get('care-form').fire('submit');
  assert.match(page.get('care-problems').textContent, /Give it a name/);
});

test('what you type is kept on the device and read back next time', async () => {
  const first = await boot();
  first.page.get('servings-to').value = '10';
  first.page.get('servings-to').fire('input');
  const saved = JSON.parse(first.page.store['two-crayon-book-v1']);
  assert.equal(saved.to, 10);
  const second = makePage();
  second.page.store['two-crayon-book-v1'] = JSON.stringify(Object.assign({}, saved, { to: 9, evil: '<script>' }));
  second.context.window.document = second.context.document;
  vm.runInContext(appSource, vm.createContext(Object.assign(second.context, { window: second.context.window })));
  await new Promise((r) => setImmediate(r));
  assert.equal(second.page.get('servings-to').value, 9);
});

test('a damaged saved book is ignored instead of breaking the page', async () => {
  const made = makePage();
  made.page.store['two-crayon-book-v1'] = '{"to": "lots", "expenses": [{"payer": 5}], "care": [{"kind": "cat", "name": "x"}], "panFrom": 7}';
  vm.runInContext(appSource, vm.createContext(Object.assign(made.context, { window: made.context.window })));
  await new Promise((r) => setImmediate(r));
  assert.equal(made.page.get('servings-to').value, 6);
  assert.match(made.page.get('ingredient-list').innerHTML, /flour/);
  made.page.store['two-crayon-book-v1'] = 'not json at all';
  const again = makePage();
  again.page.store['two-crayon-book-v1'] = 'not json at all';
  vm.runInContext(appSource, vm.createContext(Object.assign(again.context, { window: again.context.window })));
  await new Promise((r) => setImmediate(r));
  assert.match(again.page.get('ingredient-list').innerHTML, /flour/);
});

test('copying a link puts the whole book on the end of the web address', async () => {
  const copied = [];
  const { page } = await boot({ navigator: { onLine: true, clipboard: { writeText: (t) => { copied.push(t); return Promise.resolve(); } } } });
  page.get('copy-link').fire('click');
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(copied.length, 1);
  assert.match(copied[0], /^http:\/\/book\.test\/index\.html#(z1|p1)\./);
  assert.equal(page.get('link-box').value, copied[0]);
  assert.match(page.get('link-note').textContent, /Copied/);
  const shared = await require('../share.js').unpack(copied[0].split('#')[1], E);
  assert.equal(shared.to, 6);
  assert.equal(shared.people, 'Alma, Ben, Cora');
});

test('the print button asks for paper and the printed note says when', async () => {
  const { page, written } = await boot();
  page.get('print-button').fire('click');
  assert.equal(written.printed, true);
});
