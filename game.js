const Platform = require("./src/platform");
const App = require("./src/app");
const canvas = wx.createCanvas();
const platform = Platform.create(wx, canvas);
function dimensions() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  return {
    width: info.windowWidth,
    height: info.windowHeight,
    dpr: Math.min(info.pixelRatio || 2, 3),
  };
}
const app = new App(platform, dimensions());
wx.onTouchStart((e) => {
  const t = e.touches[0];
  if (t) app.pointerDown(t.clientX, t.clientY);
});
wx.onTouchEnd((e) => {
  const t = e.changedTouches[0];
  if (t) app.pointerUp(t.clientX, t.clientY);
});
if (wx.onTouchCancel) wx.onTouchCancel(() => app.cancelPointer());
if (wx.onWindowResize) wx.onWindowResize(() => app.resize(dimensions()));
function frame(t) {
  app.draw(t || Date.now());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
