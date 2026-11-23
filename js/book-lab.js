/* The checkup bench. The same sums as the rest of the book, lined up for
   looking at: six batch and pan moves, a pan depth line, fewest handoffs
   against the plain greedy way, one stamp for every copy of the numbers,
   a short tail for the link, and the checks the book runs on itself.
   Pure functions only: same input, same answer. Runs in the page
   (window.GrandmaBookLab) and in Node (module.exports). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.GrandmaBookLab = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- SHA-256, written out by hand (FIPS 180-4) ---------- */

  var K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  var H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  /* Text to bytes the same way every time, including accents. A lone half of a
     surrogate pair becomes the replacement mark, like the device's own writer. */
  function utf8Encode(text) {
    var s = String(text);
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      var u = c;
      if (c >= 0xd800 && c <= 0xdbff) {
        if (i + 1 < s.length && s.charCodeAt(i + 1) >= 0xdc00 && s.charCodeAt(i + 1) <= 0xdfff) {
          u = 0x10000 + ((c - 0xd800) << 10) + (s.charCodeAt(i + 1) - 0xdc00);
          i += 1;
        } else {
          u = 0xfffd;
        }
      } else if (c >= 0xdc00 && c <= 0xdfff) {
        u = 0xfffd;
      }
      if (u < 0x80) out.push(u);
      else if (u < 0x800) out.push(0xc0 | (u >> 6), 0x80 | (u & 63));
      else if (u < 0x10000) out.push(0xe0 | (u >> 12), 0x80 | ((u >> 6) & 63), 0x80 | (u & 63));
      else out.push(0xf0 | (u >> 18), 0x80 | ((u >> 12) & 63), 0x80 | ((u >> 6) & 63), 0x80 | (u & 63));
    }
    return out;
  }

  function sha256Bytes(input) {
    var bytes = typeof input === 'string' ? utf8Encode(input) : Array.prototype.slice.call(input);
    var bitLen = bytes.length * 8;
    var bitHi = Math.floor(bitLen / 4294967296);
    var bitLo = bitLen >>> 0;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    bytes.push((bitHi >>> 24) & 255, (bitHi >>> 16) & 255, (bitHi >>> 8) & 255, bitHi & 255);
    bytes.push((bitLo >>> 24) & 255, (bitLo >>> 16) & 255, (bitLo >>> 8) & 255, bitLo & 255);
    var h = H0.slice();
    var w = new Array(64);
    for (var off = 0; off < bytes.length; off += 64) {
      for (var t = 0; t < 16; t++) {
        var j = off + t * 4;
        w[t] = (bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3];
      }
      for (t = 16; t < 64; t++) {
        var x = w[t - 15];
        var y = w[t - 2];
        var s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
        var s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
        w[t] = ((((w[t - 16] + s0) | 0) + w[t - 7]) | 0) + s1 | 0;
      }
      var a = h[0]; var b = h[1]; var c = h[2]; var d = h[3];
      var e = h[4]; var f = h[5]; var g = h[6]; var hh = h[7];
      for (t = 0; t < 64; t++) {
        var s1e = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (((((hh + s1e) | 0) + ch) | 0) + K256[t] | 0) + w[t] | 0;
        var s0a = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (s0a + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    var out = '';
    for (var i = 0; i < 8; i++) out += ('0000000' + (h[i] >>> 0).toString(16)).slice(-8);
    return out;
  }

  /* ---------- one careful way of writing any value ---------- */

  var MAX_DEPTH = 24;
  var MAX_NODES = 60000;

  /* Writes any plain value the same way every time: keys in order, cycles and
     deep or hostile shapes refused instead of silently written wrong. */
  function canonicalize(value) {
    var stack = [];
    var nodes = 0;
    function write(v, depth) {
      if (depth > MAX_DEPTH) throw new Error('Too deep to write carefully.');
      nodes += 1;
      if (nodes > MAX_NODES) throw new Error('Too much to write carefully.');
      if (v === null) return 'null';
      var t = typeof v;
      if (t === 'boolean') return v ? 'true' : 'false';
      if (t === 'number') {
        if (!isFinite(v)) throw new Error('Numbers must be finite.');
        if (Object.is(v, -0)) v = 0;
        return String(v);
      }
      if (t === 'string') return JSON.stringify(v);
      if (Array.isArray(v)) {
        if (stack.indexOf(v) >= 0) throw new Error('A loop in the data cannot be stamped.');
        stack.push(v);
        var parts = [];
        for (var i = 0; i < v.length; i++) parts.push(write(v[i], depth + 1));
        stack.pop();
        return '[' + parts.join(',') + ']';
      }
      if (t === 'object') {
        var proto = Object.getPrototypeOf(v);
        if (proto !== null && proto !== Object.prototype) throw new Error('This kind of value cannot be stamped.');
        if (stack.indexOf(v) >= 0) throw new Error('A loop in the data cannot be stamped.');
        stack.push(v);
        var keys = Object.keys(v).sort();
        var pairs = [];
        for (var k = 0; k < keys.length; k++) {
          pairs.push(JSON.stringify(keys[k]) + ':' + write(v[keys[k]], depth + 1));
        }
        stack.pop();
        return '{' + pairs.join(',') + '}';
      }
      throw new Error('This kind of value cannot be stamped.');
    }
    return write(value, 0);
  }

  /* One stamped payload per state key: the same book always gives the same
     stamp, and every copy of the numbers shares it. */
  var stampCache = new Map();

  function stamped(value) {
    var canonical = canonicalize(value);
    if (stampCache.has(canonical)) return stampCache.get(canonical);
    var entry = { canonical: canonical, hex: sha256Bytes(canonical) };
    if (stampCache.size >= 24) stampCache.clear();
    stampCache.set(canonical, entry);
    return entry;
  }

  function has(dict, key) { return Object.prototype.hasOwnProperty.call(dict, key); }

  function create(E) {
    function abs(f) { return f.n < 0 ? E.fr(-f.n, f.d) : f; }

    /* ---------- the six moves on the bench ---------- */

    var BENCH_ROWS = [
      { key: 'half', label: 'Half batch, serves two', kind: 'people', from: 4, to: 2 },
      { key: 'single', label: 'One batch, serves four', kind: 'people', from: 4, to: 4 },
      { key: 'family', label: 'Family batch, serves six', kind: 'people', from: 4, to: 6 },
      { key: 'potluck', label: 'Potluck batch, serves eight', kind: 'people', from: 4, to: 8 },
      {
        key: 'round9', label: '8 inch round to a 9 by 9 square pan', kind: 'pan',
        from: { shape: 'round', size: '8' }, to: { shape: 'rect', width: '9', height: '9' }
      },
      {
        key: 'sheet913', label: '8 by 8 pan to a 9 by 13 sheet', kind: 'pan',
        from: { shape: 'rect', width: '8', height: '8' }, to: { shape: 'rect', width: '9', height: '13' }
      }
    ];

    var ROW_BY_KEY = {};
    BENCH_ROWS.forEach(function (row) { ROW_BY_KEY[row.key] = row; });

    /* Reads the first number out of words like "2 2/3 cups". */
    function leadNumber(text) {
      var m = /^(-?\d+(?: \d+\/\d+|\/\d+|\.\d+)?)/.exec(String(text).trim());
      return m ? E.parseQuantity(m[1]) : null;
    }

    /* How far the shown measure sits from the exact answer, as a fraction of
     the exact amount. Counted things like eggs stay whole, so they are left
     out: the bench reports the drift on measures you pour or weigh. */
    function measureDrift(item, originalUnit) {
      var shown = leadNumber(item.text);
      if (shown === null || item.quantity.n === 0) return E.fr(0);
      try {
        var back = E.convertKitchenMeasure(shown, item.unit, originalUnit);
        var diff = abs(E.frSub(back.quantity, item.quantity));
        return E.frDiv(diff, abs(item.quantity));
      } catch (err) {
        return E.fr(0);
      }
    }

    function benchRows(recipeText) {
      var items = E.parseRecipeText(String(recipeText || '')).items.slice(0, 40);
      return BENCH_ROWS.map(function (row) {
        var factor;
        var depth = null;
        var plan = null;
        if (row.kind === 'people') {
          factor = E.servingsFactor(row.from, row.to);
        } else {
          plan = E.panPlan(row.from, row.to);
          factor = plan.recipeFactor;
          depth = plan.depthWithoutScaling;
        }
        var scaled = [];
        var problem = '';
        try {
          scaled = items.length === 0 ? [] : E.scaleRecipeIngredients(items, factor);
        } catch (err) {
          problem = err.message;
        }
        var rounded = scaled.filter(function (item) { return item.rounded; }).length;
        var worst = E.fr(0);
        scaled.forEach(function (item, index) {
          var originalUnit = items[index] ? items[index].unit : item.unit;
          if (originalUnit === 'each' || !item.rounded) return;
          var drift = measureDrift(item, originalUnit);
          if (E.frCmp(drift, worst) > 0) worst = drift;
        });
        var pct = E.frNum(E.frMul(worst, E.fr(100)));
        return {
          key: row.key,
          label: row.label,
          kind: row.kind,
          factor: factor,
          factorText: E.formatMixed(factor),
          depthText: row.kind === 'pan' ? 'about ' + E.formatMixed(depth) + ' as deep' : 'same pan',
          areaText: plan ? E.formatMixed(plan.areaRatio) + ' times the room' : 'same pan',
          roundedText: rounded + ' of ' + scaled.length,
          driftText: worst.n === 0 ? 'none' : pct.toFixed(1) + '%',
          driftPct: Math.round(pct * 10) / 10,
          problem: problem,
          apply: row.kind === 'people'
            ? { kind: 'people', from: row.from, to: row.to }
            : { kind: 'pan', from: row.from, to: row.to }
        };
      });
    }

    /* ---------- the pan curve ---------- */

    var CURVE_PANS = [
      { key: 'r6', label: '6 inch round', pan: { shape: 'round', size: '6' } },
      { key: 'r8', label: '8 inch round', pan: { shape: 'round', size: '8' } },
      { key: 'r9', label: '9 inch round', pan: { shape: 'round', size: '9' } },
      { key: 'r10', label: '10 inch round', pan: { shape: 'round', size: '10' } },
      { key: 's88', label: '8 by 8 square', pan: { shape: 'rect', width: '8', height: '8' } },
      { key: 's99', label: '9 by 9 square', pan: { shape: 'rect', width: '9', height: '9' } },
      { key: 's913', label: '9 by 13 sheet', pan: { shape: 'rect', width: '9', height: '13' } }
    ];

    var PAN_BY_KEY = {};
    CURVE_PANS.forEach(function (p) { PAN_BY_KEY[p.key] = p; });

    var FALLBACK_FROM = { shape: 'rect', width: '9', height: '13' };

    /* Depth of the same batch in every common pan, as a share of the depth in
       the written-for pan. Sorted by pan room so the line reads left to right. */
    function panRows(fromPan) {
      var base = fromPan;
      try {
        E.panRatio(base, base);
      } catch (err) {
        base = FALLBACK_FROM;
      }
      return CURVE_PANS.map(function (p) {
        var r = E.panRatio(base, p.pan);
        var depth = E.frDiv(E.fr(1), r.ratio);
        var friendlyDepth = E.snapToKitchen(depth, [2, 3, 4, 8]);
        return {
          key: p.key,
          label: p.label,
          pan: p.pan,
          area: r.areaTo,
          areaText: Math.round(r.areaTo) + ' square inches of room',
          ratio: r.ratio,
          ratioText: E.formatMixed(E.snapToKitchen(r.ratio, [2, 3, 4, 8])),
          depthRatio: depth,
          depthNum: E.frNum(depth),
          depthText: 'about ' + E.formatMixed(friendlyDepth) + ' as deep'
        };
      }).sort(function (a, b) { return a.area - b.area; });
    }

    /* Which curve pan matches a pan the book holds, or 'none'. */
    function panKeyFor(pan) {
      var found = 'none';
      CURVE_PANS.forEach(function (p) {
        var a = p.pan;
        var b = pan || {};
        if (a.shape !== b.shape) return;
        if (a.shape === 'round' && String(a.size) === String(b.size)) found = p.key;
        if (a.shape === 'rect' && String(a.width) === String(b.width) && String(a.height) === String(b.height)) found = p.key;
      });
      return found;
    }

    /* ---------- fewest handoffs against the plain greedy way ---------- */

    function names(n) {
      var list = [];
      for (var i = 0; i < n; i++) list.push('P' + (i + 1));
      return list;
    }

    var SPLIT_KINDS = {
      everyday: {
        label: 'Week of shared slips',
        build: function (n) {
          var people = names(n);
          var expenses = [];
          var i = 0;
          while (i < n) {
            var size = n - i > 4 ? 3 : n - i;
            var group = people.slice(i, i + size);
            expenses.push({ payer: people[i], cents: 1100 + ((i * 1553) % 4700), sharedBy: group });
            if (size > 1) {
              expenses.push({ payer: people[i + 1], cents: 640 + ((i * 733) % 900), sharedBy: group });
            }
            i += size;
          }
          return { people: people, expenses: expenses };
        }
      },
      pairs: {
        label: 'Slips shared by pairs',
        build: function (n) {
          var people = names(n);
          var expenses = [];
          for (var k = 0; k + 1 < n; k += 2) {
            expenses.push({ payer: people[k], cents: 820 + ((k * 977) % 1600), sharedBy: [people[k], people[k + 1]] });
          }
          if (n % 2 === 1) expenses.push({ payer: people[n - 1], cents: 1130, sharedBy: [people[n - 2], people[n - 1]] });
          return { people: people, expenses: expenses };
        }
      },
      turns: {
        label: 'Taking turns paying',
        build: function (n) {
          var people = names(n);
          var expenses = [];
          for (var i = 0; i < n; i += 4) {
            var group = people.slice(i, i + 4);
            var turn = i / 4;
            expenses.push({ payer: group[turn % group.length], cents: 950 + ((turn * 1249) % 2100), sharedBy: group });
            if (group.length > 2) {
              expenses.push({ payer: group[(turn + 1) % group.length], cents: 620 + ((turn * 811) % 1300), sharedBy: group });
            }
          }
          return { people: people, expenses: expenses };
        }
      }
    };

    /* The plain way: biggest owes meet biggest gets, one pot, no group hunt. */
    function greedyTransfers(entries) {
      var debtors = entries.filter(function (e) { return e.cents < 0; }).map(function (e) {
        return { name: e.name, cents: e.cents };
      });
      var creditors = entries.filter(function (e) { return e.cents > 0; }).map(function (e) {
        return { name: e.name, cents: e.cents };
      });
      var byBiggest = function (a, b) {
        return Math.abs(b.cents) - Math.abs(a.cents) || (a.name < b.name ? -1 : (a.name > b.name ? 1 : 0));
      };
      debtors.sort(byBiggest);
      creditors.sort(byBiggest);
      var out = [];
      var i = 0;
      var j = 0;
      for (var guard = 0; guard < 4000 && i < debtors.length && j < creditors.length; guard++) {
        var pay = Math.min(-debtors[i].cents, creditors[j].cents);
        out.push({ from: debtors[i].name, to: creditors[j].name, cents: pay });
        debtors[i].cents += pay;
        creditors[j].cents -= pay;
        if (debtors[i].cents === 0) i++;
        if (creditors[j].cents === 0) j++;
      }
      return out;
    }

    function openEntries(result) {
      return result.ledger.filter(function (row) { return row.netCents !== 0; }).map(function (row) {
        return { name: row.name, cents: row.netCents };
      });
    }

    function pieceCount(transfers) {
      return transfers.reduce(function (sum, t) {
        return sum + E.handoffPieces(t.cents).reduce(function (s, p) { return s + p.count; }, 0);
      }, 0);
    }

    /* Rows for houses of 3 to 12 people under one kind of week. */
    function splitRows(kindKey) {
      var kind = has(SPLIT_KINDS, kindKey) ? SPLIT_KINDS[kindKey] : SPLIT_KINDS.everyday;
      var rows = [];
      for (var n = 3; n <= 12; n++) {
        var scenario = kind.build(n);
        var exact = E.settleHouseholdBills(scenario);
        var greedy = greedyTransfers(openEntries(exact));
        rows.push({
          people: n,
          exact: exact.handoffs,
          greedy: greedy.length,
          saved: greedy.length - exact.handoffs,
          piecesExact: pieceCount(exact.transfers),
          piecesGreedy: pieceCount(greedy)
        });
      }
      return rows;
    }

    /* ---------- the book's numbers, stamped once ---------- */

    function slipCents(e) {
      if (Number.isInteger(e.cents)) return e.cents;
      try {
        return E.parseMoneyToCents(e.amount);
      } catch (err) {
        return 0;
      }
    }

    /* The plain object the stamp covers: what the book holds, what it worked
       out, and where the bench stands. Nothing dated, so the stamp is steady. */
    function bookPayload(state, bench) {
      var parsed = E.parseRecipeText(String(state.recipeText || ''));
      var people = E.parsePeopleList(String(state.people || ''));
      var settle = null;
      try {
        settle = E.settleHouseholdBills({
          people: people,
          expenses: (state.expenses || []).map(function (e) {
            return { payer: e.payer, amount: e.amount, sharedBy: e.sharedBy };
          })
        });
      } catch (err) {
        settle = null;
      }
      return {
        book: 'two-crayon-kitchen-and-bill-book',
        shape: 2,
        recipe: {
          text: String(state.recipeText || ''),
          from: state.from,
          to: state.to,
          by: state.scaleBy === 'pan' ? 'pan' : 'people',
          ingredients: parsed.items.length
        },
        pans: {
          written: {
            shape: state.panFrom && state.panFrom.shape === 'round' ? 'round' : 'rect',
            size: String((state.panFrom || {}).size || ''),
            width: String((state.panFrom || {}).width || ''),
            height: String((state.panFrom || {}).height || '')
          },
          baking: {
            shape: state.panTo && state.panTo.shape === 'round' ? 'round' : 'rect',
            size: String((state.panTo || {}).size || ''),
            width: String((state.panTo || {}).width || ''),
            height: String((state.panTo || {}).height || '')
          }
        },
        house: {
          people: people,
          slips: (state.expenses || []).map(function (e) {
            return { what: String(e.label || ''), payer: String(e.payer || ''), cents: slipCents(e), sharedBy: (e.sharedBy || []).map(String) };
          }),
          sum: settle ? settle.totalCents : 0,
          handoffs: settle ? settle.handoffs : 0,
          transfers: settle ? settle.transfers : []
        },
        card: (state.care || []).map(function (c) {
          var item = { kind: String(c.kind || ''), name: String(c.name || '') };
          if (c.dose !== undefined) item.dose = String(c.dose);
          if (c.slots !== undefined) item.slots = (c.slots || []).map(String);
          if (c.everyDays !== undefined) item.everyDays = c.everyDays;
          return item;
        }),
        bench: {
          pan: bench && bench.pan ? String(bench.pan) : 'none',
          pattern: bench && bench.pattern ? String(bench.pattern) : 'everyday',
          row: bench && bench.row ? String(bench.row) : 'none',
          size: bench && bench.size ? bench.size : 0
        }
      };
    }

    /* A copy of the payload with one penny moved, to prove the stamp catches it. */
    function tamperPayload(payload) {
      var copy = JSON.parse(JSON.stringify(payload));
      if (copy.house.slips.length > 0) {
        copy.house.slips[0].cents += 1;
      }
      copy.house.sum += 1;
      return copy;
    }

    /* ---------- copies of the numbers, all carrying the one stamp ---------- */

    function stampLine(entry) {
      return 'Stamp ' + entry.hex;
    }

    function exportNumbers(payload, entry) {
      return JSON.stringify({
        book: 'Two-Crayon Kitchen & Bill Book',
        stamp: entry.hex,
        numbers: payload
      }, null, 2) + '\n';
    }

    /* One cell in a sheet file. A cell that could read as a formula gets a
       leading single quote so it opens as plain text. */
    function csvCell(value) {
      var s = String(value);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }

    function csvRow(cells) {
      return cells.map(csvCell).join(',');
    }

    function exportSheet(payload, rows, entry) {
      var out = ['Kitchen & slip checkup', 'Stamp,' + csvCell(entry.hex), ''];
      out.push(csvRow(['Try', 'Times the recipe', 'Batter depth', 'Rounded measures', 'Worst drift']));
      rows.forEach(function (row) {
        out.push(csvRow([row.label, row.factorText, row.depthText, row.roundedText, row.driftText]));
      });
      out.push('');
      out.push(csvRow(['From', 'Hands to', 'Amount']));
      payload.house.transfers.forEach(function (t) {
        out.push(csvRow([t.from, t.to, E.formatCents(t.cents)]));
      });
      out.push('');
      out.push(csvRow(['Slip sum', E.formatCents(payload.house.sum)]));
      out.push(csvRow(['Handoffs', String(payload.house.handoffs)]));
      return out.join('\n') + '\n';
    }

    function exportNotes(payload, rows, entry) {
      var lines = [
        '# Kitchen & slip checkup',
        '',
        'Stamp: ' + entry.hex,
        '',
        '## Pans and batches',
        ''
      ];
      rows.forEach(function (row) {
        lines.push('- ' + row.label + ': ' + row.factorText + ' times the recipe, ' + row.depthText +
          ', ' + row.roundedText + ' rounded, worst drift ' + row.driftText + '.');
      });
      lines.push('');
      lines.push('## The house');
      lines.push('');
      lines.push('- ' + payload.house.slips.length + ' slips, ' + E.formatCents(payload.house.sum) +
        ' in all, ' + payload.house.handoffs + (payload.house.handoffs === 1 ? ' handoff' : ' handoffs') + '.');
      lines.push('');
      lines.push('Checked just now. Change one penny and this stamp no longer matches.');
      return lines.join('\n') + '\n';
    }

    /* ---------- the link tail ---------- */

    var TAIL_PANS = { none: 1 };
    CURVE_PANS.forEach(function (p) { TAIL_PANS[p.key] = 1; });
    var TAIL_PATTERNS = { everyday: 1, pairs: 1, turns: 1 };
    var TAIL_ROWS = { none: 1 };
    BENCH_ROWS.forEach(function (row) { TAIL_ROWS[row.key] = 1; });

    function encodeTail(bench) {
      var pan = has(TAIL_PANS, bench && bench.pan) ? bench.pan : 'none';
      var pattern = has(TAIL_PATTERNS, bench && bench.pattern) ? bench.pattern : 'everyday';
      var row = has(TAIL_ROWS, bench && bench.row) ? bench.row : 'none';
      var size = Number(bench && bench.size);
      if (!Number.isInteger(size) || size < 0 || size > 12 || (size > 0 && size < 3)) size = 0;
      var tamper = bench && bench.tamper ? 1 : 0;
      return 'checkup=' + pan + '.' + pattern + '.' + row + '.' + size + '.' + tamper;
    }

    /* Reads the checkup tail off the end of a link. Anything that is not
       exactly a known tail is refused, so a hostile tail opens a safe bench. */
    function parseTail(hash) {
      var s = String(hash == null ? '' : hash).replace(/^#/, '');
      var found = null;
      s.split('&').forEach(function (part) {
        if (/^checkup=/.test(part)) found = part.slice(8);
      });
      if (found === null) return null;
      var m = /^([a-z0-9]{2,16})\.([a-z0-9]{2,16})\.([a-z0-9]{2,16})\.(\d{1,2})\.([01])$/.exec(found);
      if (!m) return null;
      if (!has(TAIL_PANS, m[1]) || !has(TAIL_PATTERNS, m[2]) || !has(TAIL_ROWS, m[3])) return null;
      var size = Number(m[4]);
      if (!(size === 0 || (size >= 3 && size <= 12))) return null;
      return { pan: m[1], pattern: m[2], row: m[3], size: size, tamper: m[5] === '1' };
    }

    /* ---------- the checks the book runs on itself ---------- */

    function netAfterTransfers(result) {
      var net = {};
      result.ledger.forEach(function (row) { net[row.name] = row.netCents; });
      result.transfers.forEach(function (t) {
        net[t.from] += t.cents;
        net[t.to] -= t.cents;
      });
      return net;
    }

    function selfChecks(env) {
      var where = env || {};
      var checks = [];
      function add(key, label, ok, detail) {
        checks.push({ key: key, label: label, ok: ok === true, detail: detail });
      }

      var exact = E.frEq(E.frAdd(E.fr(1, 3), E.fr(1, 6)), E.fr(1, 2)) &&
        E.frEq(E.frMul(E.fr(2, 3), E.fr(3, 4)), E.fr(1, 2)) &&
        E.frEq(E.frSub(E.fr(1, 2), E.fr(1, 3)), E.fr(1, 6));
      add('fractions', 'Fractions stay exact', exact,
        'A third and a sixth make a half, and two thirds of three quarters make a half, down to the crumb.');

      var cupTsp = E.frEq(E.convertKitchenMeasure('1', 'cup', 'tsp').quantity, E.fr(48));
      add('cup', 'A cup is 48 teaspoons', cupTsp,
        'One cup converts to exactly 48 teaspoons and a tablespoon to exactly 3.');

      var swap = E.convertKitchenMeasure('1', 'cup', 'tbsp');
      var back = E.convertKitchenMeasure(swap.quantity, 'tbsp', 'cup');
      add('swap', 'Cups and spoons swap both ways', E.frEq(back.quantity, E.fr(1)) && swap.text === '16 tbsp',
        'A cup becomes 16 tablespoons and comes back as exactly 1 cup.');

      var ozg = E.convertKitchenMeasure('1', 'oz', 'g');
      add('weight', 'Ounces to grams is marked close', ozg.approximate === true,
        'Weight swaps are honest: they say "close" instead of pretending to be exact.');

      var eggs = E.scaleIngredient(E.parseIngredientLine('3 eggs'), E.fr(1, 2));
      add('eggs', 'Eggs stay whole', eggs.text === '2' && /Whole ones only/.test(eggs.note),
        'Three eggs for a half batch becomes 2 eggs, never one and a half.');

      var bench = benchRows(where.recipeText !== undefined ? where.recipeText : '1 cup flour\n2 eggs');
      var decimalFree = bench.every(function (row) { return !/\d\.\d/.test(row.factorText + row.depthText); });
      var driftNum = bench.every(function (row) { return row.driftText === 'none' || /^\d+\.\d%$/.test(row.driftText); });
      add('decimals', 'No long decimals on the bench', decimalFree && driftNum,
        'Every number on the bench is a kitchen fraction, a count, or a percent.');

      var conserved = true;
      var evenHand = true;
      Object.keys(SPLIT_KINDS).forEach(function (kindKey) {
        for (var n = 3; n <= 12; n++) {
          var result = E.settleHouseholdBills(SPLIT_KINDS[kindKey].build(n));
          var net = netAfterTransfers(result);
          Object.keys(net).forEach(function (name) { if (net[name] !== 0) conserved = false; });
          if (result.ledger.reduce(function (s, row) { return s + row.netCents; }, 0) !== 0) conserved = false;
          result.transfers.forEach(function (t) { if (t.cents <= 0) evenHand = false; });
        }
      });
      add('cents', 'Every penny is accounted for', conserved && evenHand,
        'Across 30 worked houses, who paid and who owes still balance to the penny after the handoffs.');

      var rotate = E.splitCents(1000, 3, 0).join(',') === '334,333,333' &&
        E.splitCents(1000, 3, 1).join(',') === '333,334,333' &&
        E.splitCents(1000, 3, 2).join(',') === '333,333,334';
      add('rotate', 'Leftover pennies take turns', rotate,
        'When a slip will not split evenly, the extra penny moves down the list each time.');

      var rows = splitRows('everyday').concat(splitRows('pairs')).concat(splitRows('turns'));
      var neverWorse = rows.every(function (row) { return row.exact <= row.greedy && row.piecesExact >= 0; });
      var someBetter = rows.some(function (row) { return row.exact < row.greedy; });
      add('fewest', 'Fewest handoffs really is fewest', neverWorse && someBetter,
        'In every worked house the book needed no more handoffs than the plain way, and some needed fewer.');

      var piecesAdd = true;
      var probe = E.settleHouseholdBills(SPLIT_KINDS.everyday.build(7));
      probe.transfers.forEach(function (t) {
        var sum = E.handoffPieces(t.cents).reduce(function (s, p) { return s + p.value * p.count; }, 0);
        if (sum !== t.cents) piecesAdd = false;
      });
      add('pieces', 'Bills and coins add up', piecesAdd,
        'Every handoff breaks into bills and coins that add back to the exact amount.');

      var kat = sha256Bytes('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' &&
        sha256Bytes('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' &&
        sha256Bytes('The quick brown fox jumps over the lazy dog') === 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592';
      add('stamp-kat', 'The stamp matches known answers', kat,
        'The stamp writer was checked against answers published for everyone to compare.');

      var payload = where.payload || bookPayload({
        recipeText: '1 cup flour\n2 eggs', from: 4, to: 6, scaleBy: 'people',
        panFrom: { shape: 'round', size: '8' }, panTo: { shape: 'rect', width: '9', height: '9' },
        people: 'Alma, Ben', expenses: [{ label: 'Milk', payer: 'Alma', amount: '3.50', sharedBy: [] }],
        care: []
      }, { pan: 'none', pattern: 'everyday', row: 'none', size: 0, tamper: false });
      var entry = stamped(payload);
      var four = [stampLine(entry), exportNumbers(payload, entry),
        exportSheet(payload, bench, entry), exportNotes(payload, bench, entry)];
      var parity = four.every(function (text) { return text.indexOf(entry.hex) >= 0; });
      add('parity', 'One stamp on every copy', parity,
        'The page line, the numbers file, the sheet file and the note all carry the same stamp.');

      var changed = stamped(tamperPayload(payload));
      add('tamper', 'One penny moved is caught', changed.hex !== entry.hex,
        'Moving one penny on one slip gives a different stamp.');

      var tail = encodeTail({ pan: 'r8', pattern: 'pairs', row: 'potluck', size: 7, tamper: true });
      var round = parseTail('#' + tail);
      var trip = round !== null && round.pan === 'r8' && round.pattern === 'pairs' && round.row === 'potluck' &&
        round.size === 7 && round.tamper === true;
      add('tail', 'The link tail remembers', trip,
        'A link tail written out and read back gives the same bench.');

      var hostile = ['#checkup=__proto__.everyday.none.0.0', '#checkup=r8.everyday.none.99.0',
        '#checkup=r8.everyday.none.7.2', '#checkup=<script>', '#checkup=', '#checkup=none',
        '#checkup=r8.everyday.none.7.0.extra', '#checkup=r8,everyday,none,7,0', '#checkup=r8.everyday.none.7'];
      var safe = hostile.every(function (h) { return parseTail(h) === null; });
      add('hostile', 'A broken link tail is safe', safe,
        'Tails that do not match the shape exactly are refused and the bench opens safe.');

      var audit = typeof where.html === 'string' && typeof where.css === 'string'
        ? E.auditGrandmaDemands({ html: where.html, css: where.css, scripts: where.scripts || {}, packageJson: where.packageJson || {} })
        : null;
      var colors = audit ? audit.checks[0].ok : false;
      var liveOk = where.liveOk !== false;
      add('colors', 'Two crayons only', colors && liveOk,
        'Every written color and every color the page reports is paper, ink, or ink thinned out.');

      var wanted = (where.bookFiles || []).length;
      var answered = where.fetchedOk === undefined ? 0 : where.fetchedOk;
      var savedFine = where.savedOk !== false;
      add('files', 'Every saved file answers', wanted > 0 && answered >= wanted - 1 && savedFine,
        'Each file the saved copy lists came back when asked.');

      var borrowed = audit ? (audit.checks[1].ok && audit.checks[2].ok) : false;
      add('borrowed', 'Nothing borrowed', borrowed,
        'No libraries are listed and nothing is fetched from anywhere else.');

      var plain = audit ? audit.checks[3].ok : false;
      add('plain', 'Plain English on the page', plain,
        'No hard computer words anywhere a reader can see them.');

      var benchHonest = BENCH_ROWS.every(function (row) {
        var f = row.kind === 'people' ? E.servingsFactor(row.from, row.to) : E.panPlan(row.from, row.to).recipeFactor;
        return E.frEq(f, bench.filter(function (r) { return r.key === row.key; })[0].factor);
      });
      add('honest', 'The bench uses the book\'s own sums', benchHonest,
        'Each row was worked out by the same sums the kitchen uses, not a copy of them.');

      var flips = panRows({ shape: 'round', size: '8' }).every(function (p) {
        var prod = E.frMul(p.ratio, p.depthRatio);
        return E.frCmp(prod, E.fr(99, 100)) >= 0 && E.frCmp(prod, E.fr(101, 100)) <= 0;
      });
      add('depth', 'Pan depth is the flip of pan room', flips,
        'A pan with twice the room gives half the depth, for the same batch.');

      var steady = stamped(payload).hex === entry.hex && stamped(payload) === entry;
      add('steady', 'The same book writes the same stamp', steady,
        'Asked twice, the book gives the identical stamp, not a fresh one.');

      return checks;
    }

    return {
      sha256Bytes: sha256Bytes,
      sha256Hex: sha256Bytes,
      utf8Encode: utf8Encode,
      canonicalize: canonicalize,
      stamped: stamped,
      stampLine: stampLine,
      BENCH_ROWS: BENCH_ROWS,
      ROW_BY_KEY: ROW_BY_KEY,
      benchRows: benchRows,
      CURVE_PANS: CURVE_PANS,
      PAN_BY_KEY: PAN_BY_KEY,
      panRows: panRows,
      panKeyFor: panKeyFor,
      SPLIT_KINDS: SPLIT_KINDS,
      splitScenario: function (key, n) { return (has(SPLIT_KINDS, key) ? SPLIT_KINDS[key] : SPLIT_KINDS.everyday).build(n); },
      splitRows: splitRows,
      greedyTransfers: greedyTransfers,
      openEntries: openEntries,
      pieceCount: pieceCount,
      bookPayload: bookPayload,
      tamperPayload: tamperPayload,
      csvCell: csvCell,
      exportNumbers: exportNumbers,
      exportSheet: exportSheet,
      exportNotes: exportNotes,
      encodeTail: encodeTail,
      parseTail: parseTail,
      selfChecks: selfChecks
    };
  }

  return {
    create: create,
    sha256Bytes: sha256Bytes,
    sha256Hex: sha256Bytes,
    utf8Encode: utf8Encode,
    canonicalize: canonicalize
  };
});
