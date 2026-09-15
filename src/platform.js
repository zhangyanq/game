(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./config"));
  else root.BoboPlatform = factory(root.BoboConfig);
})(typeof globalThis !== "undefined" ? globalThis : this, function (config) {
  "use strict";
  function create(api, canvas) {
    const isWx = !!api;
    let audio = [],
      soundIndex = 0;
    function notice(message) {
      if (isWx) api.showToast({ title: message, icon: "none", duration: 2200 });
    }
    const p = {
      isWx,
      canvas,
      read() {
        try {
          return isWx
            ? api.getStorageSync(config.storageKey)
            : JSON.parse(localStorage.getItem(config.storageKey) || "null");
        } catch (e) {
          return null;
        }
      },
      write(data) {
        try {
          if (isWx) api.setStorageSync(config.storageKey, data);
          else localStorage.setItem(config.storageKey, JSON.stringify(data));
          return true;
        } catch (e) {
          notice("存档失败，请检查存储空间");
          return false;
        }
      },
      vibrate() {
        if (isWx && api.vibrateShort) api.vibrateShort({ type: "light" });
      },
      sound() {
        try {
          if (isWx) {
            if (!audio.length) {
              for (let i = 0; i < 3; i++) {
                let a = api.createInnerAudioContext();
                a.src = "assets/pop.wav";
                audio.push(a);
              }
            }
            let a = audio[soundIndex++ % 3];
            a.stop();
            a.play();
          } else {
            let a = new Audio("../assets/pop.wav");
            a.volume = 0.2;
            a.play().catch(() => {});
          }
        } catch (e) {}
      },
      hide(fn) {
        if (isWx) api.onHide(fn);
        else
          document.addEventListener("visibilitychange", () => {
            if (document.hidden) fn();
          });
      },
      show(fn) {
        if (isWx) api.onShow(fn);
        else
          document.addEventListener("visibilitychange", () => {
            if (!document.hidden) fn();
          });
      },
      hasAds: !!(isWx && config.rewardedAdUnitId && api.createRewardedVideoAd),
    };
    // One persistent player; user gesture starts browser audio, lifecycle pauses it.
    let music = null,
      musicWanted = false,
      musicPlaying = false,
      interrupted = false;
    p.music = function (enabled) {
      musicWanted = !!enabled;
      if (!musicWanted || interrupted) {
        if (music) {
          try {
            music.pause();
          } catch (e) {}
        }
        musicPlaying = false;
        return;
      }
      if (musicPlaying) return;
      try {
        if (!music) {
          music = isWx
            ? api.createInnerAudioContext()
            : new Audio("../assets/ocean-drift.wav");
          if (isWx) music.src = "assets/ocean-drift.wav";
          music.loop = true;
          music.volume = 0.16;
          if (isWx && music.onError)
            music.onError(() => {
              musicPlaying = false;
            });
        }
        musicPlaying = true;
        const result = music.play();
        if (result && result.then)
          result
            .then(() => {
              if (!musicWanted || interrupted) {
                music.pause();
                musicPlaying = false;
              }
            })
            .catch(() => {
              musicPlaying = false;
            });
      } catch (e) {
        musicPlaying = false;
      }
    };
    if (isWx && api.onAudioInterruptionBegin)
      api.onAudioInterruptionBegin(() => {
        interrupted = true;
        if (music) {
          try {
            music.pause();
          } catch (e) {}
        }
        musicPlaying = false;
      });
    if (isWx && api.onAudioInterruptionEnd)
      api.onAudioInterruptionEnd(() => {
        interrupted = false;
        p.music(musicWanted);
      });
    let ad = null,
      pending = null;
    p.watchAd = function () {
      if (!p.hasAds)
        return Promise.reject(
          Error(isWx ? "尚未配置激励视频广告位" : "浏览器预览不播放微信广告"),
        );
      if (pending) return Promise.reject(Error("广告正在加载中"));
      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
        try {
          if (!ad) {
            ad = api.createRewardedVideoAd({
              adUnitId: config.rewardedAdUnitId,
            });
            ad.onClose((res) => {
              if (!pending) return;
              const cb = pending;
              pending = null;
              if (res && res.isEnded === true) cb.resolve(true);
              else cb.reject(Error("完整观看后才会获得体力"));
            });
            ad.onError(() => fail("广告暂不可用，请稍后再试"));
          }
          ad.show()
            .catch(() => ad.load().then(() => ad.show()))
            .catch(() => fail("广告暂不可用，请稍后再试"));
        } catch (e) {
          fail("广告初始化失败");
        }
      });
    };
    function fail(msg) {
      if (!pending) return;
      const cb = pending;
      pending = null;
      cb.reject(Error(msg));
    }
    return p;
  }
  return { create };
});
