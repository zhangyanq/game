(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BoboConfig = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return {
    rewardedAdUnitId: "",
    storageKey: "bobo-aquarium-v1",
    title: "啵啵水族箱",
  };
});
