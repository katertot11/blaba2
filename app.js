/* BLABA2 Tracker — all data stays on this device (localStorage). */
(function () {
  'use strict';

  var STORE_KEY = 'blaba2.tracker.v1';
  var PROGRAM = window.ProgramParser.parseProgram(window.PROGRAM_SOURCE);
  var ORDER = [];
  PROGRAM.weeks.forEach(function (w, wi) { w.days.forEach(function (d, di) { ORDER.push(wi + '-' + di); }); });

  // Exercises that use % of a 1RM
  var PCT_LIFTS = [];
  PROGRAM.weeks.forEach(function (w) { w.days.forEach(function (d) { d.exercises.forEach(function (e) {
    if (e.sets.some(function (s) { return s.pct; }) && PCT_LIFTS.indexOf(e.name) < 0) PCT_LIFTS.push(e.name);
  }); }); });

  // ---------- state ----------
  function defaultState() {
    var maxes = {}; PCT_LIFTS.forEach(function (n) { maxes[n] = ''; });
    return { v: 1, settings: { maxes: maxes, round: 5 }, logs: {}, timers: {}, lastBackup: null };
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      var s = JSON.parse(raw), d = defaultState();
      s.settings = Object.assign(d.settings, s.settings || {});
      s.settings.maxes = Object.assign(d.settings.maxes, (s.settings && s.settings.maxes) || {});
      s.logs = s.logs || {}; s.timers = s.timers || {};
      return s;
    } catch (e) { console.error(e); return defaultState(); }
  }
  var state = load();
  var savedTimer;
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      var el = document.getElementById('saved');
      el.textContent = 'Saved ✓'; el.classList.add('on');
      clearTimeout(savedTimer); savedTimer = setTimeout(function () { el.classList.remove('on'); }, 1200);
    } catch (e) { toast('Could not save: ' + e.message); }
  }
  if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(function () {}); }

  // ---------- helpers ----------
  function $(sel, el) { return (el || document).querySelector(sel); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function fmtW(n) { return (Math.round(n * 100) / 100).toString(); }
  function fmtT(sec) { sec = Math.round(sec); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function fmtDur(sec) { return sec <= 120 ? sec + 's' : fmtT(sec); }
  function parseT(str) {
    str = String(str || '').trim(); if (!str) return null;
    if (str.indexOf(':') >= 0) { var p = str.split(':'); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); }
    var d = str.replace(/\D/g, ''); if (!d) return null;
    if (d.length <= 2) return parseInt(d, 10);
    return parseInt(d.slice(0, -2), 10) * 60 + parseInt(d.slice(-2), 10);
  }
  function fmtDate(ts) { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  function wd(key) { var p = key.split('-'); return { wi: +p[0], di: +p[1], week: PROGRAM.weeks[+p[0]], day: PROGRAM.weeks[+p[0]].days[+p[1]] }; }
  function shortName(key) { var x = wd(key); return 'Wk ' + (x.wi + 1) + ' · D' + (x.di + 1); }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2200); }

  function getLog(key, create) {
    var l = state.logs[key];
    if (!l && create) l = state.logs[key] = { started: Date.now(), updated: Date.now(), completed: null, notes: '', ex: {} };
    return l;
  }
  function getExLog(key, ei, name, create) {
    var l = getLog(key, create); if (!l) return null;
    var e = l.ex[ei];
    if (!e && create) e = l.ex[ei] = { name: name, sets: [], updated: Date.now() };
    return e;
  }
  function hasData(s) { return s && (s.d || (s.r !== '' && s.r != null) || s.t != null); }
  function status(key) {
    var l = state.logs[key]; if (!l) return 'none';
    if (l.completed) return 'done';
    var any = Object.keys(l.ex).some(function (k) { return l.ex[k].sets.some(hasData); });
    return any ? 'prog' : 'none';
  }
  function nextKey() { for (var i = 0; i < ORDER.length; i++) if (!(state.logs[ORDER[i]] && state.logs[ORDER[i]].completed)) return ORDER[i]; return null; }

  // Most recent other workout where this exercise was logged
  function lastTime(name, excludeKey) {
    var best = null;
    Object.keys(state.logs).forEach(function (k) {
      if (k === excludeKey) return;
      var l = state.logs[k];
      Object.keys(l.ex).forEach(function (ei) {
        var e = l.ex[ei];
        if (e.name !== name || !e.sets.some(hasData)) return;
        if (!best || e.updated > best.updated) best = { key: k, updated: e.updated, sets: e.sets };
      });
    });
    return best;
  }
  function setSummary(s) {
    if (!hasData(s)) return null;
    if (s.t != null) return (s.w ? s.w + ' lb · ' : '') + fmtT(s.t);
    if (s.r === '' || s.r == null) return '✓';
    return (s.w !== '' && s.w != null ? s.w : 'BW') + '×' + s.r;
  }

  function suggestedWeight(ex, set, i, last) {
    if (set.pct) {
      var max = num(state.settings.maxes[ex.name]);
      if (max) { var inc = num(state.settings.round) || 5; return fmtW(Math.round(max * set.pct / 100 / inc) * inc); }
    }
    if (last && last.sets[i] && last.sets[i].w !== '' && last.sets[i].w != null) return String(last.sets[i].w);
    if (ex.dropSet && i % 3 !== 0) return '';
    if (set.weight != null && set.weight > 0) return fmtW(set.weight);
    return '';
  }

  // ---------- views ----------
  var app = $('#app');
  function setHeader(title, back) {
    $('#title').textContent = title;
    $('#backBtn').hidden = !back;
  }

  function renderHome() {
    setHeader(PROGRAM.name, false);
    var nk = nextKey();
    var done = ORDER.filter(function (k) { return status(k) === 'done'; }).length;
    var h = '';
    if (nk) {
      var x = wd(nk), st = status(nk);
      h += '<div class="card next"><div class="kicker">' + (st === 'prog' ? 'In progress' : 'Next workout') + '</div>' +
        '<div class="big">' + esc(x.week.name) + '</div><div>' + esc(x.day.name) + '</div>' +
        '<div class="muted small" style="margin:6px 0 12px">' + x.day.exercises.length + ' exercises · ' + done + ' of ' + ORDER.length + ' workouts done</div>' +
        '<a class="btn primary block" href="#/w/' + nk + '" id="openNext">' + (st === 'prog' ? 'Resume workout' : 'Open workout') + '</a></div>';
    } else {
      h += '<div class="card next"><div class="kicker">Program complete</div><div class="big">All 36 workouts done 🎉</div></div>';
    }
    var missing = PCT_LIFTS.filter(function (n) { return !num(state.settings.maxes[n]); });
    if (missing.length) h += '<div class="card warnbox small">Enter your 1RM for ' + esc(missing.join(' and ')) +
      ' in <a href="#/settings" style="color:var(--accent)">Settings</a> to see percentage weights.</div>';
    var anyLogs = Object.keys(state.logs).length > 0;
    var days = state.lastBackup ? Math.floor((Date.now() - state.lastBackup) / 864e5) : null;
    if (anyLogs && (days === null || days >= 7)) h += '<div class="card warnbox small">' +
      (days === null ? 'You haven’t made a backup yet.' : 'Last backup was ' + days + ' days ago.') +
      ' <a href="#/settings" style="color:var(--accent)">Back up now</a></div>';

    h += '<h2>All weeks</h2>';
    PROGRAM.weeks.forEach(function (w, wi) {
      var keys = w.days.map(function (_, di) { return wi + '-' + di; });
      var nDone = keys.filter(function (k) { return status(k) === 'done'; }).length;
      var open = nk && nk.split('-')[0] == wi;
      h += '<details class="week"' + (open ? ' open' : '') + '><summary><span>' + esc(w.name) + '</span><span class="muted small">' + nDone + '/3</span></summary>';
      w.days.forEach(function (d, di) {
        var k = wi + '-' + di, s = status(k), l = state.logs[k];
        var icon = s === 'done' ? '<span class="st done-c">✓</span>' : s === 'prog' ? '<span class="st prog-c">●</span>' : '<span class="st muted">○</span>';
        h += '<a class="day-link" href="#/w/' + k + '">' + icon + '<span style="flex:1">' + esc(d.name) + '</span>' +
          (l && l.completed ? '<span class="muted small">' + fmtDate(l.completed) + '</span>' : '') + '<span class="muted">›</span></a>';
      });
      h += '</details>';
    });
    app.innerHTML = h;
  }

  function setRow(key, ei, ex, set, si, logSet, last, isExtra) {
    var kind = set.kind;
    var cls = 'set' + (logSet && logSet.d ? ' done' : '');
    var showW = kind !== 'check' && !(set.weight === 0 && kind === 'timed');
    if (kind === 'check') cls += ' chk';
    else if (kind === 'timed' && !showW) cls += ' nw';
    var main, sub = [];
    if (kind === 'check') main = esc(set.label || 'Round');
    else if (kind === 'timed') {
      if (set.timed.open) main = set.reps > 1 ? set.reps + ' reps for time' : (set.timed.dur > 1 ? fmtDur(set.timed.dur) + '+' : 'For time');
      else main = fmtDur(set.timed.dur) + (set.timed.rest ? ' on / ' + fmtDur(set.timed.rest) + ' off' : '');
    } else {
      main = set.amrap ? (set.reps > 1 ? set.reps + '+ reps' : 'Max reps') : set.reps + ' reps';
      if (set.pct) main += ' <span class="pct">@ ' + set.pct + '%</span>';
    }
    var sug = suggestedWeight(ex, set, si, last);
    var lbl = isExtra ? 'Extra set' : (set.label && kind !== 'check' ? set.label : (kind === 'check' ? '' : 'Set ' + (si + 1)));
    if (lbl) sub.push(esc(lbl));
    if (set.pct) sub.push(num(state.settings.maxes[ex.name]) ? '≈' + suggestedWeight(ex, { pct: set.pct }, -1, null) + ' lb' : 'set 1RM');
    else if (set.weight > 0) sub.push(fmtW(set.weight) + ' lb');
    if (set.amrap && set.reps > 1) sub.push('as many as possible');
    if (set.rest) sub.push('rest ' + fmtDur(set.rest));
    var ls = logSet || {};
    var id = key + '|' + ei + '|' + si;
    var h = '<div class="' + cls + '" data-k="' + key + '" data-e="' + ei + '" data-s="' + si + '">' +
      '<div class="tgt"><span class="main">' + main + '</span>' + (sub.length ? '<span class="sub">' + sub.join(' · ') + '</span>' : '') + '</div>';
    if (showW) h += '<div><span class="lbl">lb</span><input data-f="w" inputmode="decimal" enterkeyhint="next" value="' + esc(ls.w || '') + '" placeholder="' +
      esc(sug || (set.weight === 0 ? 'BW' : '–')) + '" aria-label="Weight"></div>';
    if (kind === 'reps') h += '<div><span class="lbl">reps</span><input data-f="r" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" value="' + esc(ls.r != null ? ls.r : '') +
      '" placeholder="' + (set.amrap ? (set.reps > 1 ? set.reps + '+' : 'max') : set.reps) + '" aria-label="Reps"></div>';
    if (kind === 'timed') {
      var running = state.timers[id];
      h += '<div><span class="lbl">time</span><div class="time-wrap"><input data-f="t" inputmode="numeric" pattern="[0-9]*" value="' +
        (ls.t != null ? fmtT(ls.t) : '') + '" placeholder="' + (set.timed.open ? 'm:ss' : fmtT(set.timed.dur)) + '" aria-label="Time"' +
        (running ? ' data-sw="' + running + '" readonly' : '') + '>' +
        (set.timed.open ? '<button class="sw-btn' + (running ? ' run' : '') + '" data-act="sw" aria-label="Stopwatch">' + (running ? '■' : '▶') + '</button>' : '') +
        '</div></div>';
    }
    h += '<button class="chk-btn" data-act="done" aria-label="Mark set done">✓</button></div>';
    return h;
  }

  function renderWorkout(key) {
    var x = wd(key);
    if (!x.week) return renderHome();
    setHeader(x.week.name + ' · ' + x.day.name.replace(/^Day (\d+) - /, 'D$1 '), true);
    var log = state.logs[key];
    var h = '<div class="muted small" style="margin:0 4px 10px">' + esc(x.day.name) +
      (log && log.completed ? ' · <span class="done-c">Completed ' + fmtDate(log.completed) + '</span>' : '') + '</div>';
    x.day.exercises.forEach(function (ex, ei) {
      var el = log && log.ex[ei];
      var last = lastTime(ex.name, key);
      var badges = [];
      if (ex.superset) badges.push('<span class="badge ss">Superset ' + esc(ex.superset) + '</span>');
      if (ex.dropSet) badges.push('<span class="badge">Drop set</span>');
      if (ex.ladder) badges.push('<span class="badge">Ladder</span>');
      if (ex.sets.some(function (s) { return s.label && /^round/i.test(s.label); }) && !ex.dropSet) badges.push('<span class="badge">Circuit</span>');
      h += '<section class="ex' + (ex.superset ? ' ss' : '') + '" id="ex-' + ei + '"><div class="ex-head"><div class="ex-name">' + esc(ex.name) + '</div><div class="row-gap">' + badges.join('') + '</div></div>';
      if (ex.note) h += '<div class="note">' + esc(ex.note.replace(/ in Liftosaur/g, ' in Settings (⚙)')) + '</div>';
      if (last) {
        var parts = last.sets.map(setSummary).filter(Boolean);
        h += '<div class="last"><span class="muted">Last time (' + shortName(last.key) + ', ' + fmtDate(last.updated) + '):</span> <b>' + esc(parts.join(', ')) + '</b></div>';
      }
      ex.sets.forEach(function (set, si) { h += setRow(key, ei, ex, set, si, el && el.sets[si], last, false); });
      var extras = el ? el.sets.length - ex.sets.length : 0;
      for (var j = 0; j < extras; j++) {
        var tmpl = Object.assign({}, ex.sets[ex.sets.length - 1], { label: null });
        h += setRow(key, ei, ex, tmpl, ex.sets.length + j, el.sets[ex.sets.length + j], last, true);
      }
      h += '<div class="ex-foot"><button class="btn ghost" data-act="add" data-e="' + ei + '">+ Add set</button>' +
        (extras > 0 ? '<button class="btn ghost" data-act="rm" data-e="' + ei + '">Remove added set</button>' : '') + '</div></section>';
    });
    h += '<div class="card"><div class="muted small" style="margin-bottom:6px">Workout notes</div><textarea id="notes" placeholder="How did it feel? Substitutions?">' +
      esc(log ? log.notes : '') + '</textarea></div>';
    if (log && log.completed) h += '<button class="btn block ghost" data-act="reopen">Mark as not finished</button>';
    else h += '<button class="btn block good" data-act="finish">Finish workout</button>';
    app.innerHTML = h;
    app.dataset.key = key;
  }

  function renderSettings() {
    setHeader('Settings & backup', true);
    var h = '<h2>One-rep maxes (lb)</h2><div class="card">';
    PCT_LIFTS.forEach(function (n) {
      h += '<label class="field"><span>' + esc(n) + (n === 'Squat' ? ' <span class="muted small">(or deadlift)</span>' : '') +
        '</span><input data-max="' + esc(n) + '" inputmode="decimal" value="' + esc(state.settings.maxes[n]) + '" placeholder="e.g. 225"></label>';
    });
    h += '<label class="field"><span>Round % weights to</span><select id="round">' + [2.5, 5, 10].map(function (v) {
      return '<option value="' + v + '"' + (num(state.settings.round) === v ? ' selected' : '') + '>' + v + ' lb</option>'; }).join('') + '</select></label></div>';

    h += '<h2>Backup &amp; restore</h2><div class="card"><p class="small muted" style="margin-top:0">Your log lives only on this phone. Save a backup file to Files/iCloud Drive regularly.' +
      (state.lastBackup ? ' Last backup: ' + fmtDate(state.lastBackup) + '.' : ' No backup yet.') + '</p>' +
      '<div class="row-gap"><button class="btn primary" data-act="backup">Save backup file</button>' +
      '<button class="btn" data-act="copy">Copy backup text</button></div>' +
      '<div style="margin-top:14px" class="small muted">Restore from a backup file:</div>' +
      '<input type="file" id="restoreFile" accept="application/json,.json,text/plain" style="margin-top:6px;max-width:100%">' +
      '<div style="margin-top:14px" class="small muted">…or paste backup text:</div><textarea id="restoreText" placeholder="Paste backup JSON here"></textarea>' +
      '<button class="btn" style="margin-top:8px" data-act="restoreText">Restore pasted text</button></div>';

    h += '<h2>Storage</h2><div class="card small muted" id="storageInfo">For the most reliable saving, use Safari → Share → <b>Add to Home Screen</b> and open the app from that icon.</div>';
    h += '<button class="btn block danger" data-act="reset">Erase all logged data</button>';
    app.innerHTML = h;
    if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(function (p) {
      var el = $('#storageInfo'); if (el && p) el.insertAdjacentHTML('afterbegin', '<div class="done-c" style="margin-bottom:6px">✓ Persistent storage granted</div>');
    }).catch(function () {});
  }

  function route() {
    var h = location.hash || '#/';
    var m = h.match(/^#\/w\/(\d+-\d+)/);
    if (m) renderWorkout(m[1]);
    else if (h.indexOf('#/settings') === 0) renderSettings();
    else renderHome();
    window.scrollTo(0, 0);
  }

  // ---------- events ----------
  function rowInfo(el) {
    var row = el.closest('.set'); if (!row) return null;
    var key = row.dataset.k, ei = +row.dataset.e, si = +row.dataset.s;
    var ex = wd(key).day.exercises[ei];
    return { row: row, key: key, ei: ei, si: si, ex: ex, set: ex.sets[si] || Object.assign({}, ex.sets[ex.sets.length - 1]) };
  }
  function ensureSet(info) {
    var e = getExLog(info.key, info.ei, info.ex.name, true);
    while (e.sets.length <= info.si) e.sets.push({ w: '', r: '', t: null, d: false });
    return e;
  }
  function touch(key, e) { e.updated = Date.now(); state.logs[key].updated = Date.now(); }

  app.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.id === 'notes') { var l = getLog(app.dataset.key, true); l.notes = t.value; l.updated = Date.now(); save(); return; }
    if (t.dataset.max != null) { state.settings.maxes[t.dataset.max] = t.value.trim(); save(); return; }
    var f = t.dataset.f; if (!f) return;
    var info = rowInfo(t); if (!info) return;
    var e = ensureSet(info), s = e.sets[info.si];
    if (f === 't') s.t = parseT(t.value); else s[f] = t.value.trim();
    touch(info.key, e); save();
  });
  app.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'round') { state.settings.round = num(t.value); save(); }
    if (t.id === 'restoreFile' && t.files[0]) {
      var r = new FileReader();
      r.onload = function () { doRestore(r.result); t.value = ''; };
      r.readAsText(t.files[0]);
    }
  });
  app.addEventListener('focusout', function (ev) {
    var t = ev.target;
    if (t.dataset && t.dataset.f === 't') { var v = parseT(t.value); t.value = v != null ? fmtT(v) : ''; }
  });
  app.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b) return;
    var act = b.dataset.act, key = app.dataset.key;
    if (act === 'done' || act === 'sw') {
      var info = rowInfo(b), e = ensureSet(info), s = e.sets[info.si], set = info.set;
      if (act === 'sw') {
        var id = info.key + '|' + info.ei + '|' + info.si;
        if (state.timers[id]) { s.t = Math.round((Date.now() - state.timers[id]) / 1000); delete state.timers[id]; s.d = true; }
        else state.timers[id] = Date.now();
      } else if (s.d) s.d = false;
      else {
        var wIn = $('input[data-f="w"]', info.row), rIn = $('input[data-f="r"]', info.row), tIn = $('input[data-f="t"]', info.row);
        if (set.kind === 'reps' && !s.r) {
          if (set.amrap) { rIn.classList.add('shake'); rIn.focus(); setTimeout(function () { rIn.classList.remove('shake'); }, 400); return; }
          s.r = String(set.reps);
        }
        if (set.kind === 'timed' && s.t == null) {
          if (set.timed.open) { tIn.classList.add('shake'); tIn.focus(); setTimeout(function () { tIn.classList.remove('shake'); }, 400); return; }
          s.t = set.timed.dur;
        }
        if (wIn && !s.w && /^[\d.]+$/.test(wIn.placeholder)) s.w = wIn.placeholder;
        s.d = true;
      }
      touch(info.key, e); save(); keepScroll(function () { renderWorkout(info.key); });
      return;
    }
    if (act === 'add' || act === 'rm') {
      var ei = +b.dataset.e, ex = wd(key).day.exercises[ei];
      var el = getExLog(key, ei, ex.name, true);
      while (el.sets.length < ex.sets.length) el.sets.push({ w: '', r: '', t: null, d: false });
      if (act === 'add') el.sets.push({ w: '', r: '', t: null, d: false });
      else if (el.sets.length > ex.sets.length) el.sets.pop();
      touch(key, el); save(); keepScroll(function () { renderWorkout(key); });
      return;
    }
    if (act === 'finish') { var l = getLog(key, true); l.completed = Date.now(); save(); toast('Workout saved 💪'); location.hash = '#/'; return; }
    if (act === 'reopen') { state.logs[key].completed = null; save(); renderWorkout(key); return; }
    if (act === 'backup') return doBackup();
    if (act === 'copy') {
      var txt = backupText();
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () {
        state.lastBackup = Date.now(); save(); toast('Backup copied — paste it into Notes or email it to yourself');
      }, function () { $('#restoreText').value = txt; toast('Copy the text in the box below'); });
      return;
    }
    if (act === 'restoreText') return doRestore($('#restoreText').value);
    if (act === 'reset') {
      if (confirm('Erase ALL logged workouts and settings on this phone? This cannot be undone.')) {
        state = defaultState(); save(); toast('All data erased'); location.hash = '#/';
      }
    }
  });
  function keepScroll(fn) { var y = window.scrollY; fn(); window.scrollTo(0, y); }

  $('#backBtn').addEventListener('click', function () { location.hash = '#/'; });
  $('#settingsBtn').addEventListener('click', function () { location.hash = '#/settings'; });
  window.addEventListener('hashchange', route);

  // stopwatch display
  setInterval(function () {
    document.querySelectorAll('input[data-sw]').forEach(function (i) { i.value = fmtT((Date.now() - +i.dataset.sw) / 1000); });
  }, 500);

  // ---------- backup / restore ----------
  function backupText() {
    return JSON.stringify({ app: 'blaba2-tracker', v: 1, exportedAt: new Date().toISOString(), state: state }, null, 1);
  }
  function doBackup() {
    var txt = backupText();
    var name = 'blaba2-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    var done = function () { state.lastBackup = Date.now(); save(); toast('Backup saved'); renderSettings(); };
    try {
      var file = new File([txt], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'BLABA2 backup' }).then(done, function (err) { if (err && err.name !== 'AbortError') download(); });
        return;
      }
    } catch (e) { /* fall through */ }
    download();
    function download() {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
      a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      done();
    }
  }
  function doRestore(text) {
    try {
      var obj = JSON.parse(text);
      var s = obj && obj.app === 'blaba2-tracker' ? obj.state : null;
      if (!s || typeof s.logs !== 'object') throw new Error('Not a BLABA2 backup');
      var n = Object.keys(s.logs).length;
      if (!confirm('Replace everything on this phone with this backup (' + n + ' workouts logged)?')) return;
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
      state = load(); save(); toast('Backup restored'); location.hash = '#/'; route();
    } catch (e) { toast('Restore failed: ' + e.message); }
  }

  // ---------- boot ----------
  route();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  window.__BLABA2 = { PROGRAM: PROGRAM, getState: function () { return state; }, STORE_KEY: STORE_KEY };
})();
