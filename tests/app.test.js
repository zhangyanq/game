const test = require("node:test"),
  assert = require("node:assert/strict");
const App = require("../src/app"),
  C = require("../src/core");
function setup(profile) {
  let stored = profile || null;
  const ctx = new Proxy(
    {
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    },
    {
      get(t, k) {
        return k in t ? t[k] : () => {};
      },
      set(t, k, v) {
        t[k] = v;
        return true;
      },
    },
  );
  const canvas = { getContext: () => ctx };
  const p = {
    canvas,
    read: () => stored,
    write: (v) => {
      stored = C.clone(v);
      return true;
    },
    hide: () => {},
    show: () => {},
    vibrate: () => {},
    sound: () => {},
    hasAds: false,
  };
  return {
    app: new App(p, { width: 390, height: 844, dpr: 2 }),
    read: () => stored,
    p,
  };
}
test("completed game awards shells once without spending energy", () => {
  const { app } = setup();
  app.start(1);
  app.game.status = "won";
  app.finish();
  const shells = app.profile.shells;
  assert.equal(shells, 20);
  assert.equal(app.profile.energy, 5);
  assert.equal(app.profile.active, null);
  app.finish();
  assert.equal(app.profile.shells, shells);
  assert.equal(app.profile.unlocked, 2);
});
test("loss consumes exactly one energy and cannot settle twice", () => {
  const { app } = setup();
  app.start(1);
  app.game.status = "lost";
  app.finish();
  app.finish();
  assert.equal(app.profile.energy, 4);
  assert.equal(app.profile.active, null);
});
test("active game survives reload with identical board and steps", async () => {
  const { app, read } = setup();
  app.start(1);
  await app.doSwap(...C.moves(app.game.board)[0]);
  const expected = C.clone(app.game);
  const reloaded = setup(read()).app;
  reloaded.start(1);
  assert.deepEqual(reloaded.game, expected);
});
test("empty energy blocks a fresh game", () => {
  const p = C.fresh(Date.now());
  p.energy = 0;
  const { app } = setup(p);
  app.start(1);
  assert.equal(app.modal.type, "energy");
  assert.equal(app.profile.active, null);
});
test("pause return preserves active game; explicit abandon spends once", () => {
  const { app } = setup();
  app.start(1);
  app.modal = { type: "pause" };
  app.draw(1);
  app.buttons.find((b) => b.id === "save-home").fn();
  assert.ok(app.profile.active);
  assert.equal(app.profile.energy, 5);
  app.start(1);
  app.modal = { type: "pause" };
  app.draw(1);
  app.buttons.find((b) => b.id === "abandon").fn();
  assert.equal(app.profile.active, null);
  assert.equal(app.profile.energy, 4);
});
test("native WeChat entry boots and renders with wx adapters and no DOM", () => {
  const { p } = setup();
  let frame;
  global.wx = {
    createCanvas: () => p.canvas,
    getWindowInfo: () => ({
      windowWidth: 390,
      windowHeight: 844,
      pixelRatio: 2,
    }),
    getStorageSync: () => null,
    setStorageSync: () => {},
    onHide: () => {},
    onShow: () => {},
    onTouchStart: () => {},
    onTouchEnd: () => {},
    onTouchCancel: () => {},
    onWindowResize: () => {},
  };
  global.requestAnimationFrame = (f) => (frame = f);
  try {
    require("../game");
    assert.equal(typeof frame, "function");
    frame(16);
  } finally {
    delete global.wx;
    delete global.requestAnimationFrame;
  }
});

test("invalid adjacent swap animates and returns without spending a move", async () => {
  const { app } = setup();
  app.start(1);
  let pair;
  for (let i = 0; i < 48; i++)
    if (C.adjacent(i, i + 1) && !C.legal(app.game, i, i + 1)) {
      pair = [i, i + 1];
      break;
    }
  assert.ok(pair);
  const before = C.clone(app.game);
  const pending = app.doSwap(...pair);
  assert.equal(app.busy, true);
  assert.equal(app.animation.kind, "swap");
  await pending;
  assert.equal(app.busy, false);
  assert.equal(app.animation, null);
  assert.deepEqual(app.game, before);
});
test("exchange midpoint renders both animals between their two grid cells", () => {
  const { app } = setup();
  app.start(1);
  app.displayBoard = C.clone(app.game.board);
  app.animation = {
    kind: "swap",
    a: 0,
    b: 1,
    started: Date.now() - 105,
    duration: 210,
  };
  const positions = [];
  app.critter = (type, x, y) => positions.push({ x, y });
  app.draw(1);
  assert.equal(
    positions.filter((p) => p.x > 66 && p.x < 94 && p.y > 285 && p.y < 299)
      .length,
    2,
  );
});

test("completed clear ad applies exactly one clear reward, no energy reward", async () => {
  const { app, p } = setup();
  app.start(1);
  p.hasAds = true;
  p.watchAd = async () => true;
  app.playFrames = async () => {};
  const left = app.game.left;
  await app.watchClearAd();
  assert.equal(app.profile.clearAds, 1);
  assert.equal(app.profile.ads, 1);
  assert.equal(app.profile.energy, 5);
  assert.equal(app.game.left, left);
  assert.equal(app.busy, false);
});
test("cancelled clear ad leaves board and quotas untouched", async () => {
  const { app, p } = setup();
  app.start(1);
  const before = C.clone(app.game);
  p.hasAds = true;
  p.watchAd = async () => {
    throw Error("cancelled");
  };
  await app.watchClearAd();
  assert.deepEqual(app.game, before);
  assert.equal(app.profile.clearAds, 0);
  assert.equal(app.profile.ads, 0);
  assert.equal(app.adLoading, false);
});
