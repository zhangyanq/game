const test = require("node:test"),
  assert = require("node:assert/strict");
const config = require("../src/config"),
  { create } = require("../src/platform");
function mock() {
  let close, error;
  let ad = {
    show: () => Promise.resolve(),
    load: () => Promise.resolve(),
    onClose: (f) => (close = f),
    onError: (f) => (error = f),
  };
  return {
    api: { createRewardedVideoAd: () => ad },
    close: (r) => close(r),
    error: () => error({}),
    ad,
  };
}
test("ad reward only succeeds on explicitly completed view, cancellation never rewards", async () => {
  config.rewardedAdUnitId = "test-only";
  let m = mock(),
    p = create(m.api, {}),
    a = p.watchAd();
  m.close({ isEnded: true });
  assert.equal(await a, true);
  a = p.watchAd();
  m.close({ isEnded: false });
  await assert.rejects(a, /完整观看/);
  a = p.watchAd();
  m.close();
  await assert.rejects(a, /完整观看/);
  config.rewardedAdUnitId = "";
});
test("ad error and duplicate watch do not reward; new request can recover", async () => {
  config.rewardedAdUnitId = "test-only";
  let m = mock(),
    p = create(m.api, {}),
    a = p.watchAd();
  await assert.rejects(p.watchAd(), /加载/);
  m.error();
  await assert.rejects(a, /暂不可用/);
  a = p.watchAd();
  m.close({ isEnded: true });
  assert.equal(await a, true);
  config.rewardedAdUnitId = "";
});
test("missing real ad configuration never simulates a reward", async () => {
  config.rewardedAdUnitId = "";
  let p = create({}, {});
  assert.equal(p.hasAds, false);
  await assert.rejects(p.watchAd(), /尚未配置/);
});

test("music loops using one player and interruption respects mute", () => {
  let begins,
    ends,
    created = 0,
    plays = 0,
    pauses = 0;
  const audio = {
    play() {
      plays++;
    },
    pause() {
      pauses++;
    },
    onError() {},
  };
  const p = create(
    {
      createInnerAudioContext() {
        created++;
        return audio;
      },
      onAudioInterruptionBegin(f) {
        begins = f;
      },
      onAudioInterruptionEnd(f) {
        ends = f;
      },
    },
    {},
  );
  p.music(true);
  p.music(true);
  assert.equal(created, 1);
  assert.equal(plays, 1);
  assert.equal(audio.loop, true);
  assert.ok(audio.volume < 0.25);
  begins();
  assert.equal(pauses, 1);
  ends();
  assert.equal(plays, 2);
  p.music(false);
  begins();
  ends();
  assert.equal(plays, 2);
  p.music(true);
  assert.equal(created, 1);
  assert.equal(plays, 3);
});
