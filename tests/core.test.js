const test = require("node:test"),
  assert = require("node:assert/strict");
const C = require("../src/core");
const NOW = Date.UTC(2026, 8, 10, 4);
test("initial boards have no matches and always have a legal move", () => {
  for (let seed = 1; seed <= 500; seed++) {
    const b = C.board(C.rng(seed));
    assert.equal(C.scan(b).length, 0);
    assert.ok(C.moves(b).length);
  }
});
test("invalid swaps leave the complete state unchanged", () => {
  const s = C.createLevel(1),
    before = C.clone(s);
  assert.equal(C.play(s, 0, 48).valid, false);
  assert.deepEqual(s, before);
});
test("all 30 level configurations resolve legal moves without stuck boards", () => {
  for (let level = 1; level <= 30; level++) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const s = C.createLevel(level),
        random = C.rng(level * 79 + attempt);
      let n = 0;
      while (s.status === "playing" && n++ < 60) {
        assert.equal(C.scan(s.board).length, 0);
        const options = C.moves(s);
        assert.ok(options.length);
        const pair = options[Math.floor(random() * options.length)],
          left = s.left;
        const result = C.play(s, ...pair, random);
        assert.ok(result.valid);
        assert.equal(s.left, left - 1);
        assert.equal(s.board.length, 49);
        assert.ok(s.board.every((v) => v && Number.isInteger(v.type)));
      }
      assert.notEqual(s.status, "playing");
      assert.ok(s.progress >= 0);
    }
  }
});
test("straight four and five create specials; crossing matches create a bomb", () => {
  const base = () => {
    const s = C.createLevel(1);
    s.board = Array.from({ length: 49 }, (_, i) => ({
      type: ((i % 7) + Math.floor(i / 7) * 2) % 6,
      special: null,
    }));
    return s;
  };
  let s = base();
  [14, 15, 16].forEach((i) => (s.board[i].type = 5));
  s.board[17].type = 2;
  s.board[10].type = 5;
  let r = C.play(s, 10, 17, C.rng(66));
  assert.ok(r.valid);
  assert.ok(
    r.frames[0].created.some((i) =>
      r.frames[0].board.some((c) => c && c.special === "row"),
    ),
  );
  s = base();
  [14, 15, 17, 18].forEach((i) => (s.board[i].type = 5));
  s.board[16].type = 2;
  s.board[9].type = 5;
  r = C.play(s, 9, 16, C.rng(77));
  assert.ok(r.frames[0].board.some((c) => c && c.special === "rainbow"));
  s = base();
  [22, 23, 25, 17, 31].forEach((i) => (s.board[i].type = 5));
  s.board[24].type = 2;
  r = C.play(s, 25, 24, C.rng(81));
  assert.ok(r.frames[0].board.some((c) => c && c.special === "bomb"));
});
test("two rainbow pieces clear every ordinary piece", () => {
  const s = C.createLevel(1);
  s.board[0].special = "rainbow";
  s.board[1].special = "rainbow";
  const r = C.play(s, 0, 1, C.rng(9));
  assert.ok(r.valid);
  assert.equal(r.frames[0].removed.length, 49);
});
test("sand objective counts only cleared sand; fish survives ordinary clearing", () => {
  const s = C.createLevel(8),
    before = s.sand.filter(Boolean).length;
  const pair = C.moves(s)[0];
  C.play(s, ...pair, C.rng(5));
  assert.equal(s.progress, before - s.sand.filter(Boolean).length);
  const f = C.createLevel(6);
  const count = C.levels[5].fishCount;
  assert.equal(
    f.board.filter((c) => c && c.special === "fish").length + f.progress,
    count,
  );
  C.play(f, ...C.moves(f)[0], C.rng(6));
  assert.equal(
    f.board.filter((c) => c && c.special === "fish").length + f.progress,
    count,
  );
});
test("energy recovery is anchored at spending, caps naturally and supports offline time", () => {
  const p = C.fresh(NOW);
  C.spend(p, NOW);
  assert.equal(p.energy, 4);
  C.sync(p, NOW + C.INTERVAL - 1);
  assert.equal(p.energy, 4);
  C.sync(p, NOW + C.INTERVAL);
  assert.equal(p.energy, 5);
  C.sync(p, NOW + C.INTERVAL * 100);
  assert.equal(p.energy, 5);
});
test("daily supply overflows once and ads have a global five-reward cap", () => {
  const p = C.fresh(NOW);
  assert.ok(C.claim(p, NOW));
  assert.equal(p.energy, 8);
  assert.equal(C.claim(p, NOW), false);
  for (let i = 0; i < 5; i++) assert.ok(C.reward(p, NOW));
  assert.equal(C.reward(p, NOW), false);
  assert.equal(p.energy, 13);
  assert.equal(p.ads, 5);
});
test("China midnight resets daily rewards but never overwrites energy", () => {
  const t = Date.UTC(2026, 8, 10, 15, 59, 59),
    p = C.fresh(t);
  C.claim(p, t);
  C.reward(p, t);
  C.sync(p, t + 1000);
  assert.equal(p.day, "2026-09-11");
  assert.equal(p.dailyClaimed, false);
  assert.equal(p.ads, 0);
  assert.equal(p.energy, 9);
});
test("backward clock cannot duplicate daily rewards or energy", () => {
  const p = C.fresh(NOW);
  C.claim(p, NOW);
  C.sync(p, NOW - 86400000);
  assert.equal(p.dailyClaimed, true);
  assert.equal(p.day, C.day(NOW));
});

test("ad clear has two uses, shares five-ad cap and resets at China midnight", () => {
  const p = C.fresh(NOW);
  assert.ok(C.claimClear(p, NOW));
  assert.ok(C.claimClear(p, NOW));
  assert.equal(C.claimClear(p, NOW), false);
  assert.equal(p.ads, 2);
  assert.equal(p.energy, 5);
  C.sync(p, NOW + 86400000);
  assert.equal(p.clearAds, 0);
  p.ads = 5;
  assert.equal(C.claimClear(p, NOW + 86400000), false);
});
test("screen clear removes all cells and barriers without spending a move", () => {
  const s = C.createLevel(16);
  s.board[24] = C.cell(-2, "coin");
  s.vines[20] = true;
  const left = s.left,
    turn = s.turn;
  const r = C.clearScreen(s, C.rng(88));
  assert.equal(r.frames[0].removed.length, 49);
  assert.ok(r.frames[0].board.every((c) => c === null));
  assert.ok(s.ice.every((n) => n === 0));
  assert.ok(s.vines.every((v) => !v));
  assert.ok(s.board.every(Boolean));
  assert.equal(s.left, left);
  assert.equal(s.turn, turn);
});
