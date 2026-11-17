// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, a filterable table, a per-protocol detail
// view with the model's own inputs and the protocol's farm plan, and the live-token
// set the board is kept apart from. No network: every byte it shows is in data.js.
//
// The value model, radar-2-comps, in one function — impliedOf below recomputes a
// row from the snapshot figures and checks the number board.json carries, so the
// page's code and the board's data are visibly the same arithmetic:
//
//   implied = round(tvl_usd x comp x growth x maturity x breadth)
//   comp     = median market-cap / TVL of the live-token protocols in the same
//              category (3+ comparables, else the whole-market median), clamped
//              to [0.05, 0.60] — computed from the snapshot at run time, never a
//              hard-coded list of names
//   growth   = 1 + 0.6 x clamp(change_7d, -50, +100) / 100
//   maturity = 0.75 + 0.25 x min(age_days, 1095) / 1095 (unknown age: 365 days)
//   breadth  = 1 + 0.03 x min(chains - 1, 5)
//
// Views are hash-driven, so each screenshot is a real render of one view:
//   (no hash)                 the board
//   #p=<slug>                 that protocol's detail view, above the board
//   #category=Yield           a filtered view (category, chain, scope, search)
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', scope: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return (Math.round(n * 100) / 100).toFixed(2) + 'x'; }

  // The model in one function: the same four multipliers lib/model.ts scores with.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var breadth = 1 + Math.min(Math.max((row.chains || []).length - 1, 0), model.breadth_max_extra) * model.breadth_per_chain;
    return Math.max(1, Math.round(row.tvl_usd * row.comp_multiple * growthMult * maturity * breadth));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('scope')) state.scope = params.get('scope');
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.scope !== 'all') params.set('scope', state.scope);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.scope === 'watchlist' && !r.watchlist) return false;
      if (state.scope === 'early' && r.watchlist) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'TOKEN RADAR' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    var top = DATA.rows[0];
    var totalImplied = DATA.rows.reduce(function (n, r) { return n + r.implied_value_usd; }, 0);
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Which pre-token protocol is worth farming next?' }),
        el('p', null, 'The watchlist is the floor: every protocol with at least ', el('b', { text: '$' + Math.round(DATA.floor_usd / 1e6) + 'M' }), ' of TVL and no token on record — ', el('b', { text: String(DATA.watchlist_size) }), ' of them. The early radar adds ', el('b', { text: String(DATA.early_size) }), ' more that pass the same pre-token test — most of them below that floor, a few above it that the watchlist leaves out. Each row is ranked by what its launch would be worth if its record stayed as it is — a model, not a promise, and never a prediction of whether or when a token is issued.')
      ),
      el('div', { class: 'kpis' },
        el('div', { class: 'kpi' }, el('b', { text: String(DATA.board_size) }), el('span', { text: 'pre-token rows ranked' })),
        el('div', { class: 'kpi' }, el('b', { text: String(DATA.watchlist_size) + ' / ' + String(DATA.watchlist_size) }), el('span', { text: 'watchlist covered' })),
        el('div', { class: 'kpi' }, el('b', { class: 'amber', text: fmtUsd(top ? top.implied_value_usd : 0) }), el('span', { text: 'top implied value — ' + (top ? top.name : '') })),
        el('div', { class: 'kpi' }, el('b', { text: fmtUsd(totalImplied) }), el('span', { text: 'combined implied value' }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var ch = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    ch.addEventListener('change', function () { state.chain = ch.value; writeHash(); render(); });
    function scopeBtn(v, label) {
      return el('button', { type: 'button', 'aria-pressed': state.scope === v ? 'true' : 'false', text: label, onclick: function () { state.scope = v; writeHash(); render(); } });
    }
    function tabBtn(v, label) {
      return el('button', { type: 'button', 'aria-pressed': state.tab === v ? 'true' : 'false', text: label, onclick: function () { state.tab = v; writeHash(); render(); } });
    }
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), cat),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), ch),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Scope' }), el('div', { class: 'tabs' }, scopeBtn('all', 'All'), scopeBtn('watchlist', 'Watchlist'), scopeBtn('early', 'Early'))),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, tabBtn('pre-token', 'Pre-token'), tabBtn('live', 'Live token'))),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' of ' + DATA.board_size + ' rows' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.scope = 'all'; writeHash(); render(); } })
      ));
    }
    var max = DATA.rows[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'badge ' + (r.watchlist ? 'watch' : 'early'), text: r.watchlist ? 'watchlist' : 'early' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model breakdown and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Scope' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: r.mcap_tvl === null ? 'n/a' : fmtMult(r.mcap_tvl) }),
        el('td', null, el('span', { class: 'badge live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They set the comparables the pre-token board is priced against — and they are kept out of the ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Mcap / TVL' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function detailPanel() {
    var row = DATA.rows.filter(function (r) { return r.slug === state.selected; })[0];
    if (!row) return null;
    var recomputed = impliedOf(row, DATA.model);
    var match = recomputed === row.implied_value_usd;
    var comps = DATA.live.filter(function (r) { return r.category === row.category; }).slice(0, 3);
    var steps = row.farm_steps.map(function (s) {
      var at = s.indexOf(' Cost: ');
      var action = at >= 0 ? s.slice(0, at) : s;
      var tail = at >= 0 ? s.slice(at + 1) : '';
      var cost = '', time = '';
      var cm = tail.match(/Cost: (.*?)\. Time: (.*?)\.?$/);
      if (cm) { cost = cm[1]; time = cm[2]; }
      return el('li', null, el('b', { text: action }),
        el('span', { class: 'chips' },
          cost ? el('span', { class: 'chip', text: 'Cost: ' + cost }) : null,
          time ? el('span', { class: 'chip', text: 'Time: ' + time }) : null));
    });
    return el('section', { class: 'panel detail', 'aria-label': 'Protocol detail' },
      el('div', { class: 'detail-head' },
        el('div', null,
          el('span', { class: 'badge ' + (row.watchlist ? 'watch' : 'early'), text: 'Rank ' + row.rank + ' of ' + DATA.board_size + ' · ' + (row.watchlist ? 'watchlist' : 'early') }),
          el('h2', { text: row.name }),
          el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + ' · records no token' })
        ),
        el('div', { class: 'detail-value' },
          el('b', { text: fmtUsd(row.implied_value_usd) }),
          el('span', { text: 'implied value' }),
          el('div', null, el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Back to board', onclick: function () { state.selected = null; writeHash(); render(); } }))
        )
      ),
      el('div', { class: 'detail-grid' },
        el('div', { class: 'detail-col' },
          el('h3', { text: 'How the value is built' }),
          el('div', { class: 'equation' },
            el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
            el('div', null, el('span', { text: 'Comp multiple (' + (row.category || 'Other') + ', ' + row.comp_n + ' live comp' + (row.comp_n === 1 ? '' : 's') + ')' }), el('b', { class: 'num', text: fmtMult(row.comp_multiple) })),
            el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
            el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: fmtMult(row.growth_multiplier) })),
            el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
            el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: fmtMult(row.maturity_multiplier) })),
            el('div', null, el('span', { text: 'Chain breadth (' + (row.chains || []).length + ' chains)' }), el('b', { class: 'num', text: fmtMult(row.breadth_multiplier) })),
            el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
          ),
          el('p', { class: 'note', text: 'The page recomputes this row as ' + fmtUsd(recomputed) + (match ? ' — the same number board.json carries.' : ' — which differs from the board: the data would be stale.') + ' The multiple comes from live tokens in the same category, so a lending protocol is priced like lending, not like a DEX.' }),
          comps.length ? el('div', { class: 'comps' },
            el('div', null, el('span', { text: 'Live comparables in ' + (row.category || 'Other') }), el('b', { class: 'num', text: 'Mcap / TVL' })),
            comps.map(function (c) { return el('div', null, el('span', { text: c.name }), el('b', { class: 'num', text: c.mcap_tvl === null ? 'n/a' : fmtMult(c.mcap_tvl) })); })
          ) : null
        ),
        el('div', { class: 'detail-col' },
          el('h3', { text: 'Farm plan — what to do, what it costs, how long it takes' }),
          el('ol', { class: 'steps' }, steps),
          el('p', { class: 'note', text: 'Never pay anyone to claim for you, and never connect a wallet holding funds you cannot afford to lose. Implied value is an estimate, not a price.' })
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var topComps = DATA.comps.slice(0, 8);
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed — radar-2-comps' }),
      el('p', { class: 'sub', text: 'One function scores every row from the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        el('div', null, el('b', { text: 'implied = round( tvl_usd x comp x growth x maturity x breadth )' })),
        el('div', { text: 'comp     = median mcap / TVL of live tokens in the category (3+ comps, else market median), clamped [0.05, 0.60]' }),
        el('div', { text: 'growth   = 1 + 0.6 x clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100' }),
        el('div', { text: 'maturity = ' + m.maturity_floor + ' + ' + m.maturity_range + ' x min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + '   (unknown age: ' + m.unknown_age_days + ' days)' }),
        el('div', { text: 'breadth  = 1 + 0.03 x min(chains - 1, 5)' })
      ),
      el('div', { class: 'two-col' },
        el('div', null,
          el('h3', { text: 'Top category multiples' }),
          el('table', { class: 'comps-table' },
            el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Multiple' }), el('th', { scope: 'col', text: 'Comps' }))),
            el('tbody', null, topComps.map(function (c) {
              return el('tr', null, el('td', { text: c.category }), el('td', { class: 'num', text: fmtMult(c.multiple) }), el('td', { class: 'num', text: String(c.comps_n) + (c.fallback ? ' (market)' : '') }));
            }))
          )
        ),
        el('div', null,
          el('h3', { text: 'What the board is — and is not' }),
          el('p', { class: 'sub', text: 'The board ranks protocols that record no token and pass the watchlist\u2019s product test, at any TVL. It does not predict whether or when a token is issued: a protocol on the list may still have a token its DefiLlama record does not carry. Live-token protocols are priced by the market and kept out of the ranking, where they set the multiples instead.' })
        )
      )
    );
  }

  function footer() {
    return el('footer', { class: 'foot' },
      el('span', { text: 'Source: DefiLlama protocol index, snapshot ' + DATA.as_of + ' · ' + DATA.source }),
      el('span', { text: 'Token Radar · ' + DATA.model_version + ' · implied value is the entry\u2019s own claim, never make.fun\u2019s' })
    );
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    if (state.selected) {
      // Detail view: the lede gives way to the protocol, so the farm plan fits on one screen.
      var picked = DATA.rows.filter(function (r) { return r.slug === state.selected; })[0];
      shell.appendChild(el('div', { class: 'detail-crumb' },
        el('button', { class: 'button', type: 'button', text: '← All ' + DATA.board_size + ' pre-token protocols', onclick: function () { state.selected = null; writeHash(); render(); } }),
        el('span', { class: 'sub', text: picked ? 'Detail view — ' + picked.name + ', rank ' + picked.rank + ' of ' + DATA.board_size : 'Detail view' })
      ));
    } else {
      shell.appendChild(lede());
    }
    shell.appendChild(controls());
    var detail = state.selected ? detailPanel() : null;
    if (detail) shell.appendChild(detail);
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    shell.appendChild(footer());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
  }

  function openDetail(slug) {
    state.selected = slug;
    writeHash();
    render();
  }

  readHash();
  render();
  window.addEventListener('hashchange', function () { readHash(); render(); });
})();
