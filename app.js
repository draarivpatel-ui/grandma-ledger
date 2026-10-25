/* Wires the page to the engine. All the sums live in js/engine.js and all the
   picture-making lives in render.js. This file only reads the boxes on the
   page, asks for answers, and puts them back. */
(function () {
  'use strict';

  var E = window.GrandmaEngine;
  var S = window.GrandmaShare;
  var R = window.GrandmaRender.create(E);
  var KEY = 'two-crayon-book-v1';

  var DEFAULTS = {
    v: 1,
    recipeText: [
      '1 3/4 cups all-purpose flour', '2/3 cup brown sugar', '1/2 cup butter, melted', '2 eggs', '3 ripe bananas',
      '1 tsp baking soda', 'a pinch of salt', '2 tsp vanilla', '3 tbsp milk'
    ].join('\n'),
    from: 4,
    to: 6,
    scaleBy: 'people',
    panFrom: { shape: 'rect', size: '9', width: '9', height: '5' },
    panTo: { shape: 'rect', size: '8', width: '8', height: '8' },
    people: 'Alma, Ben, Cora',
    expenses: [
      { label: 'Saturday groceries', payer: 'Alma', amount: '$62.40', sharedBy: [] },
      { label: 'Electric bill', payer: 'Ben', amount: '$88.15', sharedBy: [] },
      { label: 'Rainy day pizza', payer: 'Cora', amount: '$27.30', sharedBy: ['Ben', 'Cora'] }
    ],
    care: [
      { kind: 'medicine', name: 'Vitamin D', dose: '1 tablet', slots: ['morning'] },
      { kind: 'medicine', name: 'Allergy tablet', dose: '1 tablet', slots: ['evening'] },
      { kind: 'plant', name: 'Basil', slots: ['morning'], everyDays: 3 },
      { kind: 'pantry', name: 'Tins and jars' }
    ]
  };

  var state = clone(DEFAULTS);
  var lastPlan = null;

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function $(id) { return document.getElementById(id); }
  function text(el, value) { el.textContent = value; }

  /* ---------- keeping the book on the device ---------- */

  function cleanPan(pan, fallback) {
    var out = clone(fallback);
    if (pan && typeof pan === 'object') {
      if (pan.shape === 'round' || pan.shape === 'rect') out.shape = pan.shape;
      ['size', 'width', 'height'].forEach(function (k) {
        if (typeof pan[k] === 'string' || typeof pan[k] === 'number') out[k] = String(pan[k]).slice(0, 12);
      });
    }
    return out;
  }

  function adopt(saved) {
    if (!saved || typeof saved !== 'object') return;
    var next = clone(DEFAULTS);
    if (typeof saved.recipeText === 'string') next.recipeText = saved.recipeText.slice(0, 4000);
    if (Number.isInteger(saved.from) && saved.from > 0) next.from = saved.from;
    if (Number.isInteger(saved.to) && saved.to > 0) next.to = saved.to;
    if (saved.scaleBy === 'pan') next.scaleBy = 'pan';
    next.panFrom = cleanPan(saved.panFrom, DEFAULTS.panFrom);
    next.panTo = cleanPan(saved.panTo, DEFAULTS.panTo);
    if (typeof saved.people === 'string') next.people = saved.people.slice(0, 400);
    if (Array.isArray(saved.expenses)) {
      next.expenses = saved.expenses.slice(0, 200).filter(function (e) {
        return e && typeof e.payer === 'string' && typeof e.amount === 'string';
      }).map(function (e) {
        return {
          label: String(e.label || '').slice(0, 80),
          payer: e.payer.slice(0, 60),
          amount: e.amount.slice(0, 20),
          sharedBy: Array.isArray(e.sharedBy) ? e.sharedBy.map(String).slice(0, 40) : []
        };
      });
    }
    if (Array.isArray(saved.care)) {
      next.care = saved.care.slice(0, 100).filter(function (c) {
        return c && typeof c.name === 'string' && ['medicine', 'plant', 'pantry'].indexOf(c.kind) >= 0;
      }).map(function (c) {
        var item = { kind: c.kind, name: c.name.slice(0, 60) };
        if (typeof c.dose === 'string' && c.dose !== '') item.dose = c.dose.slice(0, 40);
        if (Array.isArray(c.slots)) item.slots = c.slots.filter(function (s) { return E.SLOTS.indexOf(s) >= 0; });
        if (Number.isInteger(c.everyDays)) item.everyDays = c.everyDays;
        return item;
      });
    }
    state = next;
  }

  var saveTimer = null;
  function save() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(function () {
      try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (err) { /* private mode */ }
    }, 250);
  }

  function loadSaved() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) adopt(JSON.parse(raw));
    } catch (err) { /* nothing saved yet */ }
  }

  /* ---------- the kitchen ---------- */

  function readPan(prefix, pan) {
    if (pan.shape === 'round') return { shape: 'round', size: pan.size };
    return { shape: 'rect', width: pan.width, height: pan.height };
  }

  function renderKitchen() {
    var parsed = E.parseRecipeText(state.recipeText);
    var problems = $('recipe-problems');
    var readout = $('scale-readout');
    var list = $('ingredient-list');
    var factor = null;
    var why = '';
    var message = '';
    if (parsed.problems.length > 0) {
      message = 'Line ' + parsed.problems[0].line + ' needs an amount at the start, like "2 cups flour". ' +
        (parsed.problems.length > 1 ? (parsed.problems.length - 1) + ' more lines need the same.' : '');
    }
    try {
      if (state.scaleBy === 'pan') {
        if (lastPlan === null) throw new Error('Fill in both pans below first.');
        factor = lastPlan.recipeFactor;
        why = 'from the new pan';
      } else {
        factor = E.servingsFactor(state.from, state.to);
        why = state.to + ' people instead of ' + state.from;
      }
    } catch (err) {
      message = err.message;
    }
    text(problems, message);
    $('recipe-text').setAttribute('aria-invalid', message === '' ? 'false' : 'true');
    if (factor === null || parsed.items.length === 0) {
      list.innerHTML = '';
      text(readout, parsed.items.length === 0 ? 'Add an ingredient to begin.' : '');
      return;
    }
    text(readout, 'Everything times ' + E.formatMixed(factor) + ', ' + why + '.');
    list.innerHTML = R.ingredientList(E.scaleRecipeIngredients(parsed.items, factor));
  }

  function syncPanFields() {
    ['pf', 'pt'].forEach(function (prefix) {
      var shape = $(prefix + '-shape').value;
      document.querySelectorAll('[data-shape-for="' + prefix + '"]').forEach(function (row) {
        row.hidden = row.getAttribute('data-shape') !== shape;
      });
    });
  }

  function renderPan() {
    var problems = $('pan-problems');
    var figure = $('pan-figure');
    try {
      var from = readPan('pf', state.panFrom);
      var to = readPan('pt', state.panTo);
      var plan = E.panPlan(from, to);
      lastPlan = plan;
      text(problems, '');
      figure.innerHTML = R.panFigure(from, to, plan, 'pan');
      text($('pan-advice-scaled'), plan.scaledAdvice + (plan.snapped ? ' This is rounded to the nearest friendly measure.' : ''));
      text($('pan-advice-unscaled'), plan.unscaledAdvice);
      $('use-pan-scale').disabled = false;
    } catch (err) {
      lastPlan = null;
      figure.innerHTML = '';
      text(problems, err.message);
      text($('pan-advice-scaled'), '');
      text($('pan-advice-unscaled'), '');
      $('use-pan-scale').disabled = true;
    }
  }

  /* ---------- the bill book ---------- */

  function peopleNow() { return E.parsePeopleList(state.people); }

  function renderPeopleControls() {
    var people = peopleNow();
    var payer = $('exp-payer');
    var keep = payer.value;
    payer.innerHTML = people.map(function (p) {
      return '<option value="' + R.esc(p) + '">' + R.esc(p) + '</option>';
    }).join('');
    if (people.indexOf(keep) >= 0) payer.value = keep;
    var boxes = $('exp-sharers');
    var checked = {};
    boxes.querySelectorAll('input').forEach(function (box) { checked[box.value] = box.checked; });
    boxes.innerHTML = '<legend>Shared by</legend>' + people.map(function (p) {
      var on = Object.prototype.hasOwnProperty.call(checked, p) ? checked[p] : true;
      return '<label class="tick"><input type="checkbox" value="' + R.esc(p) + '"' + (on ? ' checked' : '') + '><span>' +
        R.esc(p) + '</span></label>';
    }).join('');
  }

  function renderBills() {
    var problems = $('people-problems');
    var people = peopleNow();
    $('expense-list').innerHTML = R.expenseList(state.expenses);
    try {
      var result = E.settleHouseholdBills({
        people: people,
        expenses: state.expenses.map(function (e) {
          return { payer: e.payer, amount: e.amount, sharedBy: e.sharedBy };
        })
      });
      text(problems, '');
      $('people-input').setAttribute('aria-invalid', 'false');
      $('settle-figure').innerHTML = R.settlementFigure(result, 'settle');
      $('settle-list').innerHTML = state.expenses.length === 0
        ? '<li class="handoff handoff-square">Add a slip above and the handoffs will appear here.</li>'
        : R.settlementList(result);
      $('ledger').innerHTML = R.ledgerTable(result);
    } catch (err) {
      text(problems, err.message + ' Fix the names, or take that slip off the list.');
      $('people-input').setAttribute('aria-invalid', 'true');
      $('settle-figure').innerHTML = '';
      $('settle-list').innerHTML = '';
      $('ledger').innerHTML = '';
    }
  }

  function addSlip() {
    var problems = $('slip-problems');
    var people = peopleNow();
    try {
      var cents = E.parseMoneyToCents($('exp-amount').value);
      if (cents <= 0) throw new Error('A slip needs an amount bigger than nothing.');
      var payer = $('exp-payer').value;
      if (people.indexOf(payer) < 0) throw new Error('Pick who paid.');
      var picked = [];
      $('exp-sharers').querySelectorAll('input').forEach(function (box) { if (box.checked) picked.push(box.value); });
      if (picked.length === 0) throw new Error('Pick at least one person to share it.');
      state.expenses.push({
        label: $('exp-label').value.trim().slice(0, 80),
        payer: payer,
        amount: E.formatCents(cents),
        sharedBy: picked.length === people.length ? [] : picked
      });
      text(problems, '');
      $('exp-label').value = '';
      $('exp-amount').value = '';
      $('exp-amount').setAttribute('aria-invalid', 'false');
      save();
      renderBills();
    } catch (err) {
      text(problems, err.message);
      $('exp-amount').setAttribute('aria-invalid', 'true');
    }
  }

  /* ---------- the care card ---------- */

  function syncCareFields() {
    var kind = $('care-kind').value;
    document.querySelectorAll('[data-kind-show]').forEach(function (el) {
      el.hidden = el.getAttribute('data-kind-show').split(' ').indexOf(kind) < 0;
    });
  }

  function renderCare() {
    $('care-items').innerHTML = R.careItemList(state.care);
    var conflicts = $('care-conflicts');
    try {
      var card = E.buildWeeklyCareCard(state.care);
      $('care-card').innerHTML = R.careCard(card);
      if (card.conflicts.length > 0) {
        var shown = card.conflicts.slice(0, 3).map(function (c) { return c.message; }).join(' ');
        text(conflicts, 'These repeats were left off the card. ' + shown +
          (card.conflicts.length > 3 ? ' And ' + (card.conflicts.length - 3) + ' more.' : ''));
      } else {
        text(conflicts, '');
      }
    } catch (err) {
      $('care-card').innerHTML = '';
      text(conflicts, err.message);
    }
  }

  function addCare() {
    var problems = $('care-problems');
    var name = $('care-name').value.trim();
    var kind = $('care-kind').value;
    try {
      if (name === '') throw new Error('Give it a name.');
      var item = { kind: kind, name: name.slice(0, 60) };
      if (kind !== 'pantry') {
        item.slots = [];
        document.querySelectorAll('input[name="care-slot"]').forEach(function (box) {
          if (box.checked) item.slots.push(box.value);
        });
        if (item.slots.length === 0) throw new Error('Pick at least one time of day.');
      }
      if (kind === 'medicine' && $('care-dose').value.trim() !== '') item.dose = $('care-dose').value.trim().slice(0, 40);
      if (kind === 'plant') item.everyDays = Number($('care-every').value);
      E.buildWeeklyCareCard([item]);
      state.care.push(item);
      text(problems, '');
      $('care-name').value = '';
      $('care-dose').value = '';
      $('care-name').setAttribute('aria-invalid', 'false');
      save();
      renderCare();
    } catch (err) {
      text(problems, err.message);
      $('care-name').setAttribute('aria-invalid', 'true');
    }
  }

  /* ---------- the check ---------- */

  var COLOR_PROPS = [
    'color', 'background-color', 'background-image', 'border-top-color', 'border-right-color',
    'border-bottom-color', 'border-left-color', 'outline-color', 'text-decoration-color', 'fill', 'stroke',
    'box-shadow', 'text-shadow', 'caret-color', 'accent-color', 'column-rule-color'
  ];

  function liveColors() {
    var seen = new Set();
    var entries = [];
    var nodes = document.querySelectorAll('html, body, body *');
    nodes.forEach(function (node) {
      [undefined, '::before', '::after'].forEach(function (pseudo) {
        var style = window.getComputedStyle(node, pseudo);
        if (pseudo !== undefined && style.content === 'none') return;
        COLOR_PROPS.forEach(function (prop) {
          var value = style.getPropertyValue(prop);
          var key = prop + '|' + value;
          if (value === '' || seen.has(key)) return;
          seen.add(key);
          entries.push({ where: prop, value: value });
        });
      });
    });
    return { parts: nodes.length, result: E.auditComputedColors(entries) };
  }

  function readFiles() {
    var names = window.BOOK_FILES.filter(function (f) { return f !== './'; });
    return Promise.all(names.map(function (name) {
      return window.fetch(name).then(function (r) {
        if (!r.ok) throw new Error(name);
        return /\.woff2$/.test(name) ? '' : r.text();
      }).then(function (body) { return { name: name, body: body, ok: true }; })
        .catch(function () { return { name: name, body: '', ok: false }; });
    }));
  }

  function savedCopy() {
    if (!('serviceWorker' in navigator) || !window.caches) {
      return Promise.resolve({ ok: false, detail: 'This device cannot keep a saved copy of the book.', kept: 0 });
    }
    return window.caches.open(window.BOOK_VERSION).then(function (cache) {
      return cache.keys();
    }).then(function (keys) {
      var wanted = window.BOOK_FILES.length;
      var kept = keys.length;
      var online = navigator.onLine ? 'You are connected right now, but nothing needs it.' : 'You are offline right now and the book still works.';
      if (kept >= wanted - 1) return { ok: true, detail: kept + ' files are saved on this device. ' + online, kept: kept };
      return { ok: false, detail: 'Only ' + kept + ' of ' + wanted + ' files are saved so far. Reload once the page has settled.', kept: kept };
    }).catch(function () {
      return { ok: false, detail: 'The saved copy could not be read.', kept: 0 };
    });
  }

  var checking = 0;
  function runCheck() {
    var run = ++checking;
    var waiting = ['Two crayons only', 'Works without internet', 'Nothing borrowed', 'Plain English'].map(function (label) {
      return { label: label, ok: null, detail: 'Looking now.' };
    });
    $('audit-list').innerHTML = R.auditRows(waiting);
    setStamp('wait');
    return Promise.all([readFiles(), savedCopy()]).then(function (got) {
      if (run !== checking) return;
      var files = got[0];
      var unread = files.filter(function (f) { return !f.ok; });
      var by = {};
      files.forEach(function (f) { by[f.name] = f.body; });
      var scripts = {};
      Object.keys(by).filter(function (n) { return /\.js$/.test(n); }).forEach(function (n) { scripts[n] = by[n]; });
      var audit = E.auditGrandmaDemands({
        html: by['./index.html'] || '',
        css: (by['./tokens.css'] || '') + '\n' + (by['./styles.css'] || ''),
        scripts: scripts,
        packageJson: by['./package.json'] || '{}'
      });
      var live = liveColors();
      var saved = got[1];
      var rows = audit.checks.map(function (c) { return { label: c.label, ok: c.ok, detail: c.detail }; });
      var liveBad = live.result.offenders.length;
      rows[0].ok = rows[0].ok && liveBad === 0;
      rows[0].detail = rows[0].ok
        ? 'Looked at ' + live.parts + ' parts of this page and every file that styles it. Every color is paper, ink, or ink thinned out.'
        : 'A third color was found: ' + (live.result.offenders.concat(audit.checks[0].offenders)).slice(0, 2).map(function (o) { return o.value; }).join(', ') + '.';
      rows[1].ok = rows[1].ok && saved.ok;
      rows[1].detail = rows[1].ok
        ? 'Nothing is fetched from anywhere else. ' + saved.detail
        : (audit.checks[1].ok ? saved.detail : 'Something asks for a file from elsewhere.');
      rows[2].ok = rows[2].ok && unread.length === 0;
      rows[2].detail = rows[2].ok
        ? 'No libraries are listed or loaded. Read ' + files.length + ' of this book\'s own files to be sure.'
        : (unread.length > 0 ? unread.length + ' files could not be read, so this could not be proven.' : 'A library was found.');
      var jargon = E.findJargon(E.visibleText(document.body.innerHTML));
      rows[3].ok = rows[3].ok && jargon.length === 0;
      rows[3].detail = rows[3].ok
        ? 'No hard computer words on the page. A word list cannot judge plain speaking, only catch the usual suspects.'
        : 'Hard words found: ' + jargon.slice(0, 4).join(', ') + '.';
      $('audit-list').innerHTML = R.auditRows(rows);
      var all = rows.every(function (r) { return r.ok; });
      setStamp(all ? 'yes' : 'no');
      text($('check-note'), all ? 'Checked just now by reading this book\'s own files.' : 'Something needs fixing. See the list.');
    });
  }

  function setStamp(kind) {
    var title = kind === 'yes' ? 'All four kept' : (kind === 'no' ? 'Not yet' : 'Checking');
    var sub = kind === 'yes' ? 'checked just now' : (kind === 'no' ? 'see the list' : 'the four rules');
    ['stamp', 'hero-stamp'].forEach(function (id) {
      var el = $(id);
      if (el.getAttribute('data-state') !== kind) {
        el.removeAttribute('data-state');
        void el.offsetWidth;
      }
      el.setAttribute('data-state', kind);
      el.querySelector('.stamp-title').textContent = title;
      el.querySelector('.stamp-sub').textContent = sub;
    });
  }

  /* ---------- copies, paper, and the saved copy ---------- */

  function shareLink() {
    var note = $('link-note');
    var button = $('copy-link');
    return S.pack(state, E).then(function (packed) {
      var url = window.location.href.split('#')[0] + '#' + packed;
      $('link-box').value = url;
      var done = function (ok) {
        text(note, ok ? 'Copied. Paste it into a message or a note.' : 'Select the link below and copy it yourself.');
        if (ok) {
          button.setAttribute('data-state', 'done');
          window.setTimeout(function () { button.removeAttribute('data-state'); }, 2500);
        } else {
          $('link-box').select();
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
      } else {
        done(false);
      }
    });
  }

  function registerSavedCopy() {
    var note = $('saved-note');
    if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') {
      text(note, 'Open this book from its web address once to keep a copy on your device.');
      return;
    }
    navigator.serviceWorker.register('./sw.js').then(function () {
      return navigator.serviceWorker.ready;
    }).then(function () {
      return savedCopy();
    }).then(function (saved) {
      text(note, saved.ok ? 'A copy of this book is saved on your device. It works without internet.' :
        'Saving a copy on your device. This takes a moment.');
      if (saved.ok) runCheck();
    }).catch(function () {
      text(note, 'This device would not keep a saved copy of the book.');
    });
  }

  function watchTabs() {
    var tabs = document.querySelectorAll('.tabs a');
    if (!('IntersectionObserver' in window)) return;
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        tabs.forEach(function (tab) {
          if (tab.getAttribute('data-tab') === entry.target.id) tab.setAttribute('aria-current', 'true');
          else tab.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    ['kitchen', 'bills', 'care', 'check'].forEach(function (id) { seen.observe($(id)); });
  }

  /* ---------- starting up ---------- */

  function fillBoxes() {
    $('recipe-text').value = state.recipeText;
    $('servings-from').value = state.from;
    $('servings-to').value = state.to;
    $(state.scaleBy === 'pan' ? 'by-pan' : 'by-people').checked = true;
    [['pf', state.panFrom], ['pt', state.panTo]].forEach(function (pair) {
      $(pair[0] + '-shape').value = pair[1].shape;
      $(pair[0] + '-size').value = pair[1].size;
      $(pair[0] + '-width').value = pair[1].width;
      $(pair[0] + '-height').value = pair[1].height;
    });
    $('people-input').value = state.people;
  }

  function renderAll() {
    syncPanFields();
    renderPan();
    renderKitchen();
    renderPeopleControls();
    renderBills();
    syncCareFields();
    renderCare();
  }

  function listen() {
    $('recipe-text').addEventListener('input', function () { state.recipeText = this.value; save(); renderKitchen(); });
    $('servings-from').addEventListener('input', function () { state.from = Number(this.value); save(); renderKitchen(); });
    $('servings-to').addEventListener('input', function () { state.to = Number(this.value); save(); renderKitchen(); });
    document.querySelectorAll('input[name="scale-by"]').forEach(function (radio) {
      radio.addEventListener('change', function () { state.scaleBy = this.value; save(); renderKitchen(); });
    });
    [['pf', 'panFrom'], ['pt', 'panTo']].forEach(function (pair) {
      ['shape', 'size', 'width', 'height'].forEach(function (field) {
        $(pair[0] + '-' + field).addEventListener('input', function () {
          state[pair[1]][field] = this.value;
          save();
          syncPanFields();
          renderPan();
          renderKitchen();
        });
      });
    });
    $('use-pan-scale').addEventListener('click', function () {
      state.scaleBy = 'pan';
      $('by-pan').checked = true;
      save();
      renderKitchen();
      $('slip-title').scrollIntoView({ block: 'center' });
    });
    $('people-input').addEventListener('input', function () {
      state.people = this.value;
      save();
      renderPeopleControls();
      renderBills();
    });
    $('bill-form').addEventListener('submit', function (event) { event.preventDefault(); addSlip(); });
    $('expense-list').addEventListener('click', function (event) {
      var button = event.target.closest('[data-remove-slip]');
      if (!button) return;
      state.expenses.splice(Number(button.getAttribute('data-remove-slip')), 1);
      save();
      renderBills();
    });
    $('care-kind').addEventListener('change', syncCareFields);
    $('care-form').addEventListener('submit', function (event) { event.preventDefault(); addCare(); });
    $('care-items').addEventListener('click', function (event) {
      var button = event.target.closest('[data-remove-care]');
      if (!button) return;
      state.care.splice(Number(button.getAttribute('data-remove-care')), 1);
      save();
      renderCare();
    });
    $('print-button').addEventListener('click', function () { window.print(); });
    window.addEventListener('beforeprint', function () {
      text($('print-note'), 'Printed on ' + new Date().toLocaleDateString(undefined, { dateStyle: 'long' }) +
        ' from the Two-Crayon Kitchen & Bill Book.');
    });
    $('check-again').addEventListener('click', runCheck);
    $('copy-link').addEventListener('click', shareLink);
    window.addEventListener('online', function () { runCheck(); });
    window.addEventListener('offline', function () { runCheck(); });
  }

  function start() {
    loadSaved();
    var begin = function () {
      fillBoxes();
      renderAll();
      listen();
      watchTabs();
      registerSavedCopy();
      runCheck();
    };
    if (window.location.hash.length > 4) {
      S.unpack(window.location.hash, E).then(function (shared) {
        if (shared) adopt(shared);
        begin();
      });
    } else {
      begin();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
