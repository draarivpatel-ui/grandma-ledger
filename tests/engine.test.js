'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');

const f = (n, d) => E.fr(n, d);

/* ---------- fractions ---------- */

test('gcd finds the greatest common divisor', () => {
  assert.equal(E.gcd(12, 18), 6);
  assert.equal(E.gcd(7, 13), 1);
  assert.equal(E.gcd(0, 5), 5);
  assert.equal(E.gcd(-12, 18), 6);
});

test('fr reduces, fixes the sign and defaults the bottom to one', () => {
  assert.deepEqual(f(6, 8), { n: 3, d: 4 });
  assert.deepEqual(f(3, -6), { n: -1, d: 2 });
  assert.deepEqual(f(5), { n: 5, d: 1 });
  assert.deepEqual(f(0, 9), { n: 0, d: 1 });
});

test('fr refuses zero bottoms and non whole numbers', () => {
  assert.throws(() => f(1, 0), /zero/);
  assert.throws(() => f(1.5, 2), /whole numbers/);
  assert.throws(() => f(1, 0.5), /whole numbers/);
});

test('fraction arithmetic is exact', () => {
  assert.deepEqual(E.frAdd(f(1, 3), f(1, 6)), f(1, 2));
  assert.deepEqual(E.frSub(f(1, 2), f(1, 3)), f(1, 6));
  assert.deepEqual(E.frMul(f(2, 3), f(3, 4)), f(1, 2));
  assert.deepEqual(E.frDiv(f(1, 2), f(1, 4)), f(2));
  assert.throws(() => E.frDiv(f(1, 2), f(0)), /zero/);
});

test('fraction comparison and equality', () => {
  assert.equal(E.frCmp(f(1, 3), f(1, 2)), -1);
  assert.equal(E.frCmp(f(1, 2), f(1, 3)), 1);
  assert.equal(E.frCmp(f(2, 4), f(1, 2)), 0);
  assert.equal(E.frEq(f(1, 2), f(3, 6)), true);
  assert.equal(E.frEq(f(1, 2), f(1, 3)), false);
  assert.equal(E.frNum(f(3, 4)), 0.75);
});

test('isFraction only accepts whole number pairs', () => {
  assert.equal(E.isFraction(f(1, 2)), true);
  assert.equal(E.isFraction(null), false);
  assert.equal(E.isFraction(5), false);
  assert.equal(E.isFraction({ n: 1.5, d: 2 }), false);
});

test('parseQuantity reads whole, fraction, mixed and decimal amounts', () => {
  assert.deepEqual(E.parseQuantity('2'), f(2));
  assert.deepEqual(E.parseQuantity('3/4'), f(3, 4));
  assert.deepEqual(E.parseQuantity('1 1/2'), f(3, 2));
  assert.deepEqual(E.parseQuantity('0.75'), f(3, 4));
  assert.deepEqual(E.parseQuantity('.5'), f(1, 2));
  assert.deepEqual(E.parseQuantity(1.25), f(5, 4));
  assert.deepEqual(E.parseQuantity(f(2, 3)), f(2, 3));
});

test('parseQuantity understands pasted fraction characters', () => {
  assert.deepEqual(E.parseQuantity('½'), f(1, 2));
  assert.deepEqual(E.parseQuantity('1¾'), f(7, 4));
  assert.deepEqual(E.parseQuantity('⅓'), f(1, 3));
});

test('parseQuantity rejects nonsense in plain words', () => {
  assert.throws(() => E.parseQuantity('lots'), /could not read/);
  assert.throws(() => E.parseQuantity(-1), /could not read/);
  assert.throws(() => E.parseQuantity(NaN), /could not read/);
  assert.throws(() => E.parseQuantity('1/0'), /zero/);
});

test('toMixedFraction and formatMixed print real kitchen fractions', () => {
  assert.deepEqual(E.toMixedFraction(f(3, 2)), { whole: 1, n: 1, d: 2, negative: false });
  assert.deepEqual(E.toMixedFraction(f(1, 3)), { whole: 0, n: 1, d: 3, negative: false });
  assert.deepEqual(E.toMixedFraction(f(-3, 2)), { whole: 1, n: 1, d: 2, negative: true });
  assert.equal(E.formatMixed(f(3, 2)), '1 1/2');
  assert.equal(E.formatMixed(f(1, 3)), '1/3');
  assert.equal(E.formatMixed(f(4)), '4');
  assert.equal(E.formatMixed(f(0)), '0');
  assert.equal(E.formatMixed(f(-3, 2)), '-1 1/2');
});

test('scaled amounts never print long decimals', () => {
  const third = E.scaleIngredient({ name: 'sugar', quantity: '1', unit: 'cup' }, f(1, 3));
  assert.equal(third.text, '1/3 cup');
  assert.equal(/\d\.\d/.test(third.text), false);
});

test('snapToKitchen picks the nearest friendly fraction', () => {
  assert.deepEqual(E.snapToKitchen(f(333, 1000)), f(1, 3));
  assert.deepEqual(E.snapToKitchen(f(5, 8), [2, 4]), f(1, 2));
  assert.deepEqual(E.snapToKitchen(f(11, 16), [2, 4]), f(3, 4));
  assert.deepEqual(E.snapToKitchen(f(11, 4)), f(11, 4));
  assert.deepEqual(E.snapToKitchen(f(0)), f(0));
  assert.deepEqual(E.snapToKitchen(f(-1, 2)), f(0));
});

test('snapToKitchen never turns a real amount into nothing', () => {
  assert.deepEqual(E.snapToKitchen(f(1, 100)), f(1, 16));
  assert.deepEqual(E.snapToKitchen(f(1, 100), [2, 4]), f(1, 4));
});

test('snapToKitchen sends ties to the simpler fraction', () => {
  assert.deepEqual(E.snapToKitchen(f(3, 16), [2, 4, 8]), f(1, 4));
  assert.deepEqual(E.snapToKitchen(f(1, 4), [2, 4, 8]), f(1, 4));
});

/* ---------- kitchen measures ---------- */

test('normalizeUnit understands everyday spellings', () => {
  assert.equal(E.normalizeUnit('Cups'), 'cup');
  assert.equal(E.normalizeUnit('tablespoon'), 'tbsp');
  assert.equal(E.normalizeUnit('tsp.'), 'tsp');
  assert.equal(E.normalizeUnit('fl oz'), 'floz');
  assert.equal(E.normalizeUnit('pounds'), 'lb');
  assert.equal(E.normalizeUnit('pinches'), 'pinch');
  assert.equal(E.normalizeUnit('g'), 'g');
  assert.throws(() => E.normalizeUnit('bushel'), /do not know the measure/);
  assert.throws(() => E.normalizeUnit('constructor'), /do not know the measure/);
});

test('convertKitchenMeasure swaps spoons and cups exactly', () => {
  const a = E.convertKitchenMeasure('1', 'cup', 'tbsp');
  assert.deepEqual(a.quantity, f(16));
  assert.equal(a.text, '16 tbsp');
  assert.equal(a.approximate, false);
  assert.equal(a.rounded, false);
  assert.equal(E.convertKitchenMeasure('3', 'tsp', 'tbsp').text, '1 tbsp');
  assert.equal(E.convertKitchenMeasure('1', 'floz', 'tbsp').text, '2 tbsp');
  assert.equal(E.convertKitchenMeasure('1/2', 'cup', 'floz').text, '4 fl oz');
  assert.equal(E.convertKitchenMeasure('2', 'cup', 'cup').text, '2 cups');
});

test('convertKitchenMeasure between grams and ounces is flagged as close, not exact', () => {
  const a = E.convertKitchenMeasure('1', 'oz', 'g');
  assert.equal(a.text, '28 g');
  assert.equal(a.approximate, true);
  assert.equal(a.rounded, true);
  const b = E.convertKitchenMeasure('100', 'g', 'oz');
  assert.equal(b.text, '3 1/2 oz');
  assert.equal(b.approximate, true);
  assert.equal(E.convertKitchenMeasure('1', 'lb', 'oz').text, '16 oz');
});

test('convertKitchenMeasure will not mix weight and volume', () => {
  assert.throws(() => E.convertKitchenMeasure('1', 'cup', 'g'), /not the same kind/);
  assert.throws(() => E.convertKitchenMeasure('1', 'pinch', 'tsp'), /not the same kind/);
});

test('parseIngredientLine reads amount, measure and name', () => {
  assert.deepEqual(E.parseIngredientLine('1 3/4 cups all-purpose flour'),
    { quantity: f(7, 4), unit: 'cup', name: 'all-purpose flour', wholeOnly: false });
  assert.deepEqual(E.parseIngredientLine('2 tbsp. melted butter'),
    { quantity: f(2), unit: 'tbsp', name: 'melted butter', wholeOnly: false });
  assert.deepEqual(E.parseIngredientLine('250 g oats'),
    { quantity: f(250), unit: 'g', name: 'oats', wholeOnly: false });
  assert.deepEqual(E.parseIngredientLine('½ cup of milk'),
    { quantity: f(1, 2), unit: 'cup', name: 'milk', wholeOnly: false });
});

test('parseIngredientLine treats a bare count as whole things and marks eggs', () => {
  assert.deepEqual(E.parseIngredientLine('3 ripe bananas'),
    { quantity: f(3), unit: 'each', name: 'ripe bananas', wholeOnly: false });
  assert.equal(E.parseIngredientLine('2 eggs').wholeOnly, true);
  assert.equal(E.parseIngredientLine('2 large garlic cloves').unit, 'each');
});

test('parseIngredientLine handles a pinch in words', () => {
  assert.deepEqual(E.parseIngredientLine('a pinch of salt'),
    { quantity: f(1), unit: 'pinch', name: 'salt', wholeOnly: false });
  assert.equal(E.parseIngredientLine('2 pinches cinnamon').unit, 'pinch');
});

test('parseIngredientLine explains lines it cannot read', () => {
  assert.throws(() => E.parseIngredientLine('flour'), /could not find an amount/);
});

test('parseRecipeText keeps good lines and reports the bad ones by number', () => {
  const r = E.parseRecipeText('1 cup flour\n\nsome salt\n2 eggs\r\n');
  assert.equal(r.items.length, 2);
  assert.equal(r.problems.length, 1);
  assert.equal(r.problems[0].line, 3);
  assert.equal(r.problems[0].text, 'some salt');
});

test('scaleRecipeIngredients doubles, halves and thirds with kitchen words', () => {
  const items = E.parseRecipeText('1 cup flour\n1 tsp vanilla\n3 tbsp milk\n1/2 cup butter').items;
  assert.deepEqual(E.scaleRecipeIngredients(items, 2).map((x) => x.text), ['2 cups', '2 tsp', '6 tbsp', '1 cup']);
  assert.deepEqual(E.scaleRecipeIngredients(items, f(1, 2)).map((x) => x.text), ['1/2 cup', '1/2 tsp', '1 1/2 tbsp', '1/4 cup']);
  assert.deepEqual(E.scaleRecipeIngredients(items, '3/2').map((x) => x.text), ['1 1/2 cups', '1 1/2 tsp', '4 1/2 tbsp', '3/4 cup']);
});

test('scaleRecipeIngredients moves to the unit a cook would reach for', () => {
  const sugar = (q, u) => E.scaleIngredient({ name: 'sugar', quantity: q, unit: u }, 1).text;
  assert.equal(sugar('16', 'tbsp'), '1 cup');
  assert.equal(sugar('4', 'tbsp'), '1/4 cup');
  assert.equal(sugar('12', 'tsp'), '1/4 cup');
  assert.equal(sugar('3', 'tsp'), '1 tbsp');
  assert.equal(sugar('2', 'tsp'), '2 tsp');
  assert.equal(sugar('8', 'floz'), '1 cup');
  assert.equal(sugar('6', 'tbsp'), '6 tbsp');
});

test('scaleRecipeIngredients says so when it rounds', () => {
  const r = E.scaleIngredient({ name: 'flour', quantity: '1 3/4', unit: 'cup' }, f(3, 2));
  assert.equal(r.text, '2 2/3 cups');
  assert.equal(r.rounded, true);
  assert.equal(r.exactText, '2 5/8 cups');
  assert.equal(E.scaleIngredient({ name: 'milk', quantity: '1', unit: 'cup' }, f(1, 3)).exactText, '1/3 cup');
  assert.equal(E.scaleIngredient({ name: 'salt', quantity: '1', unit: 'pinch' }, f(3, 2)).exactText, '1 1/2 pinches');
  assert.equal(E.scaleIngredient({ name: 'egg', quantity: '3', unit: 'each' }, f(1, 2)).exactText, '1 1/2');
  const clean = E.scaleIngredient({ name: 'flour', quantity: '1', unit: 'cup' }, f(3, 2));
  assert.equal(clean.rounded, false);
});

test('scaleRecipeIngredients keeps eggs whole and explains it', () => {
  const eggs = E.parseIngredientLine('3 eggs');
  const r = E.scaleIngredient(eggs, f(1, 2));
  assert.equal(r.text, '2');
  assert.equal(r.rounded, true);
  assert.match(r.note, /Whole ones only/);
  assert.equal(E.scaleIngredient(eggs, 2).note, '');
  assert.equal(E.scaleIngredient(E.parseIngredientLine('1 egg'), f(1, 4)).text, '1');
});

test('scaleRecipeIngredients allows halves for other counted things', () => {
  const onion = E.parseIngredientLine('1 onion');
  assert.equal(E.scaleIngredient(onion, f(3, 2)).text, '1 1/2');
  assert.equal(E.scaleIngredient(onion, 2).text, '2');
});

test('scaleRecipeIngredients counts pinches in whole numbers', () => {
  const salt = E.parseIngredientLine('a pinch of salt');
  assert.equal(E.scaleIngredient(salt, 1).text, '1 pinch');
  assert.equal(E.scaleIngredient(salt, 2).text, '2 pinches');
  assert.equal(E.scaleIngredient(salt, f(1, 4)).text, '1 pinch');
});

test('scaleRecipeIngredients rounds grams to whole grams and keeps ounces to quarters', () => {
  assert.equal(E.scaleIngredient({ name: 'oats', quantity: '250', unit: 'g' }, f(1, 3)).text, '83 g');
  assert.equal(E.scaleIngredient({ name: 'oats', quantity: '1', unit: 'g' }, f(1, 10)).text, '1 g');
  assert.equal(E.scaleIngredient({ name: 'ham', quantity: '6', unit: 'oz' }, f(3, 4)).text, '4 1/2 oz');
  assert.equal(E.scaleIngredient({ name: 'beef', quantity: '1', unit: 'lb' }, 2).text, '2 lb');
});

test('scaleRecipeIngredients uses singular for one and plural above one', () => {
  assert.equal(E.scaleIngredient({ name: 'x', quantity: '1', unit: 'cup' }, 1).text, '1 cup');
  assert.equal(E.scaleIngredient({ name: 'x', quantity: '1/2', unit: 'cup' }, 1).text, '1/2 cup');
  assert.equal(E.scaleIngredient({ name: 'x', quantity: '1 1/2', unit: 'cup' }, 1).text, '1 1/2 cups');
});

test('scaleRecipeIngredients refuses a scale of nothing', () => {
  assert.throws(() => E.scaleRecipeIngredients([], 0), /more than nothing/);
  assert.throws(() => E.scaleRecipeIngredients([], '0/5'), /more than nothing/);
});

test('servingsFactor is the exact ratio of two crowds', () => {
  assert.deepEqual(E.servingsFactor(4, 6), f(3, 2));
  assert.deepEqual(E.servingsFactor(8, 2), f(1, 4));
  assert.throws(() => E.servingsFactor(0, 4), /whole numbers/);
  assert.throws(() => E.servingsFactor(4, 2.5), /whole numbers/);
});

/* ---------- baking pans ---------- */

test('panRatio is exact for two rectangles', () => {
  const r = E.panRatio({ shape: 'rect', width: 9, height: 13 }, { shape: 'rect', width: 8, height: 8 });
  assert.deepEqual(r.ratio, f(64, 117));
  assert.equal(r.exact, true);
  assert.equal(r.areaFrom, 117);
  assert.equal(r.areaTo, 64);
});

test('panRatio is exact for two round pans because the pi cancels', () => {
  const r = E.panRatio({ shape: 'round', size: 8 }, { shape: 'round', size: 10 });
  assert.deepEqual(r.ratio, f(25, 16));
  assert.equal(r.exact, true);
  assert.ok(Math.abs(r.areaFrom - 50.2655) < 0.001);
});

test('panRatio between round and rectangle is an honest estimate', () => {
  const r = E.panRatio({ shape: 'round', size: 9 }, { shape: 'rect', width: 9, height: 13 });
  assert.equal(r.exact, false);
  assert.ok(Math.abs(E.frNum(r.ratio) - 1.839) < 0.001);
});

test('panRatio accepts fractional sizes', () => {
  const r = E.panRatio({ shape: 'rect', width: '8 1/2', height: 11 }, { shape: 'rect', width: 8, height: 8 });
  assert.deepEqual(r.ratio, f(128, 187));
});

test('panRatio rejects bad pans in plain words', () => {
  assert.throws(() => E.panRatio({ shape: 'triangle' }, { shape: 'round', size: 8 }), /round pan or a rectangle/);
  assert.throws(() => E.panRatio({ shape: 'round', size: 0 }, { shape: 'round', size: 8 }), /bigger than nothing/);
  assert.throws(() => E.panRatio({ shape: 'rect', width: 5, height: 0 }, { shape: 'round', size: 8 }), /bigger than nothing/);
  assert.throws(() => E.panRatio(null, { shape: 'round', size: 8 }), /round pan or a rectangle/);
});

test('panPlan gives a friendly scale for a bigger pan', () => {
  const p = E.panPlan({ shape: 'rect', width: 9, height: 5 }, { shape: 'rect', width: 8, height: 8 });
  assert.deepEqual(p.areaRatio, f(64, 45));
  assert.deepEqual(p.recipeFactor, f(11, 8));
  assert.equal(p.snapped, true);
  assert.deepEqual(p.depthWithoutScaling, f(2, 3));
  assert.match(p.scaledAdvice, /Bigger pan\. Multiply the recipe by 1 3\/8/);
  assert.match(p.unscaledAdvice, /about 2\/3 as deep/);
  assert.match(p.unscaledAdvice, /bakes faster/);
});

test('panPlan gives a friendly scale for a smaller pan', () => {
  const p = E.panPlan({ shape: 'rect', width: 9, height: 13 }, { shape: 'round', size: 8 });
  assert.ok(E.frCmp(p.recipeFactor, f(1)) < 0);
  assert.match(p.scaledAdvice, /Smaller pan/);
  assert.match(p.unscaledAdvice, /thick layer/);
});

test('panPlan leaves an unchanged pan alone', () => {
  const p = E.panPlan({ shape: 'round', size: 9 }, { shape: 'round', size: 9 });
  assert.deepEqual(p.recipeFactor, f(1));
  assert.equal(p.snapped, false);
  assert.equal(p.scaledAdvice, 'Same size pan. Use the recipe as written.');
  assert.equal(p.unscaledAdvice, p.scaledAdvice);
});

test('panPlan marks a doubled round pan as exactly double', () => {
  const p = E.panPlan({ shape: 'round', size: 6 }, { shape: 'round', size: '8 1/2' });
  assert.deepEqual(p.areaRatio, f(289, 144));
  assert.deepEqual(p.recipeFactor, f(2));
  assert.equal(p.snapped, true);
});

/* ---------- money ---------- */

test('parseMoneyToCents reads dollars and cents without decimals math', () => {
  assert.equal(E.parseMoneyToCents('12'), 1200);
  assert.equal(E.parseMoneyToCents('12.5'), 1250);
  assert.equal(E.parseMoneyToCents('$1,234.56'), 123456);
  assert.equal(E.parseMoneyToCents('0.07'), 7);
  assert.equal(E.parseMoneyToCents(' 3.10 '), 310);
  assert.equal(E.parseMoneyToCents('19.99'), 1999);
  assert.throws(() => E.parseMoneyToCents('12.345'), /could not read that money/);
  assert.throws(() => E.parseMoneyToCents('-5'), /could not read that money/);
  assert.throws(() => E.parseMoneyToCents('abc'), /could not read that money/);
});

test('formatCents prints dollars with commas and two digits of cents', () => {
  assert.equal(E.formatCents(0), '$0.00');
  assert.equal(E.formatCents(5), '$0.05');
  assert.equal(E.formatCents(1250), '$12.50');
  assert.equal(E.formatCents(123456), '$1,234.56');
  assert.equal(E.formatCents(100000000), '$1,000,000.00');
  assert.equal(E.formatCents(-380), '-$3.80');
});

test('splitCents always adds back to the total', () => {
  assert.deepEqual(E.splitCents(1000, 3, 0), [334, 333, 333]);
  assert.deepEqual(E.splitCents(1000, 3, 1), [333, 334, 333]);
  assert.deepEqual(E.splitCents(1000, 3, 2), [333, 333, 334]);
  assert.deepEqual(E.splitCents(1001, 3, 2), [334, 333, 334]);
  assert.deepEqual(E.splitCents(900, 3, 0), [300, 300, 300]);
  for (let total = 1; total < 200; total += 7) {
    for (let count = 1; count <= 6; count++) {
      const shares = E.splitCents(total, count, total % count);
      assert.equal(shares.reduce((a, b) => a + b, 0), total);
    }
  }
});

test('parsePeopleList splits on commas, semicolons and new lines', () => {
  assert.deepEqual(E.parsePeopleList('Alma, Ben;Cora\n Dev ,, '), ['Alma', 'Ben', 'Cora', 'Dev']);
});

/* ---------- settling up ---------- */

function netOf(result) {
  const net = {};
  result.people.forEach((p) => { net[p] = 0; });
  result.ledger.forEach((row) => { net[row.name] = row.netCents; });
  result.transfers.forEach((t) => {
    net[t.from] += t.cents;
    net[t.to] -= t.cents;
  });
  return net;
}

test('two people: one pays, the other hands back half', () => {
  const r = E.settleHouseholdBills({
    people: ['Alma', 'Ben'],
    expenses: [{ payer: 'Alma', amount: '40.00' }]
  });
  assert.deepEqual(r.transfers, [{ from: 'Ben', to: 'Alma', cents: 2000 }]);
  assert.equal(r.handoffs, 1);
  assert.equal(r.totalCents, 4000);
});

test('three people: paid equals owed down to the cent', () => {
  const r = E.settleHouseholdBills({
    people: ['Alma', 'Ben', 'Cora'],
    expenses: [
      { payer: 'Alma', amount: '30.01' },
      { payer: 'Ben', amount: '12.40', sharedBy: ['Ben', 'Cora'] }
    ]
  });
  const paid = r.ledger.reduce((s, row) => s + row.paidCents, 0);
  const owed = r.ledger.reduce((s, row) => s + row.owedCents, 0);
  assert.equal(paid, 4241);
  assert.equal(owed, 4241);
  assert.equal(r.ledger.reduce((s, row) => s + row.netCents, 0), 0);
  assert.deepEqual(r.transfers, [
    { from: 'Cora', to: 'Alma', cents: 1620 },
    { from: 'Ben', to: 'Alma', cents: 380 }
  ]);
  Object.values(netOf(r)).forEach((v) => assert.equal(v, 0));
});

test('four people: everyone ends at zero with the fewest handoffs', () => {
  const r = E.settleHouseholdBills({
    people: ['Alma', 'Ben', 'Cora', 'Dev'],
    expenses: [
      { payer: 'Alma', amount: '100.00' },
      { payer: 'Ben', amount: '60.00' },
      { payer: 'Cora', amount: '20.00' }
    ]
  });
  Object.values(netOf(r)).forEach((v) => assert.equal(v, 0));
  assert.deepEqual(r.ledger.map((row) => row.netCents), [5500, 1500, -2500, -4500]);
  assert.equal(r.handoffs, 3);
});

test('two separate pairs settle inside themselves, so the handoffs stay at two', () => {
  const r = E.settleHouseholdBills({
    people: ['Alma', 'Ben', 'Cora', 'Dev'],
    expenses: [
      { payer: 'Alma', amount: '10.00', sharedBy: ['Alma', 'Ben'] },
      { payer: 'Cora', amount: '10.00', sharedBy: ['Cora', 'Dev'] }
    ]
  });
  assert.equal(r.handoffs, 2);
  assert.deepEqual(r.transfers, [
    { from: 'Ben', to: 'Alma', cents: 500 },
    { from: 'Dev', to: 'Cora', cents: 500 }
  ]);
});

test('five people in two separate groups need three handoffs, not four', () => {
  // {A, B, C} settle among themselves and {D, E} settle among themselves
  const r = E.settleHouseholdBills({
    people: ['A', 'B', 'C', 'D', 'E'],
    expenses: [
      { payer: 'A', cents: 1400, sharedBy: ['A', 'B', 'C'] },
      { payer: 'D', cents: 1000, sharedBy: ['D', 'E'] }
    ]
  });
  Object.values(netOf(r)).forEach((v) => assert.equal(v, 0));
  assert.equal(r.handoffs, 3);
});

test('an already settled house needs no handoffs', () => {
  const r = E.settleHouseholdBills({
    people: ['Alma', 'Ben'],
    expenses: [
      { payer: 'Alma', amount: '10.00' },
      { payer: 'Ben', amount: '10.00' }
    ]
  });
  assert.deepEqual(r.transfers, []);
  assert.equal(r.handoffs, 0);
});

test('with no bills there is nothing to hand over', () => {
  const r = E.settleHouseholdBills({ people: ['Alma', 'Ben'], expenses: [] });
  assert.deepEqual(r.transfers, []);
  assert.equal(r.totalCents, 0);
});

test('a one person house is fine', () => {
  const r = E.settleHouseholdBills({ people: ['Alma'], expenses: [{ payer: 'Alma', amount: '5' }] });
  assert.deepEqual(r.transfers, []);
});

test('extra cents rotate so one person does not always pay them', () => {
  const people = ['Alma', 'Ben', 'Cora'];
  const expenses = [
    { payer: 'Alma', cents: 100 }, { payer: 'Alma', cents: 100 }, { payer: 'Alma', cents: 100 }
  ];
  const r = E.settleHouseholdBills({ people, expenses });
  const owed = r.ledger.map((row) => row.owedCents);
  assert.deepEqual(owed, [100, 100, 100]);
});

test('settleHouseholdBills reads amount text and cents the same way', () => {
  const a = E.settleHouseholdBills({ people: ['A', 'B'], expenses: [{ payer: 'A', amount: '$1,000.50' }] });
  const b = E.settleHouseholdBills({ people: ['A', 'B'], expenses: [{ payer: 'A', cents: 100050 }] });
  assert.deepEqual(a, b);
});

test('settleHouseholdBills rejects bad input in plain words', () => {
  assert.throws(() => E.settleHouseholdBills({ people: [] }), /at least one person/);
  assert.throws(() => E.settleHouseholdBills({ people: ['Al', 'al'] }), /share the name/);
  assert.throws(() => E.settleHouseholdBills({ people: ['A'], expenses: [{ payer: 'Z', cents: 100 }] }), /Nobody named Z/);
  assert.throws(() => E.settleHouseholdBills({ people: ['A'], expenses: [{ payer: 'A', cents: 100, sharedBy: ['Q'] }] }), /Nobody named Q/);
  assert.throws(() => E.settleHouseholdBills({ people: ['A', 'B'], expenses: [{ payer: 'A', cents: 100, sharedBy: ['A', 'A'] }] }), /listed twice/);
  assert.throws(() => E.settleHouseholdBills({ people: ['A'], expenses: [{ payer: 'A', cents: 0 }] }), /bigger than nothing/);
  assert.throws(() => E.settleHouseholdBills({ people: ['A'], expenses: [{ payer: 'A', cents: 1.5 }] }), /bigger than nothing/);
});

test('a big crowd still settles to zero and never needs more than people minus one handoffs', () => {
  const people = [];
  for (let i = 0; i < 20; i++) people.push('P' + String(i).padStart(2, '0'));
  const expenses = [];
  for (let i = 0; i < 20; i++) expenses.push({ payer: people[i], cents: 1000 + i * 137, sharedBy: people.slice(0, 5 + (i % 15)) });
  const r = E.settleHouseholdBills({ people, expenses });
  Object.values(netOf(r)).forEach((v) => assert.equal(v, 0));
  assert.ok(r.handoffs <= 19);
});

test('handoffPieces and describeHandoff say which bills and coins to use', () => {
  assert.deepEqual(E.handoffPieces(0), []);
  assert.equal(E.describeHandoff(1240), '1 ten-dollar bill, 2 one-dollar bills, 1 quarter, 1 dime, 1 nickel');
  assert.equal(E.describeHandoff(4101), '2 twenty-dollar bills, 1 one-dollar bill, 1 penny');
  assert.equal(E.describeHandoff(2), '2 pennies');
  assert.equal(E.describeHandoff(500), '1 five-dollar bill');
  const total = E.handoffPieces(98765).reduce((s, p) => s + p.value * p.count, 0);
  assert.equal(total, 98765);
});

/* ---------- the care card ---------- */

test('buildWeeklyCareCard lays out medicine by time of day', () => {
  const card = E.buildWeeklyCareCard([
    { kind: 'medicine', name: 'Vitamin D', dose: '1 tablet', slots: ['morning'] },
    { kind: 'medicine', name: 'Heart pill', dose: '1 pill', slots: ['morning', 'evening'] }
  ]);
  assert.equal(card.days.length, 7);
  assert.equal(card.days[0].name, 'Monday');
  assert.equal(card.days[6].name, 'Sunday');
  assert.deepEqual(card.days[2].morning.map((e) => e.label), ['Vitamin D, 1 tablet', 'Heart pill, 1 pill']);
  assert.deepEqual(card.days[2].evening.map((e) => e.name), ['Heart pill']);
  assert.deepEqual(card.days[2].noon, []);
  assert.equal(card.tasks, 21);
  assert.deepEqual(card.conflicts, []);
});

test('buildWeeklyCareCard waters plants every few days', () => {
  const card = E.buildWeeklyCareCard([{ kind: 'plant', name: 'Basil', everyDays: 3 }]);
  const watered = card.days.filter((d) => d.morning.length > 0).map((d) => d.name);
  assert.deepEqual(watered, ['Monday', 'Thursday', 'Sunday']);
  assert.equal(card.tasks, 3);
});

test('buildWeeklyCareCard puts pantry shelves on the Sunday check', () => {
  const card = E.buildWeeklyCareCard([{ kind: 'pantry', name: 'Tins and jars' }]);
  assert.deepEqual(card.days[6].sundayCheck.map((e) => e.name), ['Tins and jars']);
  assert.equal(card.days[0].sundayCheck.length, 0);
  assert.equal(card.tasks, 1);
});

test('buildWeeklyCareCard honors chosen days', () => {
  const card = E.buildWeeklyCareCard([{ kind: 'medicine', name: 'Shot', days: [4, 0, 4], slots: ['noon'] }]);
  assert.deepEqual(card.days.filter((d) => d.noon.length > 0).map((d) => d.index), [0, 4]);
});

test('buildWeeklyCareCard drops a repeated item and says exactly where', () => {
  const card = E.buildWeeklyCareCard([
    { kind: 'medicine', name: 'Vitamin D', slots: ['morning'] },
    { kind: 'medicine', name: 'vitamin d', slots: ['morning', 'noon'] }
  ]);
  assert.equal(card.conflicts.length, 7);
  assert.equal(card.conflicts[0].day, 'Monday');
  assert.equal(card.conflicts[0].slot, 'morning');
  assert.match(card.conflicts[0].message, /already on Monday morning/);
  assert.equal(card.days[0].morning.length, 1);
  assert.equal(card.days[0].noon.length, 1);
  assert.equal(card.tasks, 14);
});

test('the same name as a medicine and a plant is not a conflict', () => {
  const card = E.buildWeeklyCareCard([
    { kind: 'medicine', name: 'Aloe', slots: ['morning'], days: [0] },
    { kind: 'plant', name: 'Aloe', days: [0] }
  ]);
  assert.deepEqual(card.conflicts, []);
  assert.equal(card.days[0].morning.length, 2);
});

test('a repeated pantry shelf reports a Sunday check conflict', () => {
  const card = E.buildWeeklyCareCard([
    { kind: 'pantry', name: 'Tins' }, { kind: 'pantry', name: 'Tins' }
  ]);
  assert.match(card.conflicts[0].message, /already on Sunday check/);
});

test('buildWeeklyCareCard rejects things it cannot place', () => {
  assert.throws(() => E.buildWeeklyCareCard([{ kind: 'pet', name: 'Rex' }]), /medicine, a plant or a pantry shelf/);
  assert.throws(() => E.buildWeeklyCareCard([{ kind: 'plant', name: '  ' }]), /needs a name/);
  assert.throws(() => E.buildWeeklyCareCard([{ kind: 'medicine', name: 'A', slots: ['midnight'] }]), /morning, noon or evening/);
  assert.throws(() => E.buildWeeklyCareCard([{ kind: 'plant', name: 'A', everyDays: 0 }]), /1 to 7/);
  assert.throws(() => E.buildWeeklyCareCard([{ kind: 'plant', name: 'A', everyDays: 8 }]), /1 to 7/);
  assert.throws(() => E.buildWeeklyCareCard([{ kind: 'plant', name: 'A', days: [7] }]), /0 \(Monday\) to 6/);
  assert.throws(() => E.buildWeeklyCareCard([{ kind: 'plant', name: 'A', days: [-1] }]), /0 \(Monday\) to 6/);
});

test('an empty card is still a seven day card', () => {
  const card = E.buildWeeklyCareCard();
  assert.equal(card.days.length, 7);
  assert.equal(card.tasks, 0);
});

test('every thing on a card goes in exactly one slot per day it is due', () => {
  const card = E.buildWeeklyCareCard([
    { kind: 'medicine', name: 'A', slots: ['morning', 'noon', 'evening'] },
    { kind: 'plant', name: 'B', everyDays: 2 },
    { kind: 'pantry', name: 'C' }
  ]);
  const counted = card.days.reduce((s, d) => s + d.morning.length + d.noon.length + d.evening.length + d.sundayCheck.length, 0);
  assert.equal(counted, card.tasks);
  assert.equal(card.tasks, 21 + 4 + 1);
});

/* ---------- sharing a copy ---------- */

test('packState and unpackState round trip, including accents', () => {
  const state = { v: 1, title: 'Café à la maison', items: [1, 2, { a: 'b' }] };
  const packed = E.packState(state);
  assert.match(packed, /^p1\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(E.unpackState(packed), state);
  assert.deepEqual(E.unpackState('#' + packed), state);
});

test('unpackState says null for anything it did not make', () => {
  assert.equal(E.unpackState(''), null);
  assert.equal(E.unpackState('hello'), null);
  assert.equal(E.unpackState('p1.!!!'), null);
  assert.equal(E.unpackState('p1.' + Buffer.from('not json').toString('base64')), null);
  assert.equal(E.unpackState('p1.' + Buffer.from('5').toString('base64')), null);
  assert.equal(E.unpackState('p1.' + Buffer.from('null').toString('base64')), null);
});

/* ---------- Grandma's demands ---------- */

test('the two crayons are what the numbers say they are', () => {
  assert.equal(E.CRAYONS.paper, '#FAF5E8');
  assert.equal(E.CRAYONS.ink, '#142850');
  assert.deepEqual(E.normalizeColor(E.CRAYONS.paper), { r: 250, g: 245, b: 232, a: 1 });
  assert.deepEqual(E.normalizeColor(E.CRAYONS.ink), { r: 20, g: 40, b: 80, a: 1 });
  assert.deepEqual(E.PAPER_RGB, [250, 245, 232]);
  assert.deepEqual(E.INK_RGB, [20, 40, 80]);
});

test('normalizeColor reads hex, short hex, rgb, rgba and transparent', () => {
  assert.deepEqual(E.normalizeColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(E.normalizeColor('rgb(20, 40, 80)'), { r: 20, g: 40, b: 80, a: 1 });
  assert.deepEqual(E.normalizeColor('rgba(20, 40, 80, 0.5)'), { r: 20, g: 40, b: 80, a: 0.5 });
  assert.deepEqual(E.normalizeColor('rgb(20 40 80 / 50%)'), { r: 20, g: 40, b: 80, a: 0.5 });
  assert.deepEqual(E.normalizeColor('transparent'), { r: 0, g: 0, b: 0, a: 0 });
  assert.equal(E.normalizeColor('hotpink'), null);
  assert.equal(E.normalizeColor('#12345'), null);
});

test('classifyColor knows ink, paper, clear and third colors', () => {
  assert.equal(E.classifyColor({ r: 20, g: 40, b: 80, a: 0.3 }), 'ink');
  assert.equal(E.classifyColor({ r: 250, g: 245, b: 232, a: 1 }), 'paper');
  assert.equal(E.classifyColor({ r: 9, g: 9, b: 9, a: 0 }), 'clear');
  assert.equal(E.classifyColor({ r: 20, g: 40, b: 81, a: 1 }), 'other');
  assert.equal(E.classifyColor({ r: 21, g: 40, b: 80, a: 1 }), 'other');
  assert.equal(E.classifyColor({ r: 20, g: 41, b: 80, a: 1 }), 'other');
  assert.equal(E.classifyColor({ r: 251, g: 245, b: 232, a: 1 }), 'other');
  assert.equal(E.classifyColor({ r: 250, g: 246, b: 232, a: 1 }), 'other');
  assert.equal(E.classifyColor({ r: 250, g: 245, b: 233, a: 1 }), 'other');
});

test('auditCss passes the two crayons and shades of ink', () => {
  const css = ':root{--ink:#142850;--paper:#FAF5E8;--ink-50:rgba(20, 40, 80, 0.5)} a{color:var(--ink);border:1px solid var(--ink-50)}';
  const r = E.auditCss(css);
  assert.deepEqual(r.offenders, []);
  assert.equal(r.colorsChecked, 3);
  assert.equal(r.declarations, 5);
});

test('auditCss catches a third color in every disguise', () => {
  const bad = [
    'a{color:#ff0000}',
    'a{background:rgb(1, 2, 3)}',
    'a{border:1px solid red}',
    'a{color:hsl(10 20% 30%)}',
    'a{box-shadow:0 0 4px rgba(0,0,0,0.3)}',
    'a{color:#142851}',
    '@media print{a{color:white}}'
  ];
  bad.forEach((css) => assert.equal(E.auditCss(css).offenders.length, 1, css));
});

test('auditCss ignores comments, quoted words and selectors that look like colors', () => {
  const css = '/* red and #ff0000 in a note */ #fade{content:"red green"} .x:hover{color:var(--ink)} a{background:url(a.png)}';
  assert.deepEqual(E.auditCss(css).offenders, []);
});

test('auditSvgAttributes allows currentColor, none and the crayons only', () => {
  const ok = '<svg><path fill="none" stroke="currentColor"/><rect fill="#142850"/><circle fill="url(#dots)" stroke="var(--ink)"/></svg>';
  assert.deepEqual(E.auditSvgAttributes(ok).offenders, []);
  assert.equal(E.auditSvgAttributes(ok).colorsChecked, 1);
  assert.equal(E.auditSvgAttributes('<path fill="#00ff00"/>').offenders.length, 1);
  assert.equal(E.auditSvgAttributes('<path stroke="tomato"/>').offenders.length, 1);
  assert.equal(E.auditSvgAttributes('<path fill="#00ff00"/><path fill="#ff0000"/>').offenders.length, 2);
});

test('auditHtmlColors reads hex codes, style blocks and style attributes', () => {
  assert.deepEqual(E.auditHtmlColors('<meta content="#142850"><meta content="#FAF5E8">').offenders, []);
  assert.equal(E.auditHtmlColors('<meta content="#abcdef">').offenders.length, 1);
  assert.equal(E.auditHtmlColors('<style>a{color:red}</style>').offenders.length, 1);
  assert.equal(E.auditHtmlColors('<p style="color: blue">x</p>').offenders.length, 1);
  assert.deepEqual(E.auditHtmlColors('<p style="--i: 2">x</p>').offenders, []);
  assert.equal(E.auditHtmlColors('<svg><path fill="#00ff00"/></svg>').offenders.length, 1);
});

test('auditComputedColors checks what a live page reports', () => {
  const entries = [
    { where: 'color', value: 'rgb(20, 40, 80)' },
    { where: 'background-color', value: 'rgba(0, 0, 0, 0)' },
    { where: 'background-image', value: 'radial-gradient(rgba(20, 40, 80, 0.4) 1px, rgba(0, 0, 0, 0) 2px)' },
    { where: 'outline-color', value: 'auto' }
  ];
  const r = E.auditComputedColors(entries);
  assert.equal(r.colorsChecked, 4);
  assert.deepEqual(r.offenders, []);
  const bad = E.auditComputedColors([{ where: 'color', value: 'rgb(0, 0, 238)' }]);
  assert.equal(bad.offenders.length, 1);
  assert.equal(bad.offenders[0].where, 'color');
});

test('auditExternalRequests finds anything fetched from elsewhere', () => {
  const html = '<script src="https://cdn.example.com/x.js"></script><link rel="stylesheet" href="//fonts.example.com/a.css"><img src="a.png"><a href="https://github.com/x">x</a>';
  const found = E.auditExternalRequests({ 'index.html': html });
  assert.equal(found.length, 2);
  assert.equal(E.auditExternalRequests({ 'index.html': '<script src="./app.js"></script><link href="styles.css">' }).length, 0);
  assert.equal(E.auditExternalRequests({ 'a.css': '@import url(https://x.test/a.css); a{background:url(http://x.test/i.png)}' }).length, 2);
  assert.equal(E.auditExternalRequests({ 'a.js': 'fetch("https://x.test/api")' }).length, 1);
  assert.equal(E.auditExternalRequests({ 'a.js': 'fetch("./data.json")' }).length, 0);
});

test('auditLibraries wants an empty package and no imports', () => {
  assert.deepEqual(E.auditLibraries({ dependencies: {}, devDependencies: {} }, {}), []);
  assert.equal(E.auditLibraries({ dependencies: { react: '1' } }, {}).length, 1);
  assert.equal(E.auditLibraries('{"devDependencies":{"jest":"1"}}', {}).length, 1);
  assert.equal(E.auditLibraries({}, { 'a.js': 'import x from "left-pad";' }).length, 1);
  assert.equal(E.auditLibraries({}, { 'a.js': 'const x = require("left-pad");' }).length, 1);
  assert.equal(E.auditLibraries({}, { 'a.js': 'const ok = 1;' }).length, 0);
});

test('visibleText gathers words and labels but not markup or hidden code', () => {
  const html = '<style>.a{color:red}</style><h1>Hello &amp; welcome</h1><svg><text>nope</text></svg><script>var x = 1</script><button aria-label="Close it">x</button><!-- note -->';
  const text = E.visibleText(html);
  assert.match(text, /Hello & welcome/);
  assert.match(text, /Close it/);
  assert.equal(/color:red|var x|nope|note/.test(text), false);
});

test('findJargon catches hard computer words but not look alikes', () => {
  assert.deepEqual(E.findJargon('Save to the cloud and clear your cache'), ['cache', 'cloud']);
  assert.deepEqual(E.findJargon('Open the browser'), ['browser']);
  assert.deepEqual(E.findJargon('A scrapbook, a capital, a cupcake, a hashtag'), []);
  assert.deepEqual(E.findJargon('Keep a copy on paper. Scale the family recipe.'), []);
  assert.deepEqual(E.findJargon('The service  worker waits'), ['service worker']);
});

test('findSlop notices long dashes and emoji', () => {
  assert.deepEqual(E.findSlop('plain words, a hyphen-ated one, and a minus - sign'), { dashes: false, emoji: false });
  assert.equal(E.findSlop('a\u2014b').dashes, true);
  assert.equal(E.findSlop('a\u2013b').dashes, true);
  assert.equal(E.findSlop('\u{1F36A}').emoji, true);
  assert.equal(E.findSlop('done \u2713').emoji, true);
  assert.equal(E.findSlop('café ½ cup').emoji, false);
});

test('auditGrandmaDemands passes a small honest page', () => {
  const r = E.auditGrandmaDemands({
    html: '<meta name="theme-color" content="#142850"><h1>Scale the family recipe</h1><script src="./app.js"></script>',
    css: ':root{--ink:#142850} body{color:var(--ink)}',
    scripts: { 'app.js': 'var a = 1;' },
    packageJson: { dependencies: {}, devDependencies: {} }
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.checks.map((c) => c.key), ['colors', 'offline', 'libraries', 'plain']);
  assert.deepEqual(r.checks.map((c) => c.label), ['Two crayons only', 'Works without internet', 'Nothing borrowed', 'Plain English']);
  r.checks.forEach((c) => assert.equal(c.ok, true));
});

test('auditGrandmaDemands fails each demand on its own', () => {
  const base = {
    html: '<h1>Fine</h1>', css: 'a{color:#142850}', scripts: {}, packageJson: { dependencies: {} }
  };
  const run = (patch) => E.auditGrandmaDemands(Object.assign({}, base, patch));
  const colors = run({ css: 'a{color:red}' });
  assert.equal(colors.ok, false);
  assert.deepEqual(colors.checks.map((c) => c.ok), [false, true, true, true]);
  const net = run({ html: '<script src="https://cdn.test/a.js"></script>' });
  assert.deepEqual(net.checks.map((c) => c.ok), [true, false, true, true]);
  const lib = run({ packageJson: { dependencies: { react: '18' } } });
  assert.deepEqual(lib.checks.map((c) => c.ok), [true, true, false, true]);
  const plain = run({ html: '<h1>Clear the cache</h1>' });
  assert.deepEqual(plain.checks.map((c) => c.ok), [true, true, true, false]);
  assert.equal(plain.checks[3].offenders[0].value, 'cache');
});

test('auditGrandmaDemands copes with missing parts', () => {
  const r = E.auditGrandmaDemands({});
  assert.equal(r.ok, true);
});

test('the public list of hard words is not empty and has no duplicates', () => {
  assert.ok(E.JARGON.length > 40);
  assert.equal(new Set(E.JARGON).size, E.JARGON.length);
  assert.deepEqual(E.DAY_NAMES.length, 7);
  assert.deepEqual(E.SLOTS, ['morning', 'noon', 'evening']);
});
