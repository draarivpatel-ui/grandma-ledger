/* Turns the engine's answers into the little pieces of page the book shows:
   recipe lines, the pan picture, the settling-up diagram, the weekly card.
   Every function returns text for the page and puts people's words through esc()
   first. Colors come only from classes, never from written values. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.GrandmaRender = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function icon(name) {
    return '<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-' + name + '"></use></svg>';
  }

  function create(E) {
    function ingredientList(scaled) {
      return scaled.map(function (item) {
        var about = item.rounded && item.note === '' ? '<span class="about">about</span> ' : '';
        var exact = item.rounded && item.note === ''
          ? '<span class="exact">exactly ' + esc(item.exactText) + '</span>' : '';
        var note = item.note !== '' ? '<span class="exact">' + esc(item.note) + '</span>' : '';
        return '<li class="slip-row"><span class="amount">' + about + esc(item.text) + '</span>' +
          '<span class="what">' + esc(item.name) + '</span>' + exact + note + '</li>';
      }).join('');
    }

    function panSize(pan) {
      if (pan.shape === 'round') return String(pan.size) + ' inch round';
      return String(pan.width) + ' by ' + String(pan.height) + ' inch';
    }

    function panShape(pan, cx, cy, scale, className) {
      if (pan.shape === 'round') {
        var r = E.frNum(E.parseQuantity(pan.size)) / 2 * scale;
        return '<circle class="' + className + '" cx="' + cx + '" cy="' + cy + '" r="' + r.toFixed(1) + '"></circle>';
      }
      var w = E.frNum(E.parseQuantity(pan.width)) * scale;
      var h = E.frNum(E.parseQuantity(pan.height)) * scale;
      return '<rect class="' + className + '" x="' + (cx - w / 2).toFixed(1) + '" y="' + (cy - h / 2).toFixed(1) +
        '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '"></rect>';
    }

    function longest(pan) {
      if (pan.shape === 'round') return E.frNum(E.parseQuantity(pan.size));
      return Math.max(E.frNum(E.parseQuantity(pan.width)), E.frNum(E.parseQuantity(pan.height)));
    }

    /* Two pans drawn to the same scale, then the batter seen from the side. */
    function panFigure(fromPan, toPan, plan, idPrefix) {
      var p = idPrefix || 'pan';
      var scale = 190 / Math.max(longest(fromPan), longest(toPan));
      var depth = Math.min(E.frNum(plan.depthWithoutScaling), 1.6);
      var wall = 34;
      var batter = Math.max(4, wall * Math.min(1, depth));
      var rise = depth > 1 ? Math.min(14, (depth - 1) * wall) : 0;
      var same = E.frCmp(plan.areaRatio, E.fr(1)) === 0;
      var label = 'Two pans drawn to the same scale. The recipe is written for a ' + panSize(fromPan) +
        ' pan. You have a ' + panSize(toPan) + ' pan, which holds ' + E.formatMixed(plan.recipeFactor) +
        ' times as much.';
      var left = 120;
      var right = 360;

      function side(cx, height, extra) {
        return '<path class="fig-line" d="M' + (cx - 54) + ' 262 V300 H' + (cx + 54) + ' V262"></path>' +
          '<rect class="fig-batter" fill="url(#' + p + '-hatch)" x="' + (cx - 53) + '" y="' + (300 - height - extra).toFixed(1) +
          '" width="106" height="' + (height + extra).toFixed(1) + '"></rect>';
      }

      function words(cx, y, first, second) {
        return '<text class="fig-label" x="' + cx + '" y="' + y + '" text-anchor="middle">' + esc(first) + '</text>' +
          (second === '' ? '' : '<text class="fig-label" x="' + cx + '" y="' + (y + 20) + '" text-anchor="middle">' + esc(second) + '</text>');
      }

      return '<svg class="figure" viewBox="0 0 480 350" role="img" aria-label="' + esc(label) + '">' +
        '<defs><pattern id="' + p + '-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
        '<line x1="0" y1="0" x2="0" y2="7" class="hatch-line"></line></pattern></defs>' +
        '<g fill="url(#' + p + '-hatch)">' + panShape(fromPan, left, 128, scale, 'fig-pan') +
        panShape(toPan, right, 128, scale, 'fig-pan') + '</g>' +
        words(left, 20, 'Written for', 'this pan') +
        words(right, 20, 'You are baking', 'in this pan') +
        '<text class="fig-value" x="' + left + '" y="248" text-anchor="middle">' + esc(panSize(fromPan)) + '</text>' +
        '<text class="fig-value" x="' + right + '" y="248" text-anchor="middle">' + esc(panSize(toPan)) + '</text>' +
        side(left, wall, 0) + side(right, batter, rise) +
        words(left, 322, 'Batter as written', '') +
        words(right, 322, 'Same batter here', same ? 'same depth' : 'about ' + E.formatMixed(plan.depthWithoutScaling) + ' as deep') +
        '</svg>';
    }

    function settlementSentence(t) {
      return t.from + ' hands ' + t.to + ' ' + E.formatCents(t.cents);
    }

    function nodePosition(index, count) {
      if (count === 1) return { x: 260, y: 150 };
      var angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
      return { x: 260 + 188 * Math.cos(angle), y: 190 + 100 * Math.sin(angle) };
    }

    /* People around a table, arrows for the handoffs. */
    function settlementFigure(result, idPrefix) {
      var p = idPrefix || 'settle';
      var count = result.people.length;
      var spots = {};
      result.people.forEach(function (name, i) { spots[name] = nodePosition(i, count); });
      var radius = 30;
      var arrows = result.transfers.map(function (t) {
        var a = spots[t.from];
        var b = spots[t.to];
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var ux = dx / len;
        var uy = dy / len;
        var sx = a.x + ux * (radius + 4);
        var sy = a.y + uy * (radius + 4);
        var ex = b.x - ux * (radius + 12);
        var ey = b.y - uy * (radius + 12);
        var cx = (sx + ex) / 2 - uy * 30;
        var cy = (sy + ey) / 2 + ux * 30;
        var mx = 0.25 * sx + 0.5 * cx + 0.25 * ex;
        var my = 0.25 * sy + 0.5 * cy + 0.25 * ey;
        var text = E.formatCents(t.cents);
        var width = text.length * 11 + 18;
        return '<path class="fig-arrow" marker-end="url(#' + p + '-head)" d="M' + sx.toFixed(1) + ' ' + sy.toFixed(1) +
          ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + ex.toFixed(1) + ' ' + ey.toFixed(1) + '"></path>' +
          '<rect class="fig-plate" x="' + (mx - width / 2).toFixed(1) + '" y="' + (my - 15).toFixed(1) + '" width="' +
          width + '" height="30"></rect>' +
          '<text class="fig-money" x="' + mx.toFixed(1) + '" y="' + (my + 6).toFixed(1) + '" text-anchor="middle">' +
          esc(text) + '</text>';
      }).join('');
      var nodes = result.ledger.map(function (row) {
        var s = spots[row.name];
        var net = row.netCents === 0 ? 'square' : (row.netCents > 0 ? 'gets ' : 'gives ') + E.formatCents(Math.abs(row.netCents));
        var shortName = row.name.length > 12 ? row.name.slice(0, 11) + '.' : row.name;
        var above = count > 1 && s.y < 180;
        var nameY = above ? s.y - radius - 24 : s.y + radius + 18;
        var netY = above ? s.y - radius - 6 : s.y + radius + 36;
        return '<circle class="fig-node" cx="' + s.x.toFixed(1) + '" cy="' + s.y.toFixed(1) + '" r="' + radius + '"></circle>' +
          '<text class="fig-initial" x="' + s.x.toFixed(1) + '" y="' + (s.y + 9).toFixed(1) + '" text-anchor="middle">' +
          esc(row.name.charAt(0).toUpperCase()) + '</text>' +
          '<text class="fig-name" x="' + s.x.toFixed(1) + '" y="' + nameY.toFixed(1) + '" text-anchor="middle">' +
          esc(shortName) + '</text>' +
          '<text class="fig-net" x="' + s.x.toFixed(1) + '" y="' + netY.toFixed(1) + '" text-anchor="middle">' +
          esc(net) + '</text>';
      }).join('');
      var label = result.transfers.length === 0
        ? 'Diagram of the household. Everyone is square, so nobody hands anything over.'
        : 'Diagram of who hands what to whom. ' + result.transfers.map(settlementSentence).join('. ') + '.';
      return '<svg class="figure" viewBox="0 0 520 366" role="img" aria-label="' + esc(label) + '">' +
        '<defs><marker id="' + p + '-head" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto">' +
        '<path class="fig-head" d="M1 1 L11 6 L1 11 z"></path></marker></defs>' + arrows + nodes + '</svg>';
    }

    function settlementList(result) {
      if (result.transfers.length === 0) {
        return '<li class="handoff handoff-square">Everyone is square. Nobody hands anything over.</li>';
      }
      return result.transfers.map(function (t) {
        return '<li class="handoff"><span class="handoff-line"><strong>' + esc(t.from) + '</strong> hands <strong>' +
          esc(t.to) + '</strong> <span class="money">' + esc(E.formatCents(t.cents)) + '</span></span>' +
          '<span class="handoff-pieces">In cash that is ' + esc(E.describeHandoff(t.cents)) + '. A check works too.</span></li>';
      }).join('');
    }

    function ledgerTable(result) {
      var rows = result.ledger.map(function (row) {
        var net = row.netCents === 0 ? 'square' : (row.netCents > 0 ? 'gets ' : 'gives ') + E.formatCents(Math.abs(row.netCents));
        return '<tr><th scope="row">' + esc(row.name) + '</th><td>' + esc(E.formatCents(row.paidCents)) + '</td><td>' +
          esc(E.formatCents(row.owedCents)) + '</td><td>' + esc(net) + '</td></tr>';
      }).join('');
      return '<table class="ledger"><caption>Who paid and who shares, in dollars and cents</caption>' +
        '<thead><tr><th scope="col">Name</th><th scope="col">Paid</th><th scope="col">Share</th><th scope="col">End result</th></tr></thead>' +
        '<tbody>' + rows + '</tbody><tfoot><tr><th scope="row">All slips</th><td>' + esc(E.formatCents(result.totalCents)) +
        '</td><td>' + esc(E.formatCents(result.totalCents)) + '</td><td>' + result.handoffs +
        (result.handoffs === 1 ? ' handoff' : ' handoffs') + '</td></tr></tfoot></table>';
    }

    var KIND_ICON = { medicine: 'pill', plant: 'leaf', pantry: 'jar' };
    var SLOT_TITLE = { morning: 'Morning', noon: 'Noon', evening: 'Evening', sundayCheck: 'Sunday check' };

    function careCard(card) {
      return card.days.map(function (day) {
        var parts = ['morning', 'noon', 'evening', 'sundayCheck'].map(function (slot) {
          var entries = day[slot];
          if (entries.length === 0) return '';
          return '<div class="care-slot"><h4>' + SLOT_TITLE[slot] + '</h4><ul>' + entries.map(function (e) {
            return '<li><span class="box" aria-hidden="true"></span>' + icon(KIND_ICON[e.kind]) + '<span>' + esc(e.label) + '</span></li>';
          }).join('') + '</ul></div>';
        }).join('');
        if (parts === '') parts = '<p class="care-empty">Nothing due.</p>';
        return '<section class="care-day" aria-labelledby="day-' + day.index + '"><h3 id="day-' + day.index + '">' +
          esc(day.name) + '</h3>' + parts + '</section>';
      }).join('');
    }

    function describeSchedule(item) {
      if (item.kind === 'pantry') return 'Sunday check';
      var times = (item.slots && item.slots.length > 0 ? item.slots : ['morning']).join(' and ');
      if (item.kind === 'plant' && item.everyDays > 1) return 'water every ' + item.everyDays + ' days, ' + times;
      return 'every day, ' + times;
    }

    function careItemList(items) {
      if (items.length === 0) return '<li class="care-none">Nothing on the card yet. Add the first thing above.</li>';
      return items.map(function (item, index) {
        var kind = item.kind === 'pantry' ? 'Pantry shelf' : (item.kind === 'plant' ? 'Plant' : 'Medicine');
        var name = item.dose ? item.name + ', ' + item.dose : item.name;
        return '<li class="care-item">' + icon(KIND_ICON[item.kind]) + '<span><strong>' + esc(name) + '</strong> ' +
          esc(kind + ', ' + describeSchedule(item) + '.') + '</span>' +
          '<button type="button" class="btn small" data-remove-care="' + index + '" aria-label="Take ' + esc(item.name) +
          ' off the card">' + icon('x') + '<span class="btn-text">Remove</span></button></li>';
      }).join('');
    }

    function expenseList(expenses) {
      if (expenses.length === 0) return '<li class="care-none">No slips yet. Add the first one above.</li>';
      return expenses.map(function (e, index) {
        var who = e.sharedBy && e.sharedBy.length > 0 ? 'shared by ' + e.sharedBy.join(', ') : 'shared by everyone';
        return '<li class="care-item">' + icon('coin') + '<span><strong>' + esc(e.label || 'A slip') + '</strong> ' +
          esc(e.amount + ', paid by ' + e.payer + ', ' + who + '.') + '</span>' +
          '<button type="button" class="btn small" data-remove-slip="' + index + '" aria-label="Take the slip ' + esc(e.label || 'A slip') +
          ' off the list">' + icon('x') + '<span class="btn-text">Remove</span></button></li>';
      }).join('');
    }

    function auditRows(rows) {
      return rows.map(function (row) {
        var state = row.ok === null ? 'wait' : (row.ok ? 'yes' : 'no');
        var mark = state === 'yes' ? icon('check') : (state === 'no' ? icon('x') : icon('spoon'));
        return '<li class="audit-row" data-state="' + state + '">' + mark + '<div><strong>' + esc(row.label) + '</strong>' +
          '<span>' + esc(row.detail) + '</span></div></li>';
      }).join('');
    }

    return {
      esc: esc,
      ingredientList: ingredientList,
      panFigure: panFigure,
      settlementFigure: settlementFigure,
      settlementList: settlementList,
      settlementSentence: settlementSentence,
      ledgerTable: ledgerTable,
      careCard: careCard,
      careItemList: careItemList,
      expenseList: expenseList,
      describeSchedule: describeSchedule,
      auditRows: auditRows,
      panSize: panSize
    };
  }

  return { create: create, esc: esc, icon: icon };
});
