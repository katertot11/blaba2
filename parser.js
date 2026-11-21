/* Parses Liftosaur "planner" exerciseText into structured workouts.
   Works in the browser (window.ProgramParser) and in Node (module.exports). */
(function (root) {
  'use strict';

  // One set group, e.g. "1x8 72.5%", "1x4+ 82.5%", "1x1 1s+|0s 0lb", "1x7 60s (Round 1)"
  function parseGroup(str) {
    var s = str.trim();
    var label = null;
    var lm = s.match(/\(([^)]*)\)/);
    if (lm) { label = lm[1].trim(); s = s.replace(lm[0], '').trim(); }
    var toks = s.split(/\s+/);
    var m = toks[0].match(/^(\d+)x(\d+)(\+)?$/);
    if (!m) throw new Error('Bad set group: "' + str + '"');
    var g = {
      count: +m[1], reps: +m[2], amrap: !!m[3],
      pct: null, weight: null, rest: null, timed: null, label: label
    };
    toks.slice(1).forEach(function (t) {
      var x;
      if ((x = t.match(/^([\d.]+)%$/))) g.pct = +x[1];
      else if ((x = t.match(/^([\d.]+)lb$/))) g.weight = +x[1];
      else if ((x = t.match(/^(\d+)s(\+)?\|(\d+)s$/))) g.timed = { dur: +x[1], open: !!x[2], rest: +x[3] };
      else if ((x = t.match(/^(\d+)s$/))) g.rest = +x[1];
      else throw new Error('Unknown token "' + t + '" in "' + str + '"');
    });
    return g;
  }

  function kindOf(set) {
    if (set.timed) return 'timed';
    if (set.reps === 1 && !set.amrap && set.label && /^round/i.test(set.label)) return 'check';
    return 'reps';
  }

  function parseExerciseLine(line, note) {
    var parts = line.split(' / ').map(function (p) { return p.trim(); });
    var name = parts[0];
    var groups = parts[1].split(/,\s*/).map(parseGroup);
    var ex = { name: name, note: note || '', superset: null, warmup: null, sets: [] };
    parts.slice(2).forEach(function (p) {
      var x;
      if ((x = p.match(/^superset:\s*(\S+)$/))) ex.superset = x[1];
      else if ((x = p.match(/^warmup:\s*(.+)$/))) ex.warmup = x[1];
      else {
        // trailing set-level tokens that apply to every set, e.g. "/ 0lb"
        var extra = parseGroup('1x1 ' + p);
        groups.forEach(function (g) {
          ['pct', 'weight', 'rest', 'timed'].forEach(function (k) {
            if (g[k] == null && extra[k] != null) g[k] = extra[k];
          });
        });
      }
    });
    groups.forEach(function (g) {
      for (var i = 0; i < g.count; i++) {
        var set = {
          reps: g.reps, amrap: g.amrap, pct: g.pct, weight: g.weight,
          rest: g.rest, timed: g.timed, label: g.label
        };
        set.kind = kindOf(set);
        ex.sets.push(set);
      }
    });
    // Drop sets: label start / drop 1 / drop 2 within each round
    if (/^drop set/i.test(name) && ex.sets.length % 3 === 0) {
      ex.dropSet = true;
      ex.sets.forEach(function (s, i) {
        var r = Math.floor(i / 3) + 1, p = i % 3;
        s.label = 'Round ' + r + ' · ' + (p === 0 ? 'Start' : 'Drop ' + p);
      });
    }
    // Ladders: descending single sets
    if (/ladder/i.test(name)) {
      ex.ladder = true;
      ex.sets.forEach(function (s) { s.label = 'Rung ' + s.reps; });
    }
    return ex;
  }

  function parseDay(text) {
    var lines = text.split('\n');
    var pending = [];
    var exercises = [];
    lines.forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      if (line.indexOf('//') === 0) { pending.push(line.replace(/^\/\/\s?/, '').trim()); return; }
      exercises.push(parseExerciseLine(line, pending.join(' ')));
      pending = [];
    });
    return exercises;
  }

  function parseProgram(json) {
    var p = json.program;
    return {
      name: p.name,
      weeks: p.weeks.map(function (w) {
        return {
          name: w.name,
          deload: /deload/i.test(w.name),
          days: w.days.map(function (d) {
            return { name: d.name, exercises: parseDay(d.exerciseText) };
          })
        };
      })
    };
  }

  var api = { parseProgram: parseProgram, parseDay: parseDay, parseGroup: parseGroup };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ProgramParser = api;
})(typeof window !== 'undefined' ? window : this);
