/* Two-Crayon Kitchen & Bill Book: the engine.
   Plain JavaScript with no libraries. It runs in a web page (window.GrandmaEngine)
   and in Node (module.exports) so the same math is tested and shipped.
   Everything here is a pure function: same input, same answer. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.GrandmaEngine = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CRAYONS = { paper: '#FAF5E8', ink: '#142850' };
  var PAPER_RGB = [250, 245, 232];
  var INK_RGB = [20, 40, 80];

  /* ---------- exact fractions ---------- */

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    for (var guard = 0; guard < 128 && b !== 0; guard++) {
      var t = a % b;
      a = b;
      b = t;
    }
    return a;
  }

  function fr(n, d) {
    if (d === undefined) d = 1;
    if (!Number.isInteger(n) || !Number.isInteger(d)) {
      throw new Error('A fraction needs whole numbers on the top and the bottom.');
    }
    if (d === 0) throw new Error('A fraction cannot have zero on the bottom.');
    if (d < 0) {
      n = -n;
      d = -d;
    }
    var g = gcd(n, d);
    return { n: n / g, d: d / g };
  }

  function isFraction(x) {
    return x !== null && typeof x === 'object' && Number.isInteger(x.n) && Number.isInteger(x.d);
  }

  function frAdd(a, b) { return fr(a.n * b.d + b.n * a.d, a.d * b.d); }
  function frSub(a, b) { return fr(a.n * b.d - b.n * a.d, a.d * b.d); }
  function frMul(a, b) { return fr(a.n * b.n, a.d * b.d); }
  function frDiv(a, b) {
    if (b.n === 0) throw new Error('Cannot divide by zero.');
    return fr(a.n * b.d, a.d * b.n);
  }
  function frCmp(a, b) {
    var left = a.n * b.d;
    var right = b.n * a.d;
    if (left < right) return -1;
    return left > right ? 1 : 0;
  }
  function frEq(a, b) { return frCmp(a, b) === 0; }
  function frNum(a) { return a.n / a.d; }
  function frAbs(a) { return a.n < 0 ? fr(-a.n, a.d) : a; }

  var VULGAR = {
    '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4',
    '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8'
  };

  function normalizeVulgar(text) {
    return String(text)
      .replace(/[½⅓⅔¼¾⅛-⅞]/g, function (ch) {
        return ' ' + VULGAR[ch];
      })
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseQuantity(input) {
    if (isFraction(input)) return input;
    if (typeof input === 'number') {
      if (!Number.isFinite(input) || input < 0) throw new Error('I could not read that amount.');
      return parseQuantity(String(input));
    }
    var s = normalizeVulgar(input);
    var m = /^(\d+) (\d+)\/(\d+)$/.exec(s);
    if (m) return frAdd(fr(Number(m[1])), fr(Number(m[2]), Number(m[3])));
    m = /^(\d+)\/(\d+)$/.exec(s);
    if (m) return fr(Number(m[1]), Number(m[2]));
    m = /^(\d*)\.(\d+)$/.exec(s);
    if (m) return fr(Number((m[1] || '0') + m[2]), Math.pow(10, m[2].length));
    m = /^\d+$/.exec(s);
    if (m) return fr(Number(s));
    throw new Error('I could not read that amount: ' + String(input).slice(0, 24));
  }

  function toMixedFraction(f) {
    var n = Math.abs(f.n);
    var whole = Math.floor(n / f.d);
    return { whole: whole, n: n - whole * f.d, d: f.d, negative: f.n < 0 };
  }

  function formatMixed(f) {
    var m = toMixedFraction(f);
    var sign = m.negative ? '-' : '';
    if (m.n === 0) return sign + String(m.whole);
    if (m.whole === 0) return sign + m.n + '/' + m.d;
    return sign + m.whole + ' ' + m.n + '/' + m.d;
  }

  /* Nearest friendly kitchen fraction. Ties go to the simpler fraction. */
  function snapToKitchen(f, denominators) {
    var dens = denominators || [2, 3, 4, 8, 16];
    if (f.n <= 0) return fr(0);
    var candidates = [1].concat(dens);
    var best = null;
    var bestErr = null;
    for (var i = 0; i < candidates.length; i++) {
      var d = candidates[i];
      var k = Math.floor((2 * f.n * d + f.d) / (2 * f.d));
      var cand = fr(k, d);
      var err = frAbs(frSub(f, cand));
      if (best === null || frCmp(err, bestErr) < 0) {
        best = cand;
        bestErr = err;
      }
    }
    if (best.n === 0) return fr(1, dens[dens.length - 1]);
    return best;
  }

  /* ---------- kitchen measures ---------- */

  var UNITS = {
    tsp: { family: 'volume', size: fr(1), label: 'tsp', plural: 'tsp', snap: [2, 4, 8] },
    tbsp: { family: 'volume', size: fr(3), label: 'tbsp', plural: 'tbsp', snap: [2, 4] },
    floz: { family: 'volume', size: fr(6), label: 'fl oz', plural: 'fl oz', snap: [2, 4] },
    cup: { family: 'volume', size: fr(48), label: 'cup', plural: 'cups', snap: [2, 3, 4] },
    g: { family: 'mass', size: fr(1), label: 'g', plural: 'g', snap: [] },
    oz: { family: 'mass', size: fr(56699, 2000), label: 'oz', plural: 'oz', snap: [2, 4, 8] },
    lb: { family: 'mass', size: fr(56699, 125), label: 'lb', plural: 'lb', snap: [2, 4] },
    pinch: { family: 'pinch', size: fr(1), label: 'pinch', plural: 'pinches', snap: [] },
    each: { family: 'count', size: fr(1), label: '', plural: '', snap: [2] }
  };

  var UNIT_WORDS = {
    teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp', tsps: 'tsp',
    tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp',
    cup: 'cup', cups: 'cup',
    floz: 'floz', 'fl oz': 'floz', 'fluid ounce': 'floz', 'fluid ounces': 'floz',
    gram: 'g', grams: 'g', g: 'g',
    ounce: 'oz', ounces: 'oz', oz: 'oz',
    pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
    pinch: 'pinch', pinches: 'pinch'
  };

  function normalizeUnit(word) {
    var key = String(word).trim().toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ');
    if (Object.prototype.hasOwnProperty.call(UNITS, key)) return key;
    if (Object.prototype.hasOwnProperty.call(UNIT_WORDS, key)) return UNIT_WORDS[key];
    throw new Error('I do not know the measure "' + String(word).slice(0, 20) + '".');
  }

  function bestVolumeUnit(tsp) {
    if (frCmp(tsp, fr(12)) >= 0) return 'cup';
    if (frCmp(tsp, fr(3)) >= 0) return 'tbsp';
    return 'tsp';
  }

  /* Pick cups, spoons or teaspoons. If the big unit needs rounding but a smaller
     one says it exactly with a small number, use the smaller one. */
  var SMALLER_LIMIT = { tbsp: 8, tsp: 6 };

  function friendliestVolume(tsp) {
    var order = ['cup', 'tbsp', 'tsp'];
    var start = order.indexOf(bestVolumeUnit(tsp));
    var first = formatMeasure(frDiv(tsp, UNITS[order[start]].size), order[start]);
    for (var i = start + 1; i < order.length && first.rounded; i++) {
      var amount = frDiv(tsp, UNITS[order[i]].size);
      if (frCmp(amount, fr(SMALLER_LIMIT[order[i]])) <= 0) {
        var other = formatMeasure(amount, order[i]);
        if (!other.rounded) return other;
      }
    }
    return first;
  }

  /* Turn an exact amount into friendly kitchen words. */
  function formatMeasure(amount, unitKey, forceWhole) {
    var unit = UNITS[unitKey];
    var shown;
    if (forceWhole || unit.snap.length === 0) {
      var whole = Math.max(1, Math.round(frNum(amount)));
      shown = fr(whole);
    } else {
      shown = snapToKitchen(amount, unit.snap);
    }
    var label = frCmp(shown, fr(1)) > 0 ? unit.plural : unit.label;
    var text = formatMixed(shown);
    if (label !== '') text += ' ' + label;
    return { text: text, value: shown, unit: unitKey, rounded: !frEq(shown, amount) };
  }

  function toFraction(x) {
    return isFraction(x) ? x : parseQuantity(x);
  }

  /* Swap one measure for another of the same kind (cups to spoons, grams to ounces). */
  function convertKitchenMeasure(quantity, fromUnit, toUnit) {
    var from = normalizeUnit(fromUnit);
    var to = normalizeUnit(toUnit);
    var a = UNITS[from];
    var b = UNITS[to];
    var sameKind = a.family === b.family && (a.family === 'volume' || a.family === 'mass');
    if (from !== to && !sameKind) {
      throw new Error('Those two measures are not the same kind, so they cannot be swapped.');
    }
    var exact = frDiv(frMul(toFraction(quantity), a.size), b.size);
    var shown = formatMeasure(exact, to);
    return {
      quantity: exact,
      text: shown.text,
      approximate: a.family === 'mass' && from !== to,
      rounded: shown.rounded
    };
  }

  /* One recipe line: "1 3/4 cups flour", "2 eggs", "a pinch of salt". */
  var UNIT_PATTERN = [
    'fluid ounces', 'fluid ounce', 'fl\\.? oz', 'tablespoons', 'tablespoon', 'tbsps', 'tbsp', 'tbs',
    'teaspoons', 'teaspoon', 'tsps', 'tsp', 'cups', 'cup', 'ounces', 'ounce', 'oz',
    'pounds', 'pound', 'lbs', 'lb', 'grams', 'gram', 'g', 'pinches', 'pinch'
  ].join('|');
  var LINE_PATTERN = new RegExp(
    '^(\\d+ \\d+/\\d+|\\d+/\\d+|\\d*\\.\\d+|\\d+)\\s*(' + UNIT_PATTERN + ')\\b\\.?\\s*(?:of\\s+)?(.+)$', 'i'
  );

  function parseIngredientLine(line) {
    var s = normalizeVulgar(line);
    var pinch = /^(?:a|an|one)\s+pinch(?:es)?\s+(?:of\s+)?(.+)$/i.exec(s);
    if (pinch) {
      return { quantity: fr(1), unit: 'pinch', name: pinch[1].trim(), wholeOnly: false };
    }
    var m = LINE_PATTERN.exec(s);
    var quantityText;
    var unit;
    var name;
    if (m) {
      quantityText = m[1];
      unit = normalizeUnit(m[2].replace(/\./g, ''));
      name = m[3];
    } else {
      var plain = /^(\d+ \d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)\s+(.+)$/.exec(s);
      if (!plain) throw new Error('I could not find an amount at the start of: ' + s.slice(0, 30));
      quantityText = plain[1];
      unit = 'each';
      name = plain[2];
    }
    name = name.trim();
    return {
      quantity: parseQuantity(quantityText),
      unit: unit,
      name: name,
      wholeOnly: /\begg/i.test(name)
    };
  }

  function parseRecipeText(text) {
    var items = [];
    var problems = [];
    String(text).split(/\r?\n/).forEach(function (raw, index) {
      var line = raw.trim();
      if (line === '') return;
      try {
        items.push(parseIngredientLine(line));
      } catch (err) {
        problems.push({ line: index + 1, text: line, message: err.message });
      }
    });
    return { items: items, problems: problems };
  }

  /* Scale one ingredient. Returns friendly words plus the exact amount. */
  function scaleIngredient(ingredient, factorIn) {
    var factor = toFraction(factorIn);
    var unitKey = ingredient.unit ? normalizeUnit(ingredient.unit) : 'each';
    var unit = UNITS[unitKey];
    var scaled = frMul(toFraction(ingredient.quantity), factor);
    var shown;
    var note = '';
    if (unit.family === 'volume') {
      var tsp = frMul(scaled, unit.size);
      shown = friendliestVolume(tsp);
    } else if (unitKey === 'each' && ingredient.wholeOnly) {
      shown = formatMeasure(scaled, 'each', true);
      if (shown.rounded) note = 'Whole ones only, rounded from ' + formatMixed(scaled) + '.';
    } else {
      shown = formatMeasure(scaled, unitKey);
    }
    return {
      name: ingredient.name,
      quantity: scaled,
      unit: shown.unit,
      text: shown.text,
      exactText: formatMixed(scaled) + (unit.label === '' ? '' : ' ' + (frCmp(scaled, fr(1)) > 0 ? unit.plural : unit.label)),
      rounded: shown.rounded,
      note: note
    };
  }

  function scaleRecipeIngredients(ingredients, factor) {
    var f = toFraction(factor);
    if (f.n <= 0) throw new Error('The scale must be more than nothing.');
    return ingredients.map(function (ingredient) {
      return scaleIngredient(ingredient, f);
    });
  }

  function servingsFactor(original, target) {
    if (!Number.isInteger(original) || !Number.isInteger(target) || original < 1 || target < 1) {
      throw new Error('Servings must be whole numbers of one or more.');
    }
    return fr(target, original);
  }

  /* ---------- baking pans ---------- */

  function readDimension(x) {
    var f = toFraction(x);
    if (f.n <= 0) throw new Error('A pan needs a size bigger than nothing.');
    return f;
  }

  function readPan(pan) {
    if (pan && pan.shape === 'round') {
      var d = readDimension(pan.size);
      return { shape: 'round', measure: frMul(d, d), area: Math.PI * Math.pow(frNum(d), 2) / 4 };
    }
    if (pan && pan.shape === 'rect') {
      var w = readDimension(pan.width);
      var h = readDimension(pan.height);
      return { shape: 'rect', measure: frMul(w, h), area: frNum(w) * frNum(h) };
    }
    throw new Error('Pick a round pan or a rectangle pan.');
  }

  function panRatio(fromPan, toPan) {
    var a = readPan(fromPan);
    var b = readPan(toPan);
    if (a.shape === b.shape) {
      return { ratio: frDiv(b.measure, a.measure), exact: true, areaFrom: a.area, areaTo: b.area };
    }
    var x = b.area / a.area;
    return { ratio: fr(Math.round(x * 1000), 1000), exact: false, areaFrom: a.area, areaTo: b.area };
  }

  function panPlan(fromPan, toPan) {
    var r = panRatio(fromPan, toPan);
    var factor = snapToKitchen(r.ratio, [2, 3, 4, 8]);
    var depth = snapToKitchen(frDiv(fr(1), r.ratio), [2, 3, 4, 8]);
    var scaledAdvice;
    var unscaledAdvice;
    if (frEq(r.ratio, fr(1))) {
      scaledAdvice = 'Same size pan. Use the recipe as written.';
      unscaledAdvice = scaledAdvice;
    } else if (frCmp(r.ratio, fr(1)) > 0) {
      scaledAdvice = 'Bigger pan. Multiply the recipe by ' + formatMixed(factor) +
        ' so the batter stays the same depth. Keep the oven heat and start checking at the usual time.';
      unscaledAdvice = 'If you keep the recipe as written, the batter will be about ' + formatMixed(depth) +
        ' as deep. A thin layer bakes faster, so start checking early.';
    } else {
      scaledAdvice = 'Smaller pan. Multiply the recipe by ' + formatMixed(factor) +
        ' so the batter stays the same depth. Keep the oven heat and start checking at the usual time.';
      unscaledAdvice = 'If you keep the recipe as written, the batter will be about ' + formatMixed(depth) +
        ' as deep. A thick layer bakes slower and can stay wet in the middle, so lower the heat a little and bake longer.';
    }
    return {
      areaRatio: r.ratio,
      exact: r.exact,
      areaFrom: r.areaFrom,
      areaTo: r.areaTo,
      recipeFactor: factor,
      snapped: !frEq(factor, r.ratio),
      depthWithoutScaling: depth,
      scaledAdvice: scaledAdvice,
      unscaledAdvice: unscaledAdvice
    };
  }

  /* ---------- household bills ---------- */

  function parseMoneyToCents(input) {
    var s = String(input).trim().replace(/^\$/, '').replace(/,/g, '');
    var m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
    if (!m) throw new Error('I could not read that money amount: ' + String(input).slice(0, 20));
    return Number(m[1]) * 100 + (m[2] ? Number((m[2] + '0').slice(0, 2)) : 0);
  }

  function formatCents(cents) {
    var abs = Math.abs(cents);
    var dollars = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var rest = String(abs % 100);
    if (rest.length < 2) rest = '0' + rest;
    return (cents < 0 ? '-$' : '$') + dollars + '.' + rest;
  }

  /* Split whole cents so the shares always add back to the total. The extra
     cents start at the given place in the list, so no one always pays them. */
  function splitCents(total, count, start) {
    var base = Math.floor(total / count);
    var extra = total - base * count;
    var shares = [];
    for (var i = 0; i < count; i++) shares.push(base);
    for (var t = 0; t < extra; t++) shares[(start + t) % count] += 1;
    return shares;
  }

  function parsePeopleList(text) {
    return String(text).split(/[,;\n]/).map(function (s) { return s.trim(); }).filter(function (s) {
      return s !== '';
    });
  }

  function cleanPeople(list) {
    var seen = new Set();
    var people = [];
    (list || []).forEach(function (raw) {
      var name = String(raw).trim();
      if (name === '') return;
      var key = name.toLowerCase();
      if (seen.has(key)) throw new Error('Two people share the name ' + name + '. Give each a different name.');
      seen.add(key);
      people.push(name);
    });
    if (people.length === 0) throw new Error('Add at least one person.');
    return people;
  }

  /* The most zero-sum groups among the people who owe or are owed. Each group
     can settle inside itself, which is what keeps the handoffs few. */
  function bestGroups(values) {
    var n = values.length;
    var size = 1 << n;
    var sums = new Array(size).fill(0);
    var best = new Array(size).fill(0);
    var last = new Array(size).fill(0);
    for (var mask = 1; mask < size; mask++) {
      var low = 31 - Math.clz32(mask & -mask);
      sums[mask] = sums[mask & (mask - 1)] + values[low];
      var count = Number.NEGATIVE_INFINITY;
      var pick = 0;
      for (var i = 0; i < n; i++) {
        if ((mask & (1 << i)) !== 0) {
          var prior = best[mask ^ (1 << i)];
          if (prior > count) {
            count = prior;
            pick = i;
          }
        }
      }
      best[mask] = count + (sums[mask] === 0 ? 1 : 0);
      last[mask] = pick;
    }
    var order = [];
    var m = size - 1;
    for (var step = 0; step < n && m > 0; step++) {
      order.push(last[m]);
      m ^= 1 << last[m];
    }
    order.reverse();
    var groups = [];
    var current = [];
    var run = 0;
    order.forEach(function (index) {
      current.push(index);
      run += values[index];
      if (run === 0) {
        groups.push(current);
        current = [];
      }
    });
    if (current.length > 0) groups.push(current);
    return groups;
  }

  function settleGroup(entries) {
    var debtors = entries.filter(function (e) { return e.cents < 0; }).map(function (e) {
      return { name: e.name, cents: e.cents };
    });
    var creditors = entries.filter(function (e) { return e.cents > 0; }).map(function (e) {
      return { name: e.name, cents: e.cents };
    });
    var byBiggest = function (a, b) {
      return Math.abs(b.cents) - Math.abs(a.cents) || cmpText(a.name, b.name);
    };
    debtors.sort(byBiggest);
    creditors.sort(byBiggest);
    var out = [];
    var i = 0;
    var j = 0;
    for (var guard = 0; guard < 1000 && i < debtors.length && j < creditors.length; guard++) {
      var pay = Math.min(-debtors[i].cents, creditors[j].cents);
      out.push({ from: debtors[i].name, to: creditors[j].name, cents: pay });
      debtors[i].cents += pay;
      creditors[j].cents -= pay;
      if (debtors[i].cents === 0) i++;
      if (creditors[j].cents === 0) j++;
    }
    return out;
  }

  var MAX_EXACT_PEOPLE = 14;

  function cmpText(a, b) {
    if (a < b) return -1;
    return a > b ? 1 : 0;
  }

  function settleHouseholdBills(input) {
    var people = cleanPeople(input && input.people);
    var known = new Set(people);
    var paid = new Map();
    var owed = new Map();
    people.forEach(function (p) {
      paid.set(p, 0);
      owed.set(p, 0);
    });
    var totalCents = 0;
    ((input && input.expenses) || []).forEach(function (expense, index) {
      var cents = expense.cents !== undefined ? expense.cents : parseMoneyToCents(expense.amount);
      if (!Number.isInteger(cents) || cents <= 0) {
        throw new Error('Every bill needs an amount bigger than nothing.');
      }
      var payer = String(expense.payer).trim();
      if (!known.has(payer)) throw new Error('Nobody named ' + payer + ' is on the list.');
      var sharers = expense.sharedBy && expense.sharedBy.length > 0 ? expense.sharedBy : people;
      var seen = new Set();
      sharers.forEach(function (name) {
        if (!known.has(name)) throw new Error('Nobody named ' + name + ' is on the list.');
        if (seen.has(name)) throw new Error(name + ' is listed twice on one bill.');
        seen.add(name);
      });
      var shares = splitCents(cents, sharers.length, index % sharers.length);
      paid.set(payer, paid.get(payer) + cents);
      sharers.forEach(function (name, k) {
        owed.set(name, owed.get(name) + shares[k]);
      });
      totalCents += cents;
    });
    var ledger = people.map(function (name) {
      return {
        name: name,
        paidCents: paid.get(name),
        owedCents: owed.get(name),
        netCents: paid.get(name) - owed.get(name)
      };
    });
    var open = ledger.filter(function (row) { return row.netCents !== 0; }).sort(function (a, b) {
      return cmpText(a.name, b.name);
    }).map(function (row) { return { name: row.name, cents: row.netCents }; });
    var groups;
    if (open.length <= MAX_EXACT_PEOPLE) {
      groups = open.length === 0 ? [] : bestGroups(open.map(function (e) { return e.cents; }));
    } else {
      groups = [open.map(function (e, k) { return k; })];
    }
    var transfers = [];
    groups.forEach(function (group) {
      transfers = transfers.concat(settleGroup(group.map(function (k) { return open[k]; })));
    });
    transfers.sort(function (a, b) {
      return b.cents - a.cents || cmpText(a.from, b.from) || cmpText(a.to, b.to);
    });
    return {
      people: people,
      totalCents: totalCents,
      ledger: ledger,
      transfers: transfers,
      handoffs: transfers.length
    };
  }

  var HANDOFF_PIECES = [
    [2000, 'twenty-dollar bill'], [1000, 'ten-dollar bill'], [500, 'five-dollar bill'], [100, 'one-dollar bill'],
    [25, 'quarter'], [10, 'dime'], [5, 'nickel'], [1, 'penny']
  ];

  function handoffPieces(cents) {
    var left = cents;
    var pieces = [];
    HANDOFF_PIECES.forEach(function (piece) {
      var count = Math.floor(left / piece[0]);
      if (count > 0) pieces.push({ value: piece[0], name: piece[1], count: count });
      left -= count * piece[0];
    });
    return pieces;
  }

  function describeHandoff(cents) {
    return handoffPieces(cents).map(function (p) {
      if (p.count === 1) return '1 ' + p.name;
      return p.count + ' ' + (p.name === 'penny' ? 'pennies' : p.name + 's');
    }).join(', ');
  }

  /* ---------- the weekly care card ---------- */

  var DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var SLOTS = ['morning', 'noon', 'evening'];
  var KINDS = ['medicine', 'plant', 'pantry'];

  function careDays(item) {
    if (item.kind === 'pantry') return [6];
    if (item.everyDays !== undefined) {
      var every = item.everyDays;
      if (!Number.isInteger(every) || every < 1 || every > 7) {
        throw new Error('"Every" must be a whole number of days from 1 to 7.');
      }
      var days = [];
      for (var d = 0; d < 7; d += every) days.push(d);
      return days;
    }
    if (item.days === undefined) return [0, 1, 2, 3, 4, 5, 6];
    var list = [];
    item.days.forEach(function (d) {
      if (!Number.isInteger(d) || d < 0 || d > 6) throw new Error('Days run from 0 (Monday) to 6 (Sunday).');
      if (list.indexOf(d) < 0) list.push(d);
    });
    return list.sort(function (a, b) { return a - b; });
  }

  function careSlots(item) {
    if (item.kind === 'pantry') return ['sunday'];
    var slots = item.slots && item.slots.length > 0 ? item.slots : ['morning'];
    slots.forEach(function (slot) {
      if (SLOTS.indexOf(slot) < 0) throw new Error('A time of day must be morning, noon or evening.');
    });
    return slots;
  }

  function buildWeeklyCareCard(items) {
    var days = DAY_NAMES.map(function (name, index) {
      return { index: index, name: name, morning: [], noon: [], evening: [], sundayCheck: [] };
    });
    var conflicts = [];
    var placed = new Set();
    var tasks = 0;
    (items || []).forEach(function (item) {
      if (KINDS.indexOf(item.kind) < 0) throw new Error('Each thing must be a medicine, a plant or a pantry shelf.');
      var name = String(item.name).trim();
      if (name === '') throw new Error('Every thing on the card needs a name.');
      var label = item.dose ? name + ', ' + String(item.dose).trim() : name;
      var slots = careSlots(item);
      careDays(item).forEach(function (dayIndex) {
        slots.forEach(function (slot) {
          var key = item.kind + '|' + name.toLowerCase() + '|' + dayIndex + '|' + slot;
          if (placed.has(key)) {
            conflicts.push({
              name: name,
              day: DAY_NAMES[dayIndex],
              slot: slot,
              message: name + ' is already on ' + DAY_NAMES[dayIndex] + ' ' + (slot === 'sunday' ? 'check' : slot) + '.'
            });
            return;
          }
          placed.add(key);
          var entry = { name: name, kind: item.kind, dose: item.dose ? String(item.dose).trim() : '', label: label };
          days[dayIndex][slot === 'sunday' ? 'sundayCheck' : slot].push(entry);
          tasks += 1;
        });
      });
    });
    return { days: days, conflicts: conflicts, tasks: tasks };
  }

  /* ---------- sharing a copy ---------- */

  function toBase64Url(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(text) {
    var padded = text.replace(/-/g, '+').replace(/_/g, '/');
    while (padded.length % 4 !== 0) padded += '=';
    var binary = atob(padded);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function packState(state) {
    return 'p1.' + toBase64Url(JSON.stringify(state));
  }

  function unpackState(text) {
    var s = String(text).replace(/^#/, '');
    if (s.slice(0, 3) !== 'p1.') return null;
    try {
      var value = JSON.parse(fromBase64Url(s.slice(3)));
      return value !== null && typeof value === 'object' ? value : null;
    } catch (err) {
      return null;
    }
  }

  /* ---------- Grandma's demands ---------- */

  var NAMED_COLORS = [
    'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown', 'gray', 'grey',
    'silver', 'gold', 'navy', 'teal', 'maroon', 'lime', 'aqua', 'cyan', 'magenta', 'olive', 'fuchsia',
    'indigo', 'violet', 'crimson', 'coral', 'salmon', 'tan', 'beige', 'ivory', 'khaki', 'lavender', 'plum',
    'tomato', 'turquoise'
  ];

  var COLOR_FUNCTIONS = /\b(hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|device-cmyk)\(/i;

  var JARGON = [
    'algorithm', 'api', 'json', 'url', 'http', 'https', 'hash', 'cache', 'cached', 'service worker',
    'javascript', 'css', 'html', 'byte', 'bytes', 'kilobyte', 'kilobytes', 'pixel', 'pixels', 'browser',
    'server', 'cloud', 'database', 'sync', 'login', 'widget', 'toggle', 'ui', 'ux', 'app', 'apps', 'install',
    'download', 'upload', 'plugin', 'framework', 'dependency', 'dependencies', 'render', 'parse', 'config',
    'localstorage', 'interface', 'dropdown', 'checkbox', 'debug', 'compile', 'deploy', 'pwa', 'svg', 'woff',
    'script', 'scripts', 'code', 'bug', 'bugs'
  ];

  function normalizeColor(text) {
    var s = String(text).trim().toLowerCase();
    if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    var m = /^#([0-9a-f]{6})$/.exec(s);
    if (m) {
      return {
        r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16),
        b: parseInt(m[1].slice(4, 6), 16), a: 1
      };
    }
    m = /^#([0-9a-f]{3})$/.exec(s);
    if (m) {
      return {
        r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16),
        b: parseInt(m[1][2] + m[1][2], 16), a: 1
      };
    }
    m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
    if (m) {
      var alpha = 1;
      if (m[4] !== undefined) alpha = m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: alpha };
    }
    return null;
  }

  /* 'ink', 'paper', 'clear' (invisible) or 'other' (a third color). */
  function classifyColor(color) {
    if (color.a === 0) return 'clear';
    if (color.r === INK_RGB[0] && color.g === INK_RGB[1] && color.b === INK_RGB[2]) return 'ink';
    if (color.r === PAPER_RGB[0] && color.g === PAPER_RGB[1] && color.b === PAPER_RGB[2]) return 'paper';
    return 'other';
  }

  function stripComments(css) {
    return String(css).replace(/\/\*[\s\S]*?\*\//g, '');
  }

  function colorsInValue(value) {
    var cleaned = String(value).replace(/var\([^)]*\)/g, '').replace(/"[^"]*"|'[^']*'/g, '').replace(/url\([^)]*\)/g, '');
    var found = [];
    var hex = cleaned.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    hex.forEach(function (h) { found.push(h); });
    var fns = cleaned.match(/rgba?\([^)]*\)/gi) || [];
    fns.forEach(function (f) { found.push(f); });
    if (COLOR_FUNCTIONS.test(cleaned)) found.push(cleaned.match(COLOR_FUNCTIONS)[0] + '...)');
    var bare = cleaned.replace(/rgba?\([^)]*\)/gi, ' ');
    (bare.toLowerCase().match(/[a-z]+/g) || []).forEach(function (word) {
      if (NAMED_COLORS.indexOf(word) >= 0) found.push(word);
    });
    return found;
  }

  function auditColorList(list) {
    var offenders = [];
    list.forEach(function (entry) {
      var color = normalizeColor(entry.value);
      if (color === null || classifyColor(color) === 'other') {
        offenders.push({ where: entry.where, value: entry.value });
      }
    });
    return offenders;
  }

  /* Every color written in a style sheet must be paper, ink, or ink thinned with alpha. */
  function auditCss(css) {
    var text = stripComments(css);
    var list = [];
    var declarations = 0;
    var pattern = /([a-zA-Z0-9-]+)\s*:\s*([^;{}]+)(?=;|\})/g;
    var m;
    while ((m = pattern.exec(text)) !== null) {
      declarations += 1;
      colorsInValue(m[2]).forEach(function (value) {
        list.push({ where: m[1], value: value });
      });
    }
    return { declarations: declarations, colorsChecked: list.length, offenders: auditColorList(list) };
  }

  var SVG_COLOR_ATTRS = /\b(fill|stroke|stop-color|flood-color|color)\s*=\s*"([^"]*)"/g;
  var SAFE_SVG_WORDS = ['none', 'currentcolor', 'transparent', 'inherit'];

  function auditSvgAttributes(html) {
    var list = [];
    var m;
    var text = String(html);
    while ((m = SVG_COLOR_ATTRS.exec(text)) !== null) {
      var value = m[2].trim();
      var lower = value.toLowerCase();
      if (SAFE_SVG_WORDS.indexOf(lower) >= 0 || /^url\(#[\w-]+\)$/.test(value) || /^var\(--[\w-]+\)$/.test(value)) continue;
      list.push({ where: m[1], value: value });
    }
    SVG_COLOR_ATTRS.lastIndex = 0;
    var sixHex = list.filter(function (entry) { return /^#[0-9a-f]{6}$/i.test(entry.value); }).length;
    return { colorsChecked: list.length, sixHex: sixHex, offenders: auditColorList(list) };
  }

  function auditHtmlColors(html) {
    var text = String(html);
    var list = [];
    (text.match(/#[0-9a-fA-F]{6}\b/g) || []).forEach(function (h) { list.push({ where: 'hex', value: h }); });
    var styles = text.match(/<style[\s\S]*?<\/style>/gi) || [];
    var inline = text.match(/\bstyle\s*=\s*"[^"]*"/gi) || [];
    var offenders = auditColorList(list);
    styles.concat(inline).forEach(function (chunk) {
      var inner = chunk.replace(/^<style[^>]*>|<\/style>$/gi, '').replace(/^\s*style\s*=\s*"|"$/gi, '');
      auditCss(inner.indexOf('{') >= 0 ? inner : 'x{' + inner + '}').offenders.forEach(function (o) {
        offenders.push(o);
      });
    });
    var svg = auditSvgAttributes(text);
    var svgOnly = svg.offenders.filter(function (o) { return !/^#[0-9a-f]{6}$/i.test(o.value); });
    return {
      colorsChecked: list.length + svg.colorsChecked - svg.sixHex,
      offenders: offenders.concat(svgOnly)
    };
  }

  /* The same check for the colors a live page reports, such as rgb(20, 40, 80). */
  function auditComputedColors(entries) {
    var list = [];
    entries.forEach(function (entry) {
      var found = String(entry.value).match(/rgba?\([^)]*\)/gi) || [];
      found.forEach(function (value) { list.push({ where: entry.where, value: value }); });
    });
    return { colorsChecked: list.length, offenders: auditColorList(list) };
  }

  function auditExternalRequests(files) {
    var offenders = [];
    var absolute = /^(?:https?:)?\/\//i;
    Object.keys(files).forEach(function (name) {
      var text = String(files[name]);
      if (/\.html?$/i.test(name)) {
        var tags = text.match(/<(?:script|link|img|source|iframe|video|audio|embed|object)\b[^>]*>/gi) || [];
        tags.forEach(function (tag) {
          var attr = /\b(?:src|href|srcset|data)\s*=\s*"([^"]*)"/i.exec(tag);
          if (attr && absolute.test(attr[1].trim())) offenders.push({ file: name, value: attr[1] });
        });
      }
      var imports = text.match(/@import\s+(?:url\()?\s*['"]?(?:https?:)?\/\/[^;]*/gi) || [];
      imports.forEach(function (u) { offenders.push({ file: name, value: u }); });
      var urls = text.replace(/@import[^;]*;/gi, ' ').match(/url\(\s*['"]?(?:https?:)?\/\/[^)]*\)/gi) || [];
      urls.forEach(function (u) { offenders.push({ file: name, value: u }); });
      var calls = text.match(/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\b[^;\n]*['"](?:https?:)?\/\/[^'"]*['"]/g) || [];
      calls.forEach(function (c) { offenders.push({ file: name, value: c }); });
    });
    return offenders;
  }

  function auditLibraries(packageJson, scripts) {
    var offenders = [];
    var pkg = typeof packageJson === 'string' ? JSON.parse(packageJson) : packageJson;
    ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].forEach(function (key) {
      Object.keys((pkg && pkg[key]) || {}).forEach(function (name) {
        offenders.push({ file: 'package.json', value: key + ': ' + name });
      });
    });
    Object.keys(scripts || {}).forEach(function (name) {
      var text = String(scripts[name]);
      var found = text.match(/^\s*import\s[^\n]*$|\brequire\s*\(|\bimportScripts\s*\(\s*['"](?!\.\/)/gm) || [];
      found.forEach(function (value) { offenders.push({ file: name, value: value.trim() }); });
    });
    return offenders;
  }

  function decodeEntities(text) {
    return text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }

  /* The words a visitor can read or hear: page text plus labels. */
  function visibleText(html) {
    var text = String(html)
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, ' ');
    var labels = [];
    var attr = /\b(?:aria-label|title|alt|placeholder|content)\s*=\s*"([^"]*)"/gi;
    var m;
    while ((m = attr.exec(text)) !== null) labels.push(m[1]);
    var body = text.replace(/<[^>]+>/g, ' ');
    return decodeEntities(body + ' ' + labels.join(' ')).replace(/\s+/g, ' ').trim();
  }

  function findJargon(text) {
    var found = [];
    var lower = String(text).toLowerCase();
    JARGON.forEach(function (word) {
      var pattern = new RegExp('(^|[^a-z0-9])' + word.replace(/ /g, '\\s+') + '(?![a-z0-9])');
      if (pattern.test(lower)) found.push(word);
    });
    return found;
  }

  var DASH_PATTERN = /[\u2012\u2013\u2014\u2015]/;
  var EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

  function findSlop(text) {
    var s = String(text);
    return { dashes: DASH_PATTERN.test(s), emoji: EMOJI_PATTERN.test(s) };
  }

  /* Put the four demands to the test. Input: html text, css text, a map of
     script names to their text, and the package.json text or object. */
  function auditGrandmaDemands(input) {
    var html = input.html || '';
    var css = input.css || '';
    var scripts = input.scripts || {};
    var cssResult = auditCss(css);
    var htmlResult = auditHtmlColors(html);
    var colorOffenders = cssResult.offenders.concat(htmlResult.offenders);
    var files = { 'index.html': html, 'styles.css': css };
    Object.keys(scripts).forEach(function (name) { files[name] = scripts[name]; });
    var external = auditExternalRequests(files);
    var libraries = auditLibraries(input.packageJson || { dependencies: {} }, scripts);
    var jargon = findJargon(visibleText(html));
    var checks = [
      {
        key: 'colors', label: 'Two crayons only', ok: colorOffenders.length === 0,
        detail: (cssResult.colorsChecked + htmlResult.colorsChecked) + ' written colors checked', offenders: colorOffenders
      },
      {
        key: 'offline', label: 'Works without internet', ok: external.length === 0,
        detail: 'Nothing is fetched from anywhere else', offenders: external
      },
      {
        key: 'libraries', label: 'Nothing borrowed', ok: libraries.length === 0,
        detail: 'No libraries listed or loaded', offenders: libraries
      },
      {
        key: 'plain', label: 'Plain English', ok: jargon.length === 0,
        detail: 'No hard computer words on the page', offenders: jargon.map(function (w) { return { value: w }; })
      }
    ];
    return {
      ok: checks.every(function (c) { return c.ok; }),
      checks: checks
    };
  }

  return {
    CRAYONS: CRAYONS,
    PAPER_RGB: PAPER_RGB,
    INK_RGB: INK_RGB,
    DAY_NAMES: DAY_NAMES,
    SLOTS: SLOTS,
    JARGON: JARGON,
    gcd: gcd,
    fr: fr,
    frAdd: frAdd,
    frSub: frSub,
    frMul: frMul,
    frDiv: frDiv,
    frCmp: frCmp,
    frEq: frEq,
    frNum: frNum,
    isFraction: isFraction,
    parseQuantity: parseQuantity,
    toMixedFraction: toMixedFraction,
    formatMixed: formatMixed,
    snapToKitchen: snapToKitchen,
    normalizeUnit: normalizeUnit,
    convertKitchenMeasure: convertKitchenMeasure,
    parseIngredientLine: parseIngredientLine,
    parseRecipeText: parseRecipeText,
    scaleIngredient: scaleIngredient,
    scaleRecipeIngredients: scaleRecipeIngredients,
    servingsFactor: servingsFactor,
    panRatio: panRatio,
    panPlan: panPlan,
    parseMoneyToCents: parseMoneyToCents,
    formatCents: formatCents,
    splitCents: splitCents,
    parsePeopleList: parsePeopleList,
    settleHouseholdBills: settleHouseholdBills,
    handoffPieces: handoffPieces,
    describeHandoff: describeHandoff,
    buildWeeklyCareCard: buildWeeklyCareCard,
    packState: packState,
    unpackState: unpackState,
    normalizeColor: normalizeColor,
    classifyColor: classifyColor,
    auditCss: auditCss,
    auditSvgAttributes: auditSvgAttributes,
    auditHtmlColors: auditHtmlColors,
    auditComputedColors: auditComputedColors,
    auditExternalRequests: auditExternalRequests,
    auditLibraries: auditLibraries,
    visibleText: visibleText,
    findJargon: findJargon,
    findSlop: findSlop,
    auditGrandmaDemands: auditGrandmaDemands
  };
});
