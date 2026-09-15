const test = require("node:test"),
  assert = require("node:assert/strict"),
  C = require("../src/core");
function state() {
  const s = C.createLevel(1);
  s.board = Array.from({ length: 49 }, (_, i) =>
    C.cell(((i % 7) + Math.floor(i / 7) * 2) % 6),
  );
  s.sand.fill(false);
  s.ice.fill(0);
  s.vines.fill(false);
  return s;
}
function combo(s, a, b) {
  const ca = C.clone(s.board[a]),
    cb = C.clone(s.board[b]);
  [s.board[a], s.board[b]] = [s.board[b], s.board[a]];
  const plan = C.combination(s, a, b, ca, cb);
  return { plan, frame: C.settleWave(s, [b, a], plan) };
}
function ids(f) {
  return new Set(f.removed.map((c) => c.index));
}
test("a crossing five outranks an earlier horizontal four", () => {
  const s = state();
  [22, 23, 24, 25, 10, 17, 31, 38].forEach((i) => (s.board[i].type = 5));
  const forms = C.formations(s.board, [24]);
  const f = forms.find((f) => f.ids.includes(24));
  assert.equal(f.special, "rainbow");
  assert.equal(forms.filter((f) => f.ids.includes(24)).length, 1);
});
test("six and seven in a line still produce one rainbow, with no higher power", () => {
  for (const count of [6, 7]) {
    const s = state();
    for (let i = 14; i < 14 + count; i++) s.board[i].type = 5;
    const f = C.formations(s.board, []).find((f) => f.ids.includes(14));
    assert.equal(f.special, "rainbow");
  }
});
test("T and L formations create bombs, whose basic blast is exactly 3 by 3", () => {
  const s = state();
  [22, 23, 24, 17, 10].forEach((i) => (s.board[i].type = 5));
  assert.equal(
    C.formations(s.board, []).find((f) => f.ids.includes(24)).special,
    "bomb",
  );
  const clean = state();
  clean.board[24].special = "bomb";
  const f = C.settleWave(clean, [], {
    direct: [24],
    effects: [],
    suppress: [],
  });
  assert.equal(ids(f).size, 9);
});
test("same-direction lines attack only one post-swap row or column", () => {
  for (const axis of ["row", "col"]) {
    const s = state(),
      a = axis === "row" ? 17 : 23,
      b = 24;
    s.board[a].special = axis;
    s.board[b].special = axis;
    const { plan, frame } = combo(s, a, b);
    assert.equal(plan.effects.length, 1);
    assert.equal(plan.effects[0].axis, axis);
    const wanted = new Set([a]);
    for (let i = 0; i < 7; i++) wanted.add(axis === "row" ? 21 + i : i * 7 + 3);
    assert.deepEqual(ids(frame), wanted);
  }
});
test("different-direction lines create a cross at destination", () => {
  const s = state();
  s.board[23].special = "row";
  s.board[24].special = "col";
  const { frame } = combo(s, 23, 24);
  const expected = new Set();
  for (let n = 0; n < 7; n++) {
    expected.add(21 + n);
    expected.add(n * 7 + 3);
  }
  assert.deepEqual(ids(frame), expected);
});
test("line plus bomb expands four lines toward source side", () => {
  for (const [a, b, axis, rows] of [
    [17, 24, "row", [1, 2, 3, 4]],
    [31, 24, "row", [2, 3, 4, 5]],
    [23, 24, "col", [1, 2, 3, 4]],
    [25, 24, "col", [2, 3, 4, 5]],
  ]) {
    const s = state();
    s.board[a].special = axis;
    s.board[b].special = "bomb";
    const { plan } = combo(s, a, b);
    assert.deepEqual(
      plan.effects.map((e) =>
        axis === "row" ? Math.floor(e.origin / 7) : e.origin % 7,
      ),
      rows,
    );
  }
});
test("double bomb is a radius-four Manhattan diamond, not a square", () => {
  const s = state();
  s.board[23].special = "bomb";
  s.board[24].special = "bomb";
  const { frame } = combo(s, 23, 24);
  const expected = new Set();
  for (let i = 0; i < 49; i++)
    if (Math.abs((i % 7) - 3) + Math.abs(Math.floor(i / 7) - 3) <= 4)
      expected.add(i);
  assert.deepEqual(ids(frame), expected);
  assert.equal(ids(frame).size, 37);
  assert.ok(!ids(frame).has(0));
});
test("rainbow plus ordinary clears only that color and the consumed rainbow", () => {
  const s = state();
  s.board[23].special = "rainbow";
  const color = s.board[24].type;
  const expected = new Set(
    s.board.map((c, i) => (c.type === color ? i : -1)).filter((i) => i >= 0),
  );
  expected.delete(24);
  expected.add(23);
  expected.add(24);
  const { frame } = combo(s, 23, 24);
  assert.deepEqual(ids(frame), expected);
});
test("rainbow converts every matching animal into the partner power and triggers all", () => {
  for (const special of ["row", "col", "bomb"]) {
    const s = state();
    s.board[23].special = "rainbow";
    s.board[24].special = special;
    const color = s.board[24].type,
      count = s.board.filter((c) => c.type === color).length;
    const { plan, frame } = combo(s, 23, 24);
    assert.equal(plan.converted.length, count);
    assert.equal(plan.effects.length, count);
    assert.ok(
      plan.effects.every((e) =>
        special === "bomb" ? e.kind === "area" : e.axis === special,
      ),
    );
    assert.ok(
      frame.converted.every((i) => frame.beforeBoard[i].special === special),
    );
  }
});
test("double rainbow triggers existing powers before the full-board effect", () => {
  const s = state();
  s.board[23].special = "rainbow";
  s.board[24].special = "rainbow";
  s.board[10].special = "bomb";
  s.board[30].special = "row";
  const { plan, frame } = combo(s, 23, 24);
  assert.equal(plan.effects.at(-1).kind, "all");
  assert.ok(plan.effects.slice(0, -1).some((e) => e.kind === "area"));
  assert.equal(ids(frame).size, 49);
});
test("a standalone line stops before a coin without removing it", () => {
  const s = state();
  s.board[24].special = "row";
  s.board[26] = C.cell(-2, "coin");
  const f = C.settleWave(s, [], { direct: [24], effects: [], suppress: [] });
  assert.ok(ids(f).has(25));
  assert.ok(!ids(f).has(26));
  assert.ok(!ids(f).has(27));
  assert.equal(s.board[26].special, "coin");
});
test("a coin cleared by adjacent match no longer blocks the same wave line", () => {
  const s = state();
  s.board[22].special = "row";
  s.board[24] = C.cell(-2, "coin");
  [10, 17, 18, 19].forEach((i) => (s.board[i].type = 4));
  const f = C.settleWave(s, [], { direct: [22], effects: [], suppress: [] });
  assert.ok(ids(f).has(24));
  assert.ok(ids(f).has(25));
  assert.ok(ids(f).has(26));
});
test("a bomb clears a coin before simultaneous line tracing, independent of effect order", () => {
  for (const reverse of [false, true]) {
    const s = state();
    s.board[24] = C.cell(-2, "coin");
    const effects = [
      { kind: "line", origin: 22, axis: "row" },
      { kind: "area", origin: 17, radius: 1, shape: "square" },
    ];
    if (reverse) effects.reverse();
    const f = C.settleWave(s, [], { direct: [], effects, suppress: [] });
    assert.ok(ids(f).has(24));
    assert.ok(ids(f).has(26));
  }
});
test("ice loses one layer per clear; the animal is removed and layers stay on the tile", () => {
  const s = state();
  s.ice[24] = 3;
  const f = C.settleWave(s, [], { direct: [24], effects: [], suppress: [] });
  assert.equal(s.ice[24], 2);
  assert.equal(s.board[24], null);
  assert.ok(ids(f).has(24));
});
test("vines prevent swapping and falling; first hit removes only the vine", () => {
  const s = state();
  s.vines[24] = true;
  const saved = C.clone(s.board[24]);
  assert.equal(C.movable(s, 24), false);
  s.board[31] = null;
  C.gravity(s, C.rng(4));
  assert.deepEqual(s.board[24], saved);
  const f = C.settleWave(s, [], { direct: [24], effects: [], suppress: [] });
  assert.equal(s.vines[24], false);
  assert.deepEqual(s.board[24], saved);
  assert.ok(!ids(f).has(24));
});
test("nests take one adjacent hit per wave and two broken nests produce four chicks", () => {
  const s = state();
  s.board[22] = { type: -3, special: "nest", hp: 1 };
  s.board[26] = { type: -3, special: "nest", hp: 1 };
  C.settleWave(s, [], {
    direct: [21, 23, 25, 27, 19],
    effects: [],
    suppress: [],
  });
  assert.equal(s.pendingChicks, 4);
  C.gravity(s, C.rng(12));
  assert.equal(s.board.filter((c) => c.special === "chick").length, 4);
  assert.equal(s.pendingChicks, 0);
});
test("gravity records real source positions and top spawn paths", () => {
  const s = state(),
    bottom = C.clone(s.board[42]),
    above = C.clone(s.board[35]);
  s.board[42] = null;
  const f = C.gravity(s, C.rng(8));
  assert.deepEqual(s.board[42], above);
  assert.ok(f.motions.some((m) => m.from === 35 && m.to === 42));
  assert.ok(f.motions.some((m) => m.from < 0));
  assert.equal(s.board.length, 49);
});
test("conveyor rotates one cell on its configured loop without losing animals", () => {
  const s = state();
  s.belt = [8, 9, 16, 15];
  const old = s.belt.map((i) => C.clone(s.board[i]));
  const f = C.conveyor(s);
  assert.deepEqual(s.board[9], old[0]);
  assert.deepEqual(s.board[8], old[3]);
  assert.equal(f.kind, "belt");
  assert.equal(f.motions.length, 4);
});
test("dye plus bomb combines target-color clearing with local area damage", () => {
  const s = state();
  s.board[23].special = "dye";
  s.board[24].special = "bomb";
  const color = s.board[23].type;
  const { plan } = combo(s, 23, 24);
  assert.ok(plan.effects.some((e) => e.kind === "color" && e.type === color));
  assert.ok(plan.effects.some((e) => e.kind === "area" && e.radius === 2));
});
test("shuffle retains earned powers and fixed obstacles, producing a legal stable board", () => {
  const s = state();
  s.board[1].special = "rainbow";
  s.board[24] = C.cell(-2, "coin");
  s.vines[16] = true;
  const fixed = C.clone(s.board[16]);
  C.reshuffle(s, C.rng(5));
  assert.equal(s.board.filter((c) => c.special === "rainbow").length, 1);
  assert.equal(s.board[24].special, "coin");
  assert.deepEqual(s.board[16], fixed);
  assert.equal(C.scan(s.board).length, 0);
  assert.ok(C.moves(s).length);
});
