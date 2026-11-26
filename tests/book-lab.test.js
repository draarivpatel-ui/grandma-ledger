'use strict';
/* Tests for the checkup bench: the stamp writer, the careful way of writing
   values, the bench rows, the pan line, the split bars, the copies of the
   numbers, the link tail, the book's own checks, and the wiring in app.js. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const E = require('../js/engine.js');
const LAB = require('../js/book-lab.js');
const L = LAB.create(E);

const html = read('index.html');
const appSource = read('app.js');

/* ---------- the stamp writer (SHA-256) ---------- */

const KATS = [
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['a', 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ['message digest', 'f7846f55cf23e14eebeab5b4e1550cad5b509e3348fbc4efa3a1413d393cb650'],
  ['abcdefghijklmnopqrstuvwxyz', '71c480df93d6ae2f1efad1447c66c9525e316218cf51fc8d9ed832f2daf18b73'],
  ['The quick brown fox jumps over the lazy dog', 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592'],
  ['The quick brown fox jumps over the lazy dog.', 'ef537f25c895bfa782526529a9b63d97aa631564d5d789c2b765448c8635fb6c'],
  ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1']
];

KATS.forEach((pair) => {
  test('the stamp of ' + JSON.stringify(pair[0].slice(0, 24)) + ' is the published answer', () => {
    assert.equal(LAB.sha256Hex(pair[0]), pair[1]);
  });
});

for (let n = 0; n <= 160; n++) {
  test('a ' + n + '-byte message is stamped the same as the device stamps it', () => {
    const buf = Buffer.alloc(n);
    for (let i = 0; i < n; i++) buf[i] = (i * 37 + n) % 256;
    const mine = LAB.sha256Hex([...buf]);
    const theirs = crypto.createHash('sha256').update(buf).digest('hex');
    assert.equal(mine, theirs);
  });
}

const ODD_TEXTS = ['caf\u00e9', 'na\u00efve \u00fcmlaut', '\u6771\u4eac', 'a\ud83d\ude00b', '\u0000\u0001\u0002',
  'tabs\tand\nlines', '  spaced  ', '\ufffd'];

ODD_TEXTS.forEach((s) => {
  test('stamping ' + JSON.stringify(s.slice(0, 12)) + ' matches the device byte for byte', () => {
    assert.equal(LAB.sha256Hex(s), crypto.createHash('sha256').update(s, 'utf8').digest('hex'));
  });
});

test('a lone half of a pair mark becomes the replacement mark, like the device', () => {
  const lone = 'a\ud800b';
  assert.equal(LAB.sha256Hex(lone), crypto.createHash('sha256').update(lone, 'utf8').digest('hex'));
  const low = 'a\udc00b';
  assert.equal(LAB.sha256Hex(low), crypto.createHash('sha256').update(low, 'utf8').digest('hex'));
});

test('the stamp writer accepts a list of bytes as well as text', () => {
  assert.equal(LAB.sha256Hex([97, 98, 99]), LAB.sha256Hex('abc'));
});

/* ---------- the careful way of writing values ---------- */

test('keys come out in the same order no matter how they went in', () => {
  const a = LAB.canonicalize({ b: 1, a: 2, c: [3, { z: 1, y: 2 }] });
  const b = LAB.canonicalize({ c: [3, { y: 2, z: 1 }], a: 2, b: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":2,"b":1,"c":[3,{"y":2,"z":1}]}');
});

test('plain values write the same way every time', () => {
  assert.equal(LAB.canonicalize(null), 'null');
  assert.equal(LAB.canonicalize(true), 'true');
  assert.equal(LAB.canonicalize(false), 'false');
  assert.equal(LAB.canonicalize(0), '0');
  assert.equal(LAB.canonicalize(-0), '0');
  assert.equal(LAB.canonicalize(3.25), '3.25');
  assert.equal(LAB.canonicalize('a"b\\c'), '"a\\"b\\\\c"');
  assert.equal(LAB.canonicalize([]), '[]');
  assert.equal(LAB.canonicalize({}), '{}');
  assert.equal(LAB.canonicalize([1, 'x', null]), '[1,"x",null]');
});

test('a key named __proto__ still writes safely and in order', () => {
  const odd = JSON.parse('{"__proto__":5,"a":1}');
  assert.equal(LAB.canonicalize(odd), '{"__proto__":5,"a":1}');
});

test('a dictionary with no prototype still writes', () => {
  const odd = Object.create(null);
  odd.z = 1;
  odd.a = 2;
  assert.equal(LAB.canonicalize(odd), '{"a":2,"z":1}');
});

const BAD_VALUES = [
  ['a Set', new Set([1, 2])],
  ['a Map', new Map([['a', 1]])],
  ['a Date', new Date(0)],
  ['a made-up kind of thing', new (class Box { constructor() { this.x = 1; } })()],
  ['a work in progress', Promise.resolve(1)],
  ['undefined', undefined],
  ['a function', function () { return 1; }],
  ['a symbol', Symbol('x')],
  ['not a number', NaN],
  ['endless', Infinity],
  ['endless the other way', -Infinity]
];

BAD_VALUES.forEach((pair) => {
  test('writing ' + pair[0] + ' is refused, not silently wrong', () => {
    assert.throws(() => LAB.canonicalize(pair[1]), /cannot be stamped|must be finite/);
  });
});

test('undefined inside a list or an object is refused', () => {
  assert.throws(() => LAB.canonicalize([1, undefined]));
  assert.throws(() => LAB.canonicalize({ a: undefined }));
});

test('a loop in the data is refused', () => {
  const loop = { a: 1 };
  loop.self = loop;
  assert.throws(() => LAB.canonicalize(loop), /loop/);
  const arr = [1, 2];
  arr.push(arr);
  assert.throws(() => LAB.canonicalize(arr), /loop/);
});

test('two things that share a part without looping still write', () => {
  const shared = { x: 1 };
  assert.equal(LAB.canonicalize({ a: shared, b: shared }), '{"a":{"x":1},"b":{"x":1}}');
});

test('a shape deeper than the limit is refused', () => {
  let deep = 1;
  for (let i = 0; i < 30; i++) deep = [deep];
  assert.throws(() => LAB.canonicalize(deep), /Too deep/);
});

test('a shape with too many parts is refused', () => {
  const wide = {};
  for (let i = 0; i < 60010; i++) wide['k' + i] = i;
  assert.throws(() => LAB.canonicalize(wide), /Too much/);
});

test('a shape right at the depth limit still writes', () => {
  let deep = 1;
  for (let i = 0; i < 24; i++) deep = { d: deep };
  const out = LAB.canonicalize(deep);
  assert.equal(out.endsWith('}'.repeat(24)), true);
  assert.equal(out.startsWith('{"d":'.repeat(23)), true);
});

/* ---------- one stamp for every copy ---------- */

test('the same payload gives back the very same stamped entry', () => {
  const payload = { b: 2, a: [1, 2, 3] };
  const one = L.stamped(payload);
  const two = L.stamped({ a: [1, 2, 3], b: 2 });
  assert.equal(one, two);
  assert.equal(one.hex.length, 64);
  assert.match(one.hex, /^[0-9a-f]{64}$/);
  assert.equal(one.hex, crypto.createHash('sha256').update(one.canonical, 'utf8').digest('hex'));
});

test('a different payload gets a different stamp', () => {
  assert.notEqual(L.stamped({ a: 1 }).hex, L.stamped({ a: 2 }).hex);
});

test('the stamp line reads plainly', () => {
  const entry = L.stamped({ a: 1 });
  assert.equal(L.stampLine(entry), 'Stamp ' + entry.hex);
});

/* ---------- the six moves on the bench ---------- */

const RECIPE = '2 cups flour\n1/2 cup sugar\n3 eggs\n1 tsp baking soda\n2 tbsp milk\n1/4 tsp salt';
const bench = L.benchRows(RECIPE);

test('the bench has the six everyday moves in order', () => {
  assert.deepEqual(bench.map((r) => r.key), ['half', 'single', 'family', 'potluck', 'round9', 'sheet913']);
});

test('every bench row was worked out by the kitchen sums, not a copy', () => {
  bench.forEach((row) => {
    const wanted = row.kind === 'people' ? E.servingsFactor(row.apply.from, row.apply.to)
      : E.panPlan(row.apply.from, row.apply.to).recipeFactor;
    assert.ok(E.frEq(row.factor, wanted), row.key);
  });
});

test('the times column reads as kitchen fractions', () => {
  assert.deepEqual(bench.map((r) => r.factorText), ['1/2', '1', '1 1/2', '2', bench[4].factorText, bench[5].factorText]);
  bench.forEach((row) => assert.match(row.factorText, /^\d+( \d+\/\d+|\/\d+)?$/));
});

test('pan rows say how deep the batter sits, serving rows say same pan', () => {
  assert.match(bench[4].depthText, /^about \d|same/);
  assert.match(bench[4].depthText, /as deep$/);
  assert.match(bench[5].depthText, /as deep$/);
  bench.slice(0, 4).forEach((row) => assert.equal(row.depthText, 'same pan'));
});

test('rounded counts and drift read plainly on every row', () => {
  bench.forEach((row) => {
    assert.match(row.roundedText, /^\d+ of \d+$/);
    assert.ok(row.driftText === 'none' || /^\d+\.\d%$/.test(row.driftText), row.driftText);
    assert.equal(row.problem, '');
  });
});

test('the drift a row shows is the drift the sums really found', () => {
  assert.equal(bench[1].driftText, 'none');
  assert.equal(bench[1].driftPct, 0);
  bench.forEach((row) => {
    assert.equal(row.driftText === 'none' ? 0 : Number(row.driftText.slice(0, -1)), row.driftPct);
  });
});

test('a bigger batch on the same pan never says it got shallower', () => {
  const rows = L.benchRows(RECIPE);
  assert.ok(rows[4].driftPct >= 0 && rows[5].driftPct >= 0);
  const sheet = rows[5];
  assert.ok(E.frCmp(sheet.factor, E.fr(1)) > 0, 'a 9 by 13 sheet scales the recipe up');
});

test('an empty recipe gives an empty but honest bench', () => {
  const rows = L.benchRows('');
  assert.equal(rows.length, 6);
  rows.forEach((row) => {
    assert.equal(row.roundedText, '0 of 0');
    assert.equal(row.driftText, 'none');
    assert.equal(row.problem, '');
  });
});

test('a recipe with one bad line still benches the good lines', () => {
  const rows = L.benchRows('1 cup flour\nsome salt\n2 eggs');
  assert.equal(rows[0].problem, '');
  assert.match(rows[0].roundedText, /of 2$/);
});

test('every bench row can apply itself to the book', () => {
  bench.forEach((row) => {
    assert.equal(L.ROW_BY_KEY[row.key].key, row.key);
    assert.equal(row.apply.kind === 'people' ? 'people' : 'pan', row.kind);
  });
});

/* ---------- the pan line ---------- */

const pans = L.panRows({ shape: 'round', size: '8' });

test('the pan line holds the seven common pans, sorted by room', () => {
  assert.equal(pans.length, 7);
  for (let i = 1; i < pans.length; i++) assert.ok(pans[i].area > pans[i - 1].area);
  assert.deepEqual(pans.map((p) => p.key), ['r6', 'r8', 'r9', 's88', 'r10', 's99', 's913']);
});

test('depth is exactly the flip of room for every pan', () => {
  pans.forEach((p) => {
    assert.ok(E.frEq(E.frMul(p.ratio, p.depthRatio), E.fr(1)), p.key);
    assert.match(p.depthText, /^about .+ as deep$/);
    assert.match(p.areaText, /square inches of room$/);
  });
});

test('the written-for pan sits at depth one', () => {
  const from8 = pans.filter((p) => p.key === 'r8')[0];
  assert.ok(E.frEq(from8.depthRatio, E.fr(1)));
  assert.equal(from8.depthText, 'about 1 as deep');
});

test('a made-up pan keeps the line working', () => {
  const odd = L.panRows({ shape: 'rect', width: 'banana', height: '4' });
  assert.equal(odd.length, 7);
  const missing = L.panRows(null);
  assert.equal(missing.length, 7);
});

test('panKeyFor names a known pan and none otherwise', () => {
  assert.equal(L.panKeyFor({ shape: 'round', size: '8' }), 'r8');
  assert.equal(L.panKeyFor({ shape: 'rect', width: '9', height: '13' }), 's913');
  assert.equal(L.panKeyFor({ shape: 'rect', width: '8', height: '8' }), 's88');
  assert.equal(L.panKeyFor({ shape: 'round', size: '7' }), 'none');
  assert.equal(L.panKeyFor({ shape: 'oval', size: '8' }), 'none');
  assert.equal(L.panKeyFor(null), 'none');
  assert.equal(L.panKeyFor({}), 'none');
});

test('every curve pan can be looked up by its key', () => {
  L.CURVE_PANS.forEach((p) => assert.equal(L.PAN_BY_KEY[p.key].pan, p.pan));
});

/* ---------- fewest handoffs against the plain greedy way ---------- */

const KINDS = ['everyday', 'pairs', 'turns'];

KINDS.forEach((kind) => {
  for (let n = 3; n <= 12; n++) {
    test('the ' + kind + ' week for a house of ' + n + ' settles with no more handoffs than the plain way', () => {
      const scenario = L.splitScenario(kind, n);
      const exact = E.settleHouseholdBills(scenario);
      const greedy = L.greedyTransfers(L.openEntries(exact));
      assert.ok(exact.handoffs <= greedy.length,
        'exact ' + exact.handoffs + ' beat plain ' + greedy.length);
      const net = {};
      exact.ledger.forEach((row) => { net[row.name] = row.netCents; });
      exact.transfers.forEach((t) => { net[t.from] += t.cents; net[t.to] -= t.cents; });
      Object.keys(net).forEach((name) => assert.equal(net[name], 0, name));
      exact.transfers.forEach((t) => {
        assert.ok(t.cents > 0);
        const pieces = E.handoffPieces(t.cents);
        assert.equal(pieces.reduce((s, p) => s + p.value * p.count, 0), t.cents);
      });
      assert.equal(exact.ledger.reduce((s, r) => s + r.netCents, 0), 0);
      assert.equal(greedy.every((t) => t.cents > 0), true);
    });
  }
});

test('the bar rows carry people, counts, savings and piece counts', () => {
  KINDS.forEach((kind) => {
    const rows = L.splitRows(kind);
    assert.equal(rows.length, 10);
    assert.deepEqual(rows.map((r) => r.people), [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    rows.forEach((row) => {
      assert.ok(row.exact <= row.greedy);
      assert.equal(row.saved, row.greedy - row.exact);
      assert.ok(row.piecesExact >= row.exact);
      assert.ok(row.piecesGreedy >= row.greedy);
    });
  });
});

test('at least one house of each kind saves a handoff', () => {
  KINDS.forEach((kind) => {
    assert.ok(L.splitRows(kind).some((r) => r.saved > 0), kind);
  });
});

test('an unknown kind of week falls back to the shared-slips week', () => {
  assert.deepEqual(L.splitRows('nonsense').map((r) => r.exact), L.splitRows('everyday').map((r) => r.exact));
});

test('the plain greedy way leaves nobody open', () => {
  KINDS.forEach((kind) => {
    const exact = E.settleHouseholdBills(L.splitScenario(kind, 8));
    const greedy = L.greedyTransfers(L.openEntries(exact));
    const net = {};
    exact.ledger.forEach((row) => { net[row.name] = row.netCents; });
    greedy.forEach((t) => { net[t.from] += t.cents; net[t.to] -= t.cents; });
    Object.keys(net).forEach((name) => assert.equal(net[name], 0));
  });
});

/* ---------- the book's numbers ---------- */

function freshState() {
  return {
    v: 1,
    recipeText: RECIPE,
    from: 4,
    to: 6,
    scaleBy: 'people',
    panFrom: { shape: 'round', size: '8', width: '8', height: '8' },
    panTo: { shape: 'rect', width: '9', height: '9', size: '9' },
    people: 'Alma, Ben, Cora',
    expenses: [
      { label: 'Milk', payer: 'Alma', amount: '$4.20', sharedBy: [] },
      { label: 'Rice', payer: 'Ben', amount: '$8.00', sharedBy: ['Alma', 'Ben'] }
    ],
    care: [{ kind: 'plant', name: 'Basil', everyDays: 3, slots: ['morning'] }]
  };
}

const freshBench = () => ({ pan: 'r8', pattern: 'everyday', row: 'none', size: 0, tamper: false });

test('the payload holds the book and the bench plainly', () => {
  const payload = L.bookPayload(freshState(), freshBench());
  assert.equal(payload.book, 'two-crayon-kitchen-and-bill-book');
  assert.equal(payload.recipe.by, 'people');
  assert.equal(payload.recipe.to, 6);
  assert.equal(payload.pans.written.shape, 'round');
  assert.equal(payload.pans.baking.shape, 'rect');
  assert.deepEqual(payload.house.people, ['Alma', 'Ben', 'Cora']);
  assert.equal(payload.house.slips.length, 2);
  assert.equal(payload.house.slips[0].cents, 420);
  assert.equal(payload.house.sum, 1220);
  assert.equal(payload.bench.pan, 'r8');
});

test('the payload stamps the same no matter how often it is asked for', () => {
  const a = L.stamped(L.bookPayload(freshState(), freshBench()));
  const b = L.stamped(L.bookPayload(freshState(), freshBench()));
  assert.equal(a, b);
});

test('moving one penny on one slip changes the stamp', () => {
  const payload = L.bookPayload(freshState(), freshBench());
  const changed = L.tamperPayload(payload);
  assert.equal(changed.house.slips[0].cents, 421);
  assert.equal(changed.house.sum, 1221);
  assert.notEqual(L.stamped(changed).hex, L.stamped(payload).hex);
});

test('a book with no slips still catches a moved penny in the sum', () => {
  const state = freshState();
  state.expenses = [];
  const payload = L.bookPayload(state, freshBench());
  assert.notEqual(L.stamped(L.tamperPayload(payload)).hex, L.stamped(payload).hex);
});

test('a book the settle sums cannot read still stamps its words', () => {
  const state = freshState();
  state.expenses = [{ label: 'x', payer: 'Nobody', amount: '$1.00', sharedBy: [] }];
  const payload = L.bookPayload(state, freshBench());
  assert.equal(payload.house.handoffs, 0);
  assert.equal(payload.house.slips.length, 1);
  assert.match(L.stamped(payload).hex, /^[0-9a-f]{64}$/);
});

/* ---------- the copies of the numbers ---------- */

const payload = L.bookPayload(freshState(), freshBench());
const entry = L.stamped(payload);
const rows = L.benchRows(RECIPE);

test('all four copies carry the one stamp', () => {
  [L.stampLine(entry), L.exportNumbers(payload, entry), L.exportSheet(payload, rows, entry), L.exportNotes(payload, rows, entry)]
    .forEach((out) => assert.ok(out.indexOf(entry.hex) >= 0));
});

test('the numbers file is real JSON with the stamp beside the numbers', () => {
  const out = JSON.parse(L.exportNumbers(payload, entry));
  assert.equal(out.stamp, entry.hex);
  assert.deepEqual(out.numbers, payload);
  assert.equal(out.book, 'Two-Crayon Kitchen & Bill Book');
});

test('a cell that could read as a formula opens as plain text', () => {
  ['=1+1', '+1', '-1', '@here', '\tspace'].forEach((cell) => {
    assert.equal(L.csvCell(cell)[0], "'");
  });
  assert.equal(L.csvCell('\rreturn'), '"\'\rreturn"');
  assert.equal(L.csvCell('plain'), 'plain');
  assert.equal(L.csvCell(12), '12');
});

test('cells with commas, quotes and new lines are wrapped safely', () => {
  assert.equal(L.csvCell('a,b'), '"a,b"');
  assert.equal(L.csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(L.csvCell('two\nlines'), '"two\nlines"');
  assert.equal(L.csvCell('="a,b"'), '"\'=""a,b"""');
});

test('a formula hiding behind whitespace or invisible characters opens as plain text', () => {
  [
    ' =1+1', '   +2', '\n=3', '\u00a0=4', '\u200b=5', '\x00=6', '\x1f=7', '\x7f=8', '\u202f@there'
  ].forEach((cell) => {
    const out = L.csvCell(cell);
    assert.ok(out[0] === "'" || out.slice(0, 2) === '"\'', JSON.stringify(cell) + ' -> ' + JSON.stringify(out));
  });
});

test('a formula hiding inside a name cannot reach the sheet', () => {
  const state = freshState();
  state.people = '=1+1, Alma';
  state.expenses = [{ label: '=cmd', payer: '=1+1', amount: '$4.00', sharedBy: [] }];
  const p2 = L.bookPayload(state, freshBench());
  const sheet = L.exportSheet(p2, L.benchRows(RECIPE), L.stamped(p2));
  sheet.split('\n').forEach((line) => {
    const first = line.split(',')[0];
    assert.ok(!/^[=+\-@\t\r]/.test(first), line);
  });
  assert.match(sheet, /'=1\+1/);
});

test('the sheet holds the bench rows, the handoffs and the totals', () => {
  const sheet = L.exportSheet(payload, rows, entry);
  assert.match(sheet, /^Kitchen & slip checkup\nStamp,/);
  bench.map((r) => r.label).forEach((label) => assert.ok(sheet.indexOf(label) >= 0, label));
  assert.match(sheet, /From,Hands to,Amount/);
  assert.match(sheet, /Slip sum,\$12\.20/);
  assert.match(sheet, /Handoffs,\d/);
});

test('the note reads like a note and carries the stamp', () => {
  const note = L.exportNotes(payload, rows, entry);
  assert.match(note, /^# Kitchen & slip checkup/);
  assert.match(note, new RegExp('Stamp: ' + entry.hex));
  assert.equal((note.match(/^- /gm) || []).length, 7);
  assert.match(note, /Change one penny and this stamp no longer matches/);
});

/* ---------- the link tail ---------- */

test('a tail round-trips every field', () => {
  const tail = { pan: 'r8', pattern: 'pairs', row: 'potluck', size: 7, tamper: true };
  const encoded = L.encodeTail(tail);
  assert.equal(encoded, 'checkup=r8.pairs.potluck.7.1');
  assert.deepEqual(L.parseTail('#' + encoded), tail);
});

test('a quiet bench writes a quiet tail', () => {
  assert.equal(L.encodeTail({}), 'checkup=none.everyday.none.0.0');
  assert.equal(L.encodeTail(null), 'checkup=none.everyday.none.0.0');
  assert.deepEqual(L.parseTail('#checkup=none.everyday.none.0.0'),
    { pan: 'none', pattern: 'everyday', row: 'none', size: 0, tamper: false });
});

test('a tail lives at the end of a shared-book link', () => {
  const hash = '#z1.AbcDef_123&checkup=s99.turns.family.3.0';
  assert.deepEqual(L.parseTail(hash), { pan: 's99', pattern: 'turns', row: 'family', size: 3, tamper: false });
});

test('the last tail wins when a link carries two', () => {
  const hash = '#checkup=r6.everyday.none.0.0&checkup=r10.turns.half.4.1';
  assert.deepEqual(L.parseTail(hash), { pan: 'r10', pattern: 'turns', row: 'half', size: 4, tamper: true });
});

const HOSTILE = [
  '#checkup=', '#checkup', 'checkup=r8.everyday.none.7.0.extra',
  '#checkup=r8,everyday,none,7,0', '#checkup=r8.everyday.none.7',
  '#checkup=r8.everyday.none.7.0.', '#checkup=__proto__.everyday.none.0.0',
  '#checkup=constructor.everyday.none.0.0', '#checkup=r8.__proto__.none.0.0',
  '#checkup=r8.everyday.__proto__.0.0', '#checkup=r8.everyday.none.99.0',
  '#checkup=r8.everyday.none.13.0', '#checkup=r8.everyday.none.1.0',
  '#checkup=r8.everyday.none.2.0', '#checkup=r8.everyday.none.-1.0',
  '#checkup=r8.everyday.none.7.2',
  '#checkup=r8.everyday.none.7.10', '#checkup=<script>alert(1)</script>',
  '#checkup=r8.everyday.none.7.0;drop', '#checkup=R8.everyday.none.0.0',
  '#checkup=r8.EVERYDAY.none.0.0', '#checkup=none.everyday.none.0.0x',
  '#checkup%3Dr8.everyday.none.0.0', 'checkup=r8.everyday.none.0.0?x=1',
  '#checkup=r8 everyday none 0 0', '#checkup=r8..none.0.0'
];

HOSTILE.forEach((h, i) => {
  test('hostile link tail ' + i + ' opens a safe bench instead of breaking', () => {
    assert.equal(L.parseTail(h), null);
  });
});

test('an out-of-range bench is clamped, never written hostile', () => {
  assert.equal(L.encodeTail({ pan: 'r8', pattern: 'everyday', row: 'none', size: 13, tamper: 0 }),
    'checkup=r8.everyday.none.0.0');
  assert.equal(L.encodeTail({ pan: 'r8', pattern: 'everyday', row: 'none', size: 2, tamper: 0 }),
    'checkup=r8.everyday.none.0.0');
  assert.equal(L.encodeTail({ pan: 'r8', pattern: 'everyday', row: 'none', size: -3, tamper: 0 }),
    'checkup=r8.everyday.none.0.0');
  assert.equal(L.encodeTail({ pan: 'nope', pattern: 'nope', row: 'nope', size: 7, tamper: 1 }),
    'checkup=none.everyday.none.7.1');
});

test('every pan, pattern and row key survives the trip', () => {
  L.CURVE_PANS.forEach((p) => {
    assert.deepEqual(L.parseTail('#' + L.encodeTail({ pan: p.key })).pan, p.key);
  });
  ['everyday', 'pairs', 'turns'].forEach((k) => {
    assert.equal(L.parseTail('#' + L.encodeTail({ pattern: k })).pattern, k);
  });
  L.BENCH_ROWS.forEach((r) => {
    assert.equal(L.parseTail('#' + L.encodeTail({ row: r.key })).row, r.key);
  });
  for (let n = 3; n <= 12; n++) {
    assert.equal(L.parseTail('#' + L.encodeTail({ size: n })).size, n);
  }
});

test('a tail on an empty link still reads', () => {
  assert.equal(L.parseTail(''), null);
  assert.equal(L.parseTail('#'), null);
  assert.equal(L.parseTail(null), null);
  assert.equal(L.parseTail(undefined), null);
});

/* ---------- the book's own checks ---------- */

function realEnv() {
  const files = (() => { const s = { self: {} }; vm.runInNewContext(read('files.js'), s); return s.self.BOOK_FILES; })();
  const by = {};
  let ok = 0;
  files.forEach((f) => {
    const file = f === './' ? 'index.html' : f.replace(/^\.\//, '');
    if (fs.existsSync(path.join(ROOT, file))) { by[f] = read(file); ok += 1; }
  });
  const scripts = {};
  Object.keys(by).filter((n) => /\.js$/.test(n)).forEach((n) => { scripts[n] = by[n]; });
  return {
    html: by['./index.html'],
    css: by['./tokens.css'] + '\n' + by['./styles.css'],
    scripts,
    packageJson: by['./package.json'],
    bookFiles: files,
    fetchedOk: ok,
    savedOk: true,
    liveOk: true,
    recipeText: RECIPE,
    payload: L.bookPayload(freshState(), freshBench())
  };
}

test('the book runs at least 18 checks on itself', () => {
  assert.ok(L.selfChecks(realEnv()).length >= 18);
});

const selfRows = L.selfChecks(realEnv());
selfRows.forEach((row) => {
  test('book check ' + row.key + ': ' + row.label, () => {
    assert.equal(row.ok, true, row.detail);
    assert.equal(typeof row.detail, 'string');
    assert.ok(row.detail.length > 10);
  });
});

test('every book check is jargon-free for the reader', () => {
  selfRows.forEach((row) => {
    assert.deepEqual(E.findJargon(row.label + ' ' + row.detail), [], row.key);
  });
});

test('without page files the four promise checks honestly fail closed', () => {
  const rows = L.selfChecks({});
  const byKey = {};
  rows.forEach((r) => { byKey[r.key] = r; });
  assert.equal(byKey.colors.ok, false);
  assert.equal(byKey.files.ok, false);
  assert.equal(byKey.borrowed.ok, false);
  assert.equal(byKey.plain.ok, false);
  assert.equal(byKey['stamp-kat'].ok, true);
  assert.equal(byKey.parity.ok, true);
  assert.equal(byKey.tamper.ok, true);
});

test('a missing saved copy is reported by the files check', () => {
  const env = realEnv();
  env.savedOk = false;
  const row = L.selfChecks(env).filter((r) => r.key === 'files')[0];
  assert.equal(row.ok, false);
});

/* ---------- the bench wired into the page ---------- */

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
    this.children = [];
    this.classList = { add() {}, remove() {}, contains: () => false };
  }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  fire(type, extra) { (this.listeners[type] || []).forEach((fn) => fn.call(this, Object.assign({ preventDefault() {}, target: this, key: '' }, extra))); }
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
    if (sel === 'button') {
      return [...this.innerHTML.matchAll(/<button[^>]*data-pattern="([^"]*)"/g)].map((m) => ({
        getAttribute: (k) => (k === 'data-pattern' ? m[1] : null), setAttribute() {}
      }));
    }
    return [];
  }
  closest() { return null; }
  select() {}
  scrollIntoView() {}
  appendChild() {}
  remove() {}
  click() { this.clicked = true; }
  get offsetWidth() { return 1; }
}

const idsIn = (text) => [...text.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);

function makePage(overrides) {
  const ids = new Set(idsIn(html));
  const page = { els: {}, store: {}, statsEl: { textContent: '' }, replaced: [], made: [] };
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
    createElement: (tag) => { const el = new FakeEl(tag, page); page.made.push(el); return el; },
    addEventListener() {},
    querySelectorAll(sel) {
      if (sel === 'input[name="scale-by"]') return radios;
      if (sel === 'input[name="care-slot"]') return slots;
      return [];
    }
  };
  const written = {};
  const window = {
    document,
    location: { hash: '', href: 'http://book.test/index.html', protocol: 'http:', pathname: '/index.html', search: '' },
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(page.store, k) ? page.store[k] : null),
      setItem: (k, v) => { page.store[k] = v; }
    },
    history: { replaceState: (a, b, url) => { page.replaced.push(url); window.location.hash = url.slice(url.indexOf('#')); } },
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout() {},
    addEventListener() {},
    print() { written.printed = true; },
    getComputedStyle: () => ({ getPropertyValue: () => '', content: 'none' }),
    fetch: (name) => {
      const file = name.replace(/^\.\//, '');
      const real = file === '' ? 'index.html' : file;
      if (!fs.existsSync(path.join(ROOT, real))) return Promise.resolve({ ok: false, text: () => Promise.resolve('') });
      return Promise.resolve({ ok: true, text: () => Promise.resolve(fs.readFileSync(path.join(ROOT, real), 'utf8')) });
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
  const made = makePage(Object.assign({ GrandmaBookLab: LAB }, overrides || {}));
  made.context.window.document = made.context.document;
  vm.runInContext(appSource, vm.createContext(Object.assign(made.context, { window: made.context.window })));
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  return made;
}

function savedCopyOf(page) {
  const files = (() => { const s = { self: {} }; vm.runInNewContext(read('files.js'), s); return s.self.BOOK_FILES; })();
  return { caches: { open: () => Promise.resolve({ keys: () => Promise.resolve(files) }) },
    navigator: { onLine: false, serviceWorker: { register: () => Promise.resolve(), ready: Promise.resolve() } } };
}

test('the bench fills in on a page that has the lab', async () => {
  const { page } = await boot();
  const rows = page.get('bench-rows').innerHTML;
  assert.equal((rows.match(/data-bench-row="/g) || []).length, 6);
  assert.match(rows, /Half batch, serves two/);
  assert.match(page.get('pan-curve').innerHTML, /<svg class="chart(?: chart-bench)?"/);
  assert.equal((page.get('pan-curve').innerHTML.match(/data-pan="/g) || []).length, 7);
  assert.equal((page.get('split-bars').innerHTML.match(/data-size="/g) || []).length, 10);
  assert.equal((page.get('split-bars').innerHTML.match(/chart-bar-alt/g) || []).length, 10);
  assert.match(page.get('stamp-line').textContent, /^Stamp [0-9a-f]{64}$/);
  assert.match(page.get('split-detail').textContent, /saves \d+ handoffs/);
});

test('every picture the bench draws passes the two-crayon attribute check', async () => {
  const { page } = await boot();
  [page.get('pan-curve').innerHTML, page.get('split-bars').innerHTML].forEach((svg) => {
    assert.deepEqual(E.auditSvgAttributes(svg).offenders, []);
    assert.match(svg, /role="img" aria-label="[^"]+"/);
  });
});

test('clicking a bench row applies its scale to the kitchen', async () => {
  const { page } = await boot();
  const target = { closest: () => ({ getAttribute: () => 'potluck' }) };
  page.get('bench-rows').fire('click', { target });
  assert.equal(page.get('servings-to').value, 8);
  assert.match(page.get('scale-readout').textContent, /times 2/);
  const rows = page.get('bench-rows').innerHTML;
  assert.match(rows, /data-bench-row="potluck" data-picked="yes"/);
  assert.equal(page.replaced.slice(-1)[0].indexOf('checkup=') >= 0, true);
});

test('clicking a pan marker moves the baking pan', async () => {
  const { page } = await boot();
  page.get('pan-curve').fire('click', { target: { closest: () => ({ getAttribute: () => 's913' }) } });
  assert.equal(page.get('pt-shape').value, 'rect');
  assert.equal(page.get('pt-width').value, '9');
  assert.equal(page.get('pt-height').value, '13');
  assert.match(page.get('pan-detail').textContent, /9 by 13 sheet/);
  assert.match(page.get('pan-curve').innerHTML, /data-pan="s913" data-picked="yes"/);
});

test('clicking a bar column names one house size', async () => {
  const { page } = await boot();
  page.get('split-bars').fire('click', { target: { closest: () => ({ getAttribute: () => '7' }) } });
  assert.match(page.get('split-detail').textContent, /house of 7/);
  assert.match(page.get('split-bars').innerHTML, /data-size="7" data-picked="yes"/);
  page.get('split-bars').fire('click', { target: { closest: () => ({ getAttribute: () => '7' }) } });
  assert.match(page.get('split-detail').textContent, /Pick a column/);
});

test('the kind-of-week buttons redraw the bars', async () => {
  const { page } = await boot();
  page.get('split-pick').fire('click', { target: { closest: () => ({ getAttribute: () => 'turns' }) } });
  assert.match(page.replaced.slice(-1)[0], /checkup=[a-z0-9]+\.turns/);
});

test('check the stamp answers plainly', async () => {
  const { page } = await boot();
  page.get('stamp-check').fire('click');
  assert.match(page.get('bench-note').textContent, /matches one the book just worked out again/);
});

test('moving one penny shows a changed stamp and changing back restores it', async () => {
  const { page } = await boot();
  const before = page.get('stamp-line').textContent;
  page.get('stamp-tamper').fire('click');
  assert.match(page.get('stamp-line').textContent, /one penny moved/);
  assert.notEqual(page.get('stamp-line').textContent, before);
  assert.match(page.get('stamp-detail').textContent, /An honest book catches that/);
  page.get('stamp-tamper').fire('click');
  assert.equal(page.get('stamp-line').textContent, before);
});

test('the three save buttons each write a file with the same stamp', async () => {
  const { page } = await boot({
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    Blob: function () {}
  });
  ['save-numbers', 'save-sheet', 'save-notes'].forEach((id) => page.get(id).fire('click'));
  assert.deepEqual(page.made.map((a) => a.download),
    ['kitchen-checkup-numbers.json', 'kitchen-checkup-sheet.csv', 'kitchen-checkup-note.md']);
  assert.equal(page.made.every((a) => a.clicked === true), true);
});

test('the bench link carries the book and the bench together', async () => {
  const copied = [];
  const { page } = await boot({ navigator: { onLine: true, clipboard: { writeText: (t) => { copied.push(t); return Promise.resolve(); } } } });
  page.get('bench-link').fire('click');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(copied.length, 1);
  assert.match(copied[0], /#(z1|p1)\..+&checkup=/);
});

test('run all book checks fills the list and they all pass', async () => {
  const { page } = await boot(savedCopyOf());
  await new Promise((r) => setTimeout(r, 20));
  page.get('self-run').fire('click');
  await new Promise((r) => setTimeout(r, 20));
  const rows = page.get('self-list').innerHTML;
  const states = [...rows.matchAll(/data-state="(yes|no|wait)"/g)].map((m) => m[1]);
  assert.ok(states.length >= 18);
  assert.deepEqual(states, states.map(() => 'yes'));
  assert.match(page.get('self-count').textContent, new RegExp('^' + states.length + ' of ' + states.length + ' checks pass'));
});

test('a link tail on the address restores the bench and the kitchen', async () => {
  const { page } = await boot({ location: { hash: '#checkup=r8.pairs.potluck.7.1', href: 'http://book.test/index.html', protocol: 'http:', pathname: '/index.html', search: '' } });
  assert.equal(page.get('servings-to').value, 8);
  assert.equal(page.get('pt-shape').value, 'round');
  assert.equal(page.get('pt-size').value, '8');
  assert.match(page.get('stamp-line').textContent, /one penny moved/);
  assert.match(page.get('split-detail').textContent, /house of 7/);
});

test('a shared-book link with a tail restores both', async () => {
  const S = require('../share.js');
  const packed = await S.pack({ v: 1, recipeText: '1 cup flour', from: 4, to: 9, people: 'Alma, Ben' }, E);
  const hash = '#' + packed + '&checkup=s99.turns.none.3.0';
  const { page } = await boot({ location: { hash, href: 'http://book.test/index.html', protocol: 'http:', pathname: '/index.html', search: '' } });
  assert.equal(page.get('servings-to').value, 9);
  assert.equal(page.get('people-input').value, 'Alma, Ben');
  assert.equal(page.get('pt-shape').value, 'rect');
  assert.equal(page.get('pt-width').value, '9');
  assert.equal(page.get('pt-height').value, '9');
});

test('a broken tail alone cannot stop the book from opening', async () => {
  const { page } = await boot({ location: { hash: '#checkup=%3Cscript%3E', href: 'http://book.test/index.html', protocol: 'http:', pathname: '/index.html', search: '' } });
  assert.match(page.get('ingredient-list').innerHTML, /all-purpose flour/);
  assert.match(page.get('stamp-line').textContent, /^Stamp [0-9a-f]{64}$/);
});

test('a page without the lab still opens every part', async () => {
  const made = makePage();
  made.context.window.document = made.context.document;
  vm.runInContext(appSource, vm.createContext(Object.assign(made.context, { window: made.context.window })));
  await new Promise((r) => setImmediate(r));
  assert.match(made.page.get('ingredient-list').innerHTML, /all-purpose flour/);
  assert.equal(made.page.get('bench-rows').innerHTML, '');
});

/* ---------- the bench markup itself ---------- */

test('the checkup section is real markup wired to real controls', () => {
  ['bench-rows', 'pan-curve', 'split-bars', 'split-pick', 'stamp-line', 'stamp-check',
    'stamp-tamper', 'save-numbers', 'save-sheet', 'save-notes', 'bench-link', 'self-run',
    'self-list', 'self-count', 'bench-row-note', 'pan-detail', 'split-detail', 'stamp-detail', 'bench-note'
  ].forEach((id) => assert.ok(html.indexOf('id="' + id + '"') >= 0, id));
});

test('the checkup section passes the plain-English scan', () => {
  const section = /<section class="part bench[^"]*" id="checkup"[\s\S]*?<\/section>/.exec(html)[0];
  assert.deepEqual(E.findJargon(E.visibleText(section)), []);
});

test('the bench table and charts keep their words in the two crayons', () => {
  const styles = read('styles.css');
  const benchCss = styles.slice(styles.indexOf('the checkup bench'), styles.indexOf('the check ----------'));
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(benchCss), false);
  assert.deepEqual(E.auditCss(benchCss).offenders, []);
});

test('the mobile layout cannot push the bench sideways', () => {
  const styles = read('styles.css');
  assert.match(styles, /bench-grid \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /64rem\)[\s\S]*?\.bench-grid/);
  assert.match(styles, /bench-table-wrap \{ overflow-x: auto/);
});

test('a formula behind any invisible format character opens as plain text', () => {
  for (const input of ['\u061c=1+1', '\u180e+2', '\u2060@sum', '\ufeff=cmd']) {
    const escaped = L.csvCell(input);
    const first = escaped.charAt(0) === '"' ? escaped.charAt(1) : escaped.charAt(0);
    assert.equal(first, "'", input);
  }
});
