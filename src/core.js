(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BoboCore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const SIZE = 7,
    TYPES = 6,
    INTERVAL = 30 * 60 * 1000;
  const POWERS = ["row", "col", "bomb", "rainbow"];
  function rng(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }
  function cell(type, special) {
    return { type, special: special || null };
  }
  function row(i) {
    return Math.floor(i / 7);
  }
  function col(i) {
    return i % 7;
  }
  function isPower(c) {
    return !!c && POWERS.includes(c.special);
  }
  function ensure(input) {
    const s = Array.isArray(input) ? { board: input } : input;
    ["sand", "ice", "vines"].forEach((k) => {
      if (!s[k]) s[k] = Array(49).fill(k === "ice" ? 0 : false);
    });
    s.turn = s.turn || 0;
    s.pendingChicks = s.pendingChicks || 0;
    s.belt = s.belt || [];
    return s;
  }
  function scan(b) {
    const runs = [];
    for (let axis = 0; axis < 2; axis++)
      for (let a = 0; a < 7; a++) {
        let run = [];
        for (let n = 0; n <= 7; n++) {
          const i = axis ? n * 7 + a : a * 7 + n,
            c = n < 7 ? b[i] : null,
            prev = run.length ? b[run[0]] : null;
          if (c && c.type >= 0 && prev && c.type === prev.type) run.push(i);
          else {
            if (run.length >= 3) runs.push({ axis, ids: run });
            run = c && c.type >= 0 ? [i] : [];
          }
        }
      }
    return runs;
  }
  function adjacent(a, b) {
    return (
      a >= 0 &&
      b >= 0 &&
      a < 49 &&
      b < 49 &&
      Math.abs(row(a) - row(b)) + Math.abs(col(a) - col(b)) === 1
    );
  }
  function swap(b, a, c) {
    const t = b[a];
    b[a] = b[c];
    b[c] = t;
  }
  function movable(input, i) {
    const s = ensure(input),
      c = s.board[i];
    return !!c && !s.vines[i] && !["coin", "nest"].includes(c.special);
  }
  function legal(input, a, b) {
    const s = ensure(input);
    if (!adjacent(a, b) || !movable(s, a) || !movable(s, b)) return false;
    const ca = s.board[a],
      cb = s.board[b];
    if (
      (isPower(ca) && isPower(cb)) ||
      (ca.special === "dye" && isPower(cb)) ||
      (cb.special === "dye" && isPower(ca))
    )
      return true;
    if (ca.special === "rainbow" || cb.special === "rainbow")
      return ca.type >= 0 && cb.type >= 0;
    swap(s.board, a, b);
    const ok = scan(s.board).some(
      (r) => r.ids.includes(a) || r.ids.includes(b),
    );
    swap(s.board, a, b);
    return ok;
  }
  function moves(input) {
    const s = ensure(input),
      out = [];
    for (let i = 0; i < 49; i++) {
      if (i % 7 < 6 && legal(s, i, i + 1)) out.push([i, i + 1]);
      if (i < 42 && legal(s, i, i + 7)) out.push([i, i + 7]);
    }
    return out;
  }
  function board(random) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const b = [];
      for (let i = 0; i < 49; i++) {
        let types = [0, 1, 2, 3, 4, 5];
        if (i % 7 > 1 && b[i - 1].type === b[i - 2].type)
          types = types.filter((t) => t !== b[i - 1].type);
        if (i >= 14 && b[i - 7].type === b[i - 14].type)
          types = types.filter((t) => t !== b[i - 7].type);
        b.push(cell(types[Math.floor(random() * types.length)]));
      }
      if (moves(b).length) return b;
    }
    throw Error("Unable to create playable board");
  }
  const levels = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    title: ["浅海初遇", "珊瑚花园", "月光海湾", "珍珠秘境", "星潮之夜"][
      Math.floor(i / 6)
    ],
    moves: 26 + Math.floor(i / 10) * 2 + (i >= 5 && i % 3 === 2 ? 10 : 0),
    kind:
      i < 5
        ? "collect"
        : i % 3 === 2
          ? "rescue"
          : i % 3 === 1
            ? "sand"
            : "collect",
    target: i < 5 ? 8 + i * 2 : 14 + Math.floor(i / 3) * 2,
    type: i % 6,
    sandCount: 10 + Math.floor(i / 3),
    fishCount: i < 9 ? 1 : 2,
  }));
  function createLevel(id) {
    id = Math.max(1, Math.min(30, id));
    const l = levels[id - 1],
      r = rng(9871 + id * 109);
    let b = board(r);
    if (id <= 5) {
      for (let n = 0; n < 100; n++) {
        if (
          moves(b).some((pair) => {
            swap(b, ...pair);
            const ok = scan(b).some((run) => b[run.ids[0]].type === l.type);
            swap(b, ...pair);
            return ok;
          })
        )
          break;
        b = board(r);
      }
    }
    const s = ensure({
      level: id,
      board: b,
      left: l.moves,
      progress: 0,
      score: 0,
      status: "playing",
    });
    if (l.kind === "sand") {
      const ids = Array.from({ length: 49 }, (_, i) => i);
      for (let n = 0; n < l.sandCount; n++)
        s.sand[ids.splice(Math.floor(r() * ids.length), 1)[0]] = true;
    }
    if (l.kind === "rescue")
      [1, 3, 5].slice(0, l.fishCount).forEach((i) => (b[i] = cell(-1, "fish")));
    // Optional elements are introduced one at a time, keeping early tutorials simple.
    if ([10, 13, 16].includes(id))
      [16, 17, 18, 23, 24, 25, 30, 31, 32].forEach(
        (i) => (s.ice[i] = id === 10 ? 1 : id === 13 ? 2 : 3),
      );
    if ([11, 17].includes(id)) [16, 24, 32].forEach((i) => (s.vines[i] = true));
    if ([14, 20].includes(id))
      [17, 31].forEach((i) => (b[i] = cell(-2, "coin")));
    if ([19, 23].includes(id))
      [22, 26].forEach((i) => (b[i] = { type: -3, special: "nest", hp: 2 }));
    if ([25, 29].includes(id))
      s.belt = [8, 9, 10, 11, 12, 19, 26, 33, 40, 39, 38, 37, 36, 29, 22, 15];
    if ([28, 30].includes(id)) {
      b[24] = cell(l.type, "dye");
      b[25] = cell((l.type + 1) % 6, "row");
    }
    if (!moves(s).length) reshuffle(s, r);
    return s;
  }
  function need(s) {
    const l = levels[s.level - 1];
    return l.kind === "sand"
      ? l.sandCount
      : l.kind === "rescue"
        ? l.fishCount
        : l.target;
  }
  // Runs sharing a cell belong to one match group. Choose once by priority,
  // rather than choosing per run (which can let a 4-run hide a crossing 5-run).
  function formations(b, preferred) {
    const runs = scan(b),
      groups = [];
    for (const r of runs) {
      let links = groups.filter((g) => g.ids.some((i) => r.ids.includes(i)));
      let group = { runs: [r], ids: r.ids.slice() };
      for (const g of links) {
        group.runs.push(...g.runs);
        group.ids.push(...g.ids);
        groups.splice(groups.indexOf(g), 1);
      }
      group.ids = [...new Set(group.ids)];
      groups.push(group);
    }
    return groups.map((g) => {
      const longest = g.runs
        .slice()
        .sort((a, b) => b.ids.length - a.ids.length)[0];
      const cross = g.ids.find(
        (i) =>
          g.runs.some((r) => r.axis === 0 && r.ids.includes(i)) &&
          g.runs.some((r) => r.axis === 1 && r.ids.includes(i)),
      );
      let special =
        longest.ids.length >= 5
          ? "rainbow"
          : cross !== undefined
            ? "bomb"
            : longest.ids.length >= 4
              ? longest.axis === 0
                ? "row"
                : "col"
              : null;
      const candidates = special === "rainbow" ? longest.ids : g.ids;
      let at = (preferred || []).find((i) => candidates.includes(i));
      if (at === undefined)
        at =
          cross !== undefined && special === "bomb"
            ? cross
            : candidates[Math.floor(candidates.length / 2)];
      return { ids: g.ids, at, special };
    });
  }
  function around(i) {
    return [
      i - 7,
      i + 7,
      col(i) > 0 ? i - 1 : -1,
      col(i) < 6 ? i + 1 : -1,
    ].filter((n) => n >= 0 && n < 49);
  }
  function area(origin, radius, shape) {
    const out = [];
    for (let i = 0; i < 49; i++) {
      const y = Math.abs(row(i) - row(origin)),
        x = Math.abs(col(i) - col(origin));
      if (shape === "diamond" ? x + y <= radius : Math.max(x, y) <= radius)
        out.push(i);
    }
    return out;
  }
  function lineCells(s, origin, axis, clearedCoins) {
    const cells = [origin];
    for (const d of [-1, 1]) {
      for (let n = 1; n < 7; n++) {
        const y = row(origin) + (axis === "col" ? n * d : 0),
          x = col(origin) + (axis === "row" ? n * d : 0);
        if (y < 0 || y > 6 || x < 0 || x > 6) break;
        const i = y * 7 + x;
        if (s.board[i] && s.board[i].special === "coin" && !clearedCoins.has(i))
          break;
        cells.push(i);
        if (s.board[i] && s.board[i].special === "nest") break;
      }
    }
    return cells;
  }
  function powerEffect(s, i) {
    const c = s.board[i];
    if (!c) return null;
    if (c.special === "row" || c.special === "col")
      return { kind: "line", origin: i, axis: c.special };
    if (c.special === "bomb")
      return { kind: "area", origin: i, radius: 1, shape: "square" };
    if (c.special === "rainbow") {
      const counts = Array(6).fill(0);
      s.board.forEach((v) => {
        if (v && v.type >= 0) counts[v.type]++;
      });
      return {
        kind: "color",
        origin: i,
        type: counts.indexOf(Math.max(...counts)),
      };
    }
    return null;
  }
  // Inputs are the pre-swap pieces; all origins use the post-swap destination b.
  function combination(s, a, b, ca, cb) {
    const plan = {
      direct: [a, b],
      effects: [],
      suppress: [a, b],
      name: "",
      converted: [],
    };
    const pa = ca.special,
      pb = cb.special;
    if (pa === "rainbow" && pb === "rainbow") {
      plan.name = "双魔力清屏";
      plan.suppress = [];
      s.board.forEach((c, i) => {
        if (isPower(c) && i !== a && i !== b) {
          plan.effects.push(powerEffect(s, i));
          plan.suppress.push(i);
        }
      });
      plan.suppress.push(a, b);
      plan.effects.push({ kind: "all", origin: b });
      return plan;
    }
    if (pa === "dye" || pb === "dye") {
      const dye = pa === "dye" ? ca : cb,
        other = pa === "dye" ? cb : ca;
      if (!isPower(other)) return null;
      plan.name = "染色绽放";
      plan.effects.push({ kind: "color", origin: b, type: dye.type });
      if (other.special === "bomb")
        plan.effects.push({
          kind: "area",
          origin: b,
          radius: 2,
          shape: "square",
        });
      else if (other.special !== "rainbow")
        plan.effects.push({ kind: "line", origin: b, axis: other.special });
      return plan;
    }
    if (pa === "rainbow" || pb === "rainbow") {
      const other = pa === "rainbow" ? cb : ca;
      plan.name = "魔力同色消除";
      if (["row", "col", "bomb"].includes(other.special)) {
        plan.name = "魔力全屏转化";
        s.board.forEach((c, i) => {
          if (c && c.type === other.type && c.type >= 0) {
            c.special = other.special;
            plan.converted.push(i);
            plan.suppress.push(i);
            plan.effects.push(powerEffect(s, i));
            plan.direct.push(i);
          }
        });
      } else plan.effects.push({ kind: "color", origin: b, type: other.type });
      return plan;
    }
    if (!isPower(ca) || !isPower(cb)) return null;
    if (["row", "col"].includes(pa) && ["row", "col"].includes(pb)) {
      plan.name = pa === pb ? "同向直线" : "十字冲浪";
      plan.effects.push({ kind: "line", origin: b, axis: pa });
      if (pa !== pb) plan.effects.push({ kind: "line", origin: b, axis: pb });
      return plan;
    }
    if (pa === "bomb" && pb === "bomb") {
      plan.name = "双爆炸 · 菱形扩散";
      plan.effects.push({
        kind: "area",
        origin: b,
        radius: 4,
        shape: "diamond",
      });
      return plan;
    }
    const axis = pa === "bomb" ? pb : pa;
    plan.name = "四线扩散";
    const source = axis === "row" ? row(a) - row(b) : col(a) - col(b),
      offsets = source > 0 ? [-1, 0, 1, 2] : [-2, -1, 0, 1];
    for (const offset of offsets) {
      const y = row(b) + (axis === "row" ? offset : 0),
        x = col(b) + (axis === "col" ? offset : 0);
      if (y >= 0 && y < 7 && x >= 0 && x < 7)
        plan.effects.push({ kind: "line", origin: y * 7 + x, axis });
    }
    return plan;
  }
  function snapshot(s) {
    return {
      board: clone(s.board),
      sand: s.sand.slice(),
      ice: s.ice.slice(),
      vines: s.vines.slice(),
      progress: s.progress,
      score: s.score,
    };
  }
  function settleWave(s, preferred, plan) {
    ensure(s);
    const groups = formations(s.board, preferred);
    if (!groups.length && !plan) return null;
    const beforeBoard = clone(s.board),
      targets = new Set(plan ? plan.direct : []),
      suppressed = new Set(plan ? plan.suppress : []),
      effects = plan ? plan.effects.slice() : [],
      spawns = [],
      clearedCoins = new Set(),
      matched = new Set();
    groups.forEach((g) => {
      g.ids.forEach((i) => {
        targets.add(i);
        matched.add(i);
      });
      if (g.special && !plan)
        spawns.push({ index: g.at, cell: cell(s.board[g.at].type, g.special) });
    });
    // An adjacent ordinary match makes a coin eligible before any line is traced.
    for (const i of matched)
      if (!s.vines[i])
        for (const n of around(i))
          if (s.board[n] && s.board[n].special === "coin") clearedCoins.add(n);
    const active = new Set(suppressed);
    let change = true,
      iterations = 0;
    while (change && iterations++ < 150) {
      change = false;
      const previous = targets.size + clearedCoins.size + effects.length;
      for (const e of effects) {
        let cells = [];
        if (e.kind === "line")
          cells = lineCells(s, e.origin, e.axis, clearedCoins);
        else if (e.kind === "area") cells = area(e.origin, e.radius, e.shape);
        else if (e.kind === "all")
          cells = Array.from({ length: 49 }, (_, i) => i);
        else if (e.kind === "color")
          s.board.forEach((c, i) => {
            if (c && c.type === e.type) cells.push(i);
          });
        e.cells = cells;
        for (const i of cells) {
          targets.add(i);
          if (e.kind !== "line" && s.board[i] && s.board[i].special === "coin")
            clearedCoins.add(i);
        }
      }
      clearedCoins.forEach((i) => targets.add(i));
      for (const i of Array.from(targets)) {
        if (active.has(i) || s.vines[i]) continue;
        active.add(i);
        const e = powerEffect(s, i);
        if (e) effects.push(e);
      }
      change = targets.size + clearedCoins.size + effects.length !== previous;
    }
    const removed = [],
      hit = [],
      brokenNests = [];
    const l = levels[s.level - 1];
    // A nest can be hit once per wave, by adjacent cleared animals or direct power.
    const nestHits = new Set();
    for (const i of targets) {
      const c = s.board[i];
      if (c && c.special === "nest") nestHits.add(i);
      if (c && c.type >= 0 && !s.vines[i])
        for (const n of around(i))
          if (s.board[n] && s.board[n].special === "nest") nestHits.add(n);
    }
    for (const i of targets) {
      const c = s.board[i];
      if (
        !c ||
        ["fish", "nest"].includes(c.special) ||
        (c.special === "coin" && !clearedCoins.has(i))
      )
        continue;
      if (s.vines[i]) {
        s.vines[i] = false;
        hit.push(i);
        continue;
      }
      removed.push({ index: i, type: c.type, special: c.special });
      if (l.kind === "collect" && c.type === l.type) s.progress++;
      if (l.kind === "sand" && s.sand[i]) {
        s.sand[i] = false;
        s.progress++;
      }
      if (s.ice[i] > 0) {
        s.ice[i]--;
        hit.push(i);
      }
      s.board[i] = null;
    }
    for (const i of nestHits) {
      const c = s.board[i];
      if (!c || c.special !== "nest") continue;
      c.hp--;
      hit.push(i);
      if (c.hp <= 0) {
        brokenNests.push(i);
        removed.push({ index: i, type: -3, special: "nest" });
        s.board[i] = null;
      }
    }
    s.pendingChicks += brokenNests.length * 2;
    const created = [];
    for (const spawn of spawns) {
      if (!s.vines[spawn.index] && s.board[spawn.index] === null) {
        s.board[spawn.index] = spawn.cell;
        created.push(spawn.index);
      }
    }
    s.score += removed.length * 30;
    return {
      kind: "clear",
      beforeBoard,
      removed,
      hit,
      created,
      effects,
      name: plan ? plan.name : "",
      converted: plan ? plan.converted : [],
      ...snapshot(s),
    };
  }
  function gravity(s, random) {
    const motions = [],
      beforeBoard = clone(s.board);
    function fillSegment(x, start, end) {
      if (end < start) return;
      const pieces = [];
      for (let y = end; y >= start; y--) {
        const i = y * 7 + x;
        if (s.board[i]) pieces.push({ c: s.board[i], from: i });
      }
      let generated = 0;
      for (let y = end; y >= start; y--) {
        const i = y * 7 + x,
          old = pieces[end - y];
        let c, from;
        if (old) {
          c = old.c;
          from = old.from;
        } else {
          c =
            s.pendingChicks > 0
              ? (s.pendingChicks--, cell(1, "chick"))
              : cell(Math.floor(random() * 6));
          generated++;
          from = (start - generated) * 7 + x;
        }
        s.board[i] = c;
        motions.push({
          from,
          to: i,
          cell: clone(c),
          clipTop: start,
          clipBottom: end,
        });
      }
    }
    for (let x = 0; x < 7; x++) {
      let start = 0;
      for (let y = 0; y <= 7; y++) {
        const i = y * 7 + x,
          c = s.board[i],
          barrier =
            y === 7 ||
            s.vines[i] ||
            (c && ["coin", "nest"].includes(c.special));
        if (barrier) {
          fillSegment(x, start, y - 1);
          start = y + 1;
        }
      }
    }
    return { kind: "fall", beforeBoard, motions, ...snapshot(s) };
  }
  function fillAndRescue(s, r, frames) {
    frames.push(gravity(s, r));
    if (levels[s.level - 1].kind === "rescue") {
      for (let guard = 0; guard < 7; guard++) {
        const removed = [];
        const beforeBoard = clone(s.board);
        for (let x = 0; x < 7; x++) {
          const i = 42 + x;
          if (s.board[i] && s.board[i].special === "fish" && !s.vines[i]) {
            removed.push({ index: i, type: -1, special: "fish" });
            s.board[i] = null;
            s.progress++;
            s.score += 300;
          }
        }
        if (!removed.length) break;
        frames.push({
          kind: "clear",
          beforeBoard,
          removed,
          hit: [],
          created: [],
          effects: [],
          name: "小鱼获救",
          ...snapshot(s),
        });
        frames.push(gravity(s, r));
      }
    }
  }
  function cascade(s, r, frames, preferred, plan) {
    for (let n = 0; n < 80; n++) {
      const f = settleWave(s, n === 0 ? preferred : [], n === 0 ? plan : null);
      if (!f) return;
      frames.push(f);
      fillAndRescue(s, r, frames);
    }
    reshuffle(s, r);
    frames.push({ kind: "shuffle", ...snapshot(s) });
  }
  function conveyor(s) {
    if (!s.belt.length || s.belt.some((i) => !movable(s, i))) return null;
    const old = clone(s.board),
      motions = [];
    s.belt.forEach((from, k) => {
      const to = s.belt[(k + 1) % s.belt.length];
      s.board[to] = old[from];
      motions.push({ from, to, cell: old[from] });
    });
    return { kind: "belt", beforeBoard: old, motions, ...snapshot(s) };
  }
  function play(s, a, b, random) {
    ensure(s);
    if (s.status !== "playing" || !legal(s, a, b))
      return { valid: false, frames: [] };
    const r = random || Math.random,
      ca = clone(s.board[a]),
      cb = clone(s.board[b]);
    swap(s.board, a, b);
    const swappedBoard = clone(s.board);
    s.left--;
    s.turn++;
    const plan = combination(s, a, b, ca, cb),
      frames = [];
    cascade(s, r, frames, [b, a], plan);
    if (s.progress < need(s) && s.belt.length && s.turn % 2 === 0) {
      const f = conveyor(s);
      if (f) {
        frames.push(f);
        cascade(s, r, frames, [], null);
      }
    }
    if (s.progress >= need(s)) s.status = "won";
    else if (s.left <= 0) s.status = "lost";
    let shuffled = false;
    if (s.status === "playing" && !moves(s).length) {
      reshuffle(s, r);
      shuffled = true;
      frames.push({ kind: "shuffle", ...snapshot(s) });
    }
    return { valid: true, swappedBoard, frames, shuffled };
  }
  function clearScreen(s, random) {
    ensure(s);
    if (s.status !== "playing") return { valid: false, frames: [] };
    const r = random || Math.random,
      beforeBoard = clone(s.board),
      l = levels[s.level - 1];
    const removed = s.board.map((c, index) => ({
      index,
      type: c.type,
      special: c.special,
    }));
    if (l.kind === "collect")
      s.progress += s.board.filter((c) => c.type === l.type).length;
    if (l.kind === "sand") s.progress += s.sand.filter(Boolean).length;
    if (l.kind === "rescue")
      s.progress += s.board.filter((c) => c.special === "fish").length;
    s.score += removed.length * 30;
    s.board.fill(null);
    s.sand.fill(false);
    s.ice.fill(0);
    s.vines.fill(false);
    s.pendingChicks = 0;
    const frames = [
      {
        kind: "clear",
        beforeBoard,
        removed,
        hit: [],
        created: [],
        effects: [
          {
            kind: "all",
            origin: 24,
            cells: Array.from({ length: 49 }, (_, i) => i),
          },
        ],
        name: "海洋净化 · 全屏消除",
        ...snapshot(s),
      },
    ];
    fillAndRescue(s, r, frames);
    cascade(s, r, frames, [], null);
    if (s.progress >= need(s)) s.status = "won";
    if (s.status === "playing" && !moves(s).length) {
      reshuffle(s, r);
      frames.push({ kind: "shuffle", ...snapshot(s) });
    }
    return { valid: true, frames };
  }
  function claimClear(p, now) {
    sync(p, now);
    if (p.clearAds >= 2 || p.ads >= 5) return false;
    p.clearAds++;
    p.ads++;
    return true;
  }
  function reshuffle(s, r) {
    ensure(s);
    const ids = s.board
        .map((c, i) => (movable(s, i) && c.special !== "fish" ? i : -1))
        .filter((i) => i >= 0),
      pool = ids.map((i) => clone(s.board[i]));
    for (let n = 0; n < 500; n++) {
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      ids.forEach((id, k) => (s.board[id] = pool[k]));
      if (!scan(s.board).length && moves(s).length) return;
    }
    // Extremely pathological color distributions fall back to a regenerated
    // arrangement, retaining powers, fish and fixed barriers.
    for (let n = 0; n < 200; n++) {
      const fresh = board(r);
      ids.forEach(
        (id, k) =>
          (s.board[id] = { type: fresh[id].type, special: pool[k].special }),
      );
      if (!scan(s.board).length && moves(s).length) return;
    }
    throw Error("Unable to find playable arrangement");
  }
  function day(now) {
    return new Date(now + 8 * 3600000).toISOString().slice(0, 10);
  }
  function fresh(now) {
    return {
      version: 1,
      energy: 5,
      recoveryAt: now,
      day: day(now),
      dailyClaimed: false,
      ads: 0,
      clearAds: 0,
      shells: 0,
      unlocked: 1,
      completed: [],
      decor: [],
      sound: true,
      music: true,
      haptic: true,
      active: null,
      lastNow: now,
    };
  }
  function sync(p, now) {
    if (!Number.isInteger(p.clearAds) || p.clearAds < 0) p.clearAds = 0;
    now = Math.max(now, p.lastNow || 0);
    p.lastNow = now;
    const d = day(now);
    if (p.day !== d) {
      p.day = d;
      p.dailyClaimed = false;
      p.ads = 0;
      p.clearAds = 0;
    }
    if (p.energy >= 5) p.recoveryAt = now;
    else {
      const count = Math.max(0, Math.floor((now - p.recoveryAt) / INTERVAL));
      if (count) {
        p.energy = Math.min(5, p.energy + count);
        p.recoveryAt = p.energy >= 5 ? now : p.recoveryAt + count * INTERVAL;
      }
    }
    return p;
  }
  function spend(p, now) {
    sync(p, now);
    if (p.energy <= 0) return false;
    const full = p.energy >= 5;
    p.energy--;
    if (full) p.recoveryAt = p.lastNow;
    return true;
  }
  function claim(p, now) {
    sync(p, now);
    if (p.dailyClaimed) return false;
    p.dailyClaimed = true;
    p.energy += 3;
    if (p.energy >= 5) p.recoveryAt = p.lastNow;
    return true;
  }
  function reward(p, now) {
    sync(p, now);
    if (p.ads >= 5) return false;
    p.ads++;
    p.energy++;
    if (p.energy >= 5) p.recoveryAt = p.lastNow;
    return true;
  }
  function remaining(p, now) {
    sync(p, now);
    return p.energy >= 5
      ? 0
      : Math.max(0, INTERVAL - (p.lastNow - p.recoveryAt));
  }
  return {
    SIZE,
    TYPES,
    INTERVAL,
    rng,
    clone,
    cell,
    scan,
    moves,
    legal,
    movable,
    adjacent,
    board,
    levels,
    createLevel,
    need,
    formations,
    combination,
    settleWave,
    gravity,
    conveyor,
    play,
    reshuffle,
    clearScreen,
    claimClear,
    fresh,
    sync,
    spend,
    claim,
    reward,
    remaining,
    day,
    ensure,
  };
});
