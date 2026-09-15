(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./core"));
  else root.BoboApp = factory(root.BoboCore);
})(typeof globalThis !== "undefined" ? globalThis : this, function (C) {
  "use strict";
  const COLORS = [
    "#f5a1d8",
    "#ffe393",
    "#ffac91",
    "#b8a6ff",
    "#83e5ce",
    "#bfe7ff",
  ];
  const NAMES = ["水母", "河豚", "海星", "章鱼", "贝壳", "珍珠"];
  const DECOR = [
    { name: "薄荷海草", cost: 30 },
    { name: "桃粉珊瑚", cost: 50 },
    { name: "月光水母", cost: 70 },
    { name: "珍珠贝屋", cost: 90 },
    { name: "小小沉船", cost: 110 },
    { name: "星星海葵", cost: 130 },
  ];
  class App {
    constructor(platform, size) {
      this.p = platform;
      this.canvas = platform.canvas;
      this.ctx = this.canvas.getContext("2d");
      this.profile = this.load();
      if (typeof this.profile.music !== "boolean") this.profile.music = true;
      this.musicUnlocked = false;
      this.scene = "home";
      this.buttons = [];
      this.selected = -1;
      this.modal = null;
      this.toastText = "";
      this.toastUntil = 0;
      this.particles = [];
      this.busy = false;
      this.hidden = false;
      this.animToken = 0;
      this.resize(size);
      C.sync(this.profile, Date.now());
      this.save();
      this.p.hide(() => {
        this.hidden = true;
        this.syncMusic();
        this.save();
      });
      this.p.show(() => {
        this.hidden = false;
        this.syncMusic();
        C.sync(this.profile, Date.now());
        this.save();
      });
    }
    load() {
      const raw = this.p.read();
      if (
        raw &&
        raw.version === 1 &&
        Number.isFinite(raw.energy) &&
        raw.energy >= 0 &&
        Number.isFinite(raw.recoveryAt) &&
        Array.isArray(raw.decor) &&
        Array.isArray(raw.completed) &&
        Number.isInteger(raw.unlocked) &&
        raw.unlocked >= 1 &&
        raw.unlocked <= 30 &&
        Number.isFinite(raw.shells)
      ) {
        if (
          raw.active &&
          (!Array.isArray(raw.active.board) ||
            raw.active.board.length !== 49 ||
            raw.active.board.some((c) => !c || !Number.isInteger(c.type)) ||
            !C.levels[raw.active.level - 1])
        )
          raw.active = null;
        return raw;
      }
      return C.fresh(Date.now());
    }
    save() {
      if (!this.p.write(this.profile)) {
        this.toastText = "存档失败，请检查可用存储空间";
        this.toastUntil = Date.now() + 4000;
      }
    }
    resize(s) {
      this.width = s.width;
      this.height = s.height;
      this.dpr = s.dpr || 1;
      this.canvas.width = Math.round(s.width * this.dpr);
      this.canvas.height = Math.round(s.height * this.dpr);
      this.scale = Math.min(s.width / 390, s.height / 844);
      this.ox = (s.width - 390 * this.scale) / 2;
      this.oy = (s.height - 844 * this.scale) / 2;
    }
    text(str, x, y, size, color, align, weight) {
      const g = this.ctx;
      g.font =
        (weight || "500") +
        " " +
        size +
        'px "PingFang SC", "Microsoft YaHei", sans-serif';
      g.textAlign = align || "left";
      g.textBaseline = "middle";
      g.fillStyle = color || "#efffff";
      g.fillText(str, x, y);
    }
    round(x, y, w, h, r) {
      const g = this.ctx;
      r = Math.min(r, w / 2, h / 2);
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    }
    box(x, y, w, h, r, fill, stroke) {
      this.round(x, y, w, h, r);
      this.ctx.fillStyle = fill;
      this.ctx.fill();
      if (stroke) {
        this.ctx.strokeStyle = stroke;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }
    }
    circle(x, y, r, color) {
      const g = this.ctx;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
    }
    line(x, y, x2, y2, color, width) {
      const g = this.ctx;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x2, y2);
      g.strokeStyle = color;
      g.lineWidth = width || 1;
      g.stroke();
    }
    gradient(x, y, w, h, a, b) {
      const gr = this.ctx.createLinearGradient(x, y, x + w, y + h);
      gr.addColorStop(0, a);
      gr.addColorStop(1, b);
      return gr;
    }
    button(id, x, y, w, h, label, fn, style) {
      style = style || {};
      this.box(
        x,
        y,
        w,
        h,
        style.radius || 18,
        style.fill || this.gradient(x, y, w, h, "#bdffe0", "#7fe4d9"),
        style.stroke,
      );
      this.text(
        label,
        x + w / 2,
        y + h / 2,
        style.size || 16,
        style.color || "#123b43",
        "center",
        "600",
      );
      if (!style.disabled) this.buttons.push({ id, x, y, w, h, fn });
    }
    iconButton(id, x, y, label, fn) {
      this.button(id, x, y, 38, 38, "", fn, {
        fill: "rgba(181,232,243,.07)",
        stroke: "rgba(181,232,243,.12)",
        color: "#d5f2f7",
        size: 20,
        radius: 14,
      });
      const c = "#c8e7e8";
      if (label === "×") {
        this.line(x + 14, y + 14, x + 24, y + 24, c, 1.5);
        this.line(x + 24, y + 14, x + 14, y + 24, c, 1.5);
      } else if (label === "‹") {
        this.line(x + 22, y + 13, x + 16, y + 19, c, 1.5);
        this.line(x + 16, y + 19, x + 22, y + 25, c, 1.5);
      } else {
        for (let n = 0; n < 3; n++) {
          this.line(x + 12, y + 13 + n * 6, x + 26, y + 13 + n * 6, c, 1.3);
          this.circle(x + (n === 1 ? 22 : 16), y + 13 + n * 6, 2, c);
        }
      }
    }
    critter(type, x, y, size, special, phase) {
      const g = this.ctx;
      g.save();
      g.translate(x, y);
      g.scale(size / 48, size / 48);
      if (special === "coin" || special === "nest") {
        this.circle(0, 0, 18, special === "coin" ? "#9eafbc" : "#96785d");
        this.circle(0, 0, 14, special === "coin" ? "#dbe7eb" : "#c2a57c");
        if (special === "coin") {
          this.line(-5, -9, -5, 9, "#8396a4", 2);
          this.line(5, -9, 5, 9, "#8396a4", 2);
          this.line(-9, -3, 9, -3, "#8396a4", 2);
          this.line(-9, 3, 9, 3, "#8396a4", 2);
        } else {
          for (let k = 0; k < 4; k++)
            this.line(-15, -8 + k * 5, 15, -3 + k * 5, "#725a43", 2);
          this.circle(-5, -3, 5, "#fff1cc");
          this.circle(5, -5, 5, "#fff1cc");
        }
        g.restore();
        return;
      }
      const color = type < 0 ? "#ffe19a" : COLORS[type];
      g.shadowColor = color;
      g.shadowBlur = 7;
      g.fillStyle = this.gradient(-15, -20, 32, 42, "#ffffff", color);
      g.strokeStyle = color;
      g.lineWidth = 1.5;
      g.beginPath();
      if (special === "fish") {
        g.moveTo(-10, 0);
        g.lineTo(-25, -11);
        g.lineTo(-25, 11);
        g.closePath();
        g.fill();
        g.beginPath();
        g.ellipse(1, 0, 17, 12, 0, 0, Math.PI * 2);
      } else if (type === 0) {
        g.moveTo(-18, 5);
        g.bezierCurveTo(-23, -24, 23, -24, 18, 5);
        g.quadraticCurveTo(11, 11, 5, 5);
        g.quadraticCurveTo(0, 12, -6, 5);
        g.quadraticCurveTo(-13, 12, -18, 5);
      } else if (type === 1) {
        for (let i = 0; i < 24; i++) {
          let a = (i * Math.PI) / 12,
            r = i % 2 ? 17 : 21;
          i
            ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
            : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
      } else if (type === 2) {
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5 - Math.PI / 2,
            r = i % 2 ? 11 : 23;
          i
            ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
            : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
      } else if (type === 3) {
        g.moveTo(-18, 6);
        g.bezierCurveTo(-24, -24, 24, -24, 18, 6);
        g.lineTo(20, 17);
        g.quadraticCurveTo(14, 23, 10, 12);
        g.quadraticCurveTo(6, 26, 0, 13);
        g.quadraticCurveTo(-6, 26, -10, 12);
        g.quadraticCurveTo(-18, 23, -20, 17);
        g.closePath();
      } else if (type === 4) {
        g.moveTo(-4, 19);
        g.bezierCurveTo(-30, 2, -25, -11, -17, -11);
        g.bezierCurveTo(-17, -24, -6, -22, 0, -16);
        g.bezierCurveTo(7, -24, 18, -23, 18, -11);
        g.bezierCurveTo(28, -11, 28, 3, 4, 19);
        g.closePath();
      } else {
        g.arc(0, 0, 18, 0, Math.PI * 2);
      }
      g.fill();
      g.stroke();
      g.shadowBlur = 0;
      if (type === 0 && special !== "fish") {
        g.strokeStyle = color;
        g.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          g.beginPath();
          g.moveTo(i * 10, 9);
          g.quadraticCurveTo(
            i * 10 + 4,
            18,
            i * 10 + Math.sin(phase || 0) * 3,
            22,
          );
          g.stroke();
        }
      }
      if (type === 4) {
        for (let i = -1; i <= 1; i++)
          this.line(i * 10, -9, i * 3, 14, "rgba(28,119,108,.22)", 1);
      }
      this.circle(-6, -2, 2, "#18394b");
      this.circle(6, -2, 2, "#18394b");
      this.circle(-10, 4, 2.8, "rgba(237,120,157,.4)");
      this.circle(10, 4, 2.8, "rgba(237,120,157,.4)");
      g.beginPath();
      g.arc(0, 2, 3, 0.1, Math.PI - 0.1);
      g.strokeStyle = "#31546b";
      g.lineWidth = 1.1;
      g.stroke();
      g.beginPath();
      g.ellipse(-6, -11, 5, 2.5, -0.3, 0, Math.PI * 2);
      g.fillStyle = "rgba(255,255,255,.65)";
      g.fill();
      if (special === "dye") {
        for (let k = 0; k < 6; k++)
          this.circle(
            Math.cos((k * Math.PI) / 3) * 18,
            Math.sin((k * Math.PI) / 3) * 18,
            3,
            COLORS[k],
          );
      }
      if (special === "chick") {
        g.beginPath();
        g.moveTo(-4, 2);
        g.lineTo(4, 2);
        g.lineTo(0, 7);
        g.closePath();
        g.fillStyle = "#efa456";
        g.fill();
        this.line(0, -17, 3, -23, "#ffe293", 3);
      }
      if (["row", "col", "bomb", "rainbow"].includes(special)) {
        if (special === "rainbow") {
          g.strokeStyle = "#fff9d0";
          g.lineWidth = 2;
          g.beginPath();
          g.arc(0, 0, 23, 0, Math.PI * 2);
          g.stroke();
          for (let n = 0; n < 6; n++)
            this.circle(
              Math.cos((n * Math.PI) / 3) * 23,
              Math.sin((n * Math.PI) / 3) * 23,
              3,
              COLORS[n],
            );
        } else {
          this.box(-11, 10, 22, 13, 6, "#244363");
          if (special === "row") {
            this.line(-7, 17, 7, 17, "#fff", 1.5);
            this.line(4, 14, 7, 17, "#fff", 1.5);
            this.line(-4, 20, -7, 17, "#fff", 1.5);
          } else if (special === "col") {
            this.line(0, 12, 0, 22, "#fff", 1.5);
            this.line(-3, 15, 0, 12, "#fff", 1.5);
            this.line(3, 19, 0, 22, "#fff", 1.5);
          } else {
            g.beginPath();
            g.moveTo(0, 12);
            g.lineTo(4, 17);
            g.lineTo(0, 22);
            g.lineTo(-4, 17);
            g.closePath();
            g.fillStyle = "#fff";
            g.fill();
          }
        }
      }
      g.restore();
    }
    background(t) {
      const g = this.ctx;
      g.fillStyle = this.gradient(0, 0, 390, 844, "#102d43", "#071827");
      g.fillRect(0, 0, 390, 844);
      let glow = g.createRadialGradient(300, 300, 5, 300, 300, 290);
      glow.addColorStop(0, "rgba(50,157,156,.13)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, 390, 844);
      for (let i = 0; i < 20; i++) {
        const x = (i * 83 + 27) % 390,
          y = (i * 97 + 844 - t * (0.004 + (i % 3) * 0.002)) % 844;
        g.strokeStyle = "rgba(161,231,239," + (0.05 + (i % 4) * 0.022) + ")";
        g.beginPath();
        g.arc(x, y, 2 + (i % 4), 0, Math.PI * 2);
        g.stroke();
      }
      this.text(
        "BOBO  /  A LITTLE OCEAN OF YOUR OWN",
        195,
        817,
        8,
        "#527588",
        "center",
        "600",
      );
    }
    header(label) {
      const g = this.ctx;
      g.beginPath();
      g.arc(35, 64, 8, 0, Math.PI * 2);
      g.strokeStyle = "#adf1db";
      g.lineWidth = 1.4;
      g.stroke();
      this.circle(38, 61, 2, "#adf1db");
      this.text(label || "BOBO AQUARIUM", 53, 65, 11, "#b3d8de", "left", "600");
      this.iconButton(
        "settings",
        324,
        94,
        "☷",
        () => (this.modal = { type: "settings" }),
      );
    }
    energyPill(x, y) {
      this.box(
        x,
        y,
        92,
        32,
        16,
        "rgba(133,234,217,.08)",
        "rgba(133,234,217,.16)",
      );
      const g = this.ctx;
      g.beginPath();
      g.moveTo(x + 17, y + 24);
      g.bezierCurveTo(x + 1, y + 12, x + 12, y + 4, x + 17, y + 13);
      g.bezierCurveTo(x + 22, y + 4, x + 33, y + 12, x + 17, y + 24);
      g.strokeStyle = "#a9f2d8";
      g.lineWidth = 1.2;
      g.stroke();
      this.text(
        this.profile.energy + " / 5",
        x + 56,
        y + 16,
        13,
        "#d9fff3",
        "center",
        "600",
      );
      this.buttons.push({
        id: "energy",
        x,
        y,
        w: 92,
        h: 32,
        fn: () => (this.modal = { type: "energy" }),
      });
    }
    reef(x, y, w, h, t, large) {
      const g = this.ctx;
      g.save();
      this.round(x, y, w, h, 30);
      g.clip();
      g.fillStyle = this.gradient(x, y, w, h, "#183e56", "#0c283b");
      g.fillRect(x, y, w, h);
      const light = g.createRadialGradient(
        x + w * 0.6,
        y + h * 0.2,
        3,
        x + w * 0.6,
        y + h * 0.2,
        w * 0.7,
      );
      light.addColorStop(0, "rgba(104,239,216,.2)");
      light.addColorStop(1, "rgba(20,30,60,0)");
      g.fillStyle = light;
      g.fillRect(x, y, w, h);
      for (let j = 0; j < 3; j++) {
        g.beginPath();
        g.moveTo(x + w * (0.25 + j * 0.3), y);
        g.lineTo(x + w * (0.05 + j * 0.3), y + h);
        g.lineTo(x + w * (0.23 + j * 0.3), y + h);
        g.lineTo(x + w * (0.32 + j * 0.3), y);
        g.fillStyle = "rgba(190,249,255,.025)";
        g.fill();
      }
      g.fillStyle = "#1c4654";
      g.beginPath();
      g.ellipse(x + w / 2, y + h + 12, w * 0.7, 43, 0, 0, Math.PI * 2);
      g.fill();
      for (let k = 0; k < 8; k++) {
        const xx = x + 12 + (k * w) / 7;
        g.strokeStyle = k % 2 ? "#367f7e" : "#235963";
        g.lineWidth = 5 - (k % 3);
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(xx, y + h);
        g.bezierCurveTo(
          xx - 17,
          y + h - 24,
          xx + 14,
          y + h - 32,
          xx + Math.sin(t / 1800 + k) * 7,
          y + h - 48 - (k % 3) * 11,
        );
        g.stroke();
      }
      const owned = this.profile.decor;
      owned.forEach((id, j) => {
        if (id === 0 || id === 1 || id === 5) {
          let xx = x + w * (0.2 + j * 0.11);
          g.strokeStyle = id === 1 ? "#d28fa4" : "#81c5bb";
          g.lineWidth = 5;
          for (let z = -1; z <= 1; z++) {
            g.beginPath();
            g.moveTo(xx, y + h - 10);
            g.quadraticCurveTo(
              xx + z * 22,
              y + h - 30,
              xx + z * 20,
              y + h - 67,
            );
            g.stroke();
          }
        }
        if (id === 3) this.critter(4, x + w * 0.72, y + h - 31, 48);
        if (id === 4) {
          this.box(x + w * 0.35, y + h - 38, 65, 22, 9, "#9b856f");
          this.line(
            x + w * 0.44,
            y + h - 35,
            x + w * 0.44,
            y + h - 70,
            "#bba58a",
            3,
          );
        }
      });
      const bob = Math.sin(t / 1300) * 6;
      this.critter(
        0,
        x + w * 0.55,
        y + h * 0.35 + bob,
        large ? 96 : 82,
        null,
        t / 600,
      );
      this.critter(1, x + w * 0.23, y + h * 0.53 - bob * 0.7, large ? 67 : 58);
      this.critter(3, x + w * 0.76, y + h * 0.68 + bob * 0.8, large ? 69 : 58);
      if (owned.includes(2))
        this.critter(0, x + w * 0.24, y + h * 0.25 - bob, 43);
      for (let i = 0; i < 9; i++) {
        let bx = x + 15 + ((i * 37) % w),
          by = y + h - ((i * 53 + t * 0.015) % h);
        g.beginPath();
        g.arc(bx, by, 2 + (i % 3), 0, Math.PI * 2);
        g.strokeStyle = "rgba(185,237,239,.18)";
        g.lineWidth = 1;
        g.stroke();
      }
      g.restore();
      this.round(x, y, w, h, 30);
      g.strokeStyle = "rgba(157,223,224,.22)";
      g.stroke();
    }
    home(t) {
      this.header();
      this.text("把今天，", 27, 125, 29, "#f1f8ef", "left", "600");
      this.text("过成一片小海洋。", 27, 164, 29, "#f1f8ef", "left", "600");
      this.text("交换 · 消除 · 收集一点点快乐", 28, 203, 12, "#91b1bf");
      this.reef(24, 232, 342, 284, t, false);
      this.box(
        40,
        248,
        104,
        25,
        12,
        "rgba(7,30,45,.58)",
        "rgba(196,242,239,.13)",
      );
      this.text("YOUR LITTLE OCEAN", 92, 261, 8, "#d4eee7", "center");
      this.text("浅海来信", 44, 470, 20, "#effbf1", "left", "600");
      this.text("每一次消除，都让海洋亮一点", 44, 493, 10, "#a8c8cc");
      this.energyPill(28, 535);
      this.text("贝壳  " + this.profile.shells, 148, 551, 13, "#e6d6ae");
      this.button(
        "daily",
        267,
        535,
        95,
        32,
        this.profile.dailyClaimed ? "今日已领取" : "领取 +3",
        () => {
          if (C.claim(this.profile, Date.now())) {
            this.save();
            this.toast("今日补给 +3 体力");
          }
        },
        {
          fill: "rgba(201,240,222,.09)",
          color: this.profile.dailyClaimed ? "#617f8c" : "#bdf4d8",
          size: 12,
          radius: 14,
          disabled: this.profile.dailyClaimed,
        },
      );
      const active = this.profile.active;
      const id = active ? active.level : this.profile.unlocked;
      this.button(
        "start",
        28,
        589,
        334,
        60,
        (active ? "继续第 " + id + " 关" : "潜入第 " + id + " 关") + "    →",
        () => this.start(id),
      );
      this.text(
        active
          ? "上次的海洋冒险，正在等你"
          : "通关不扣体力 · 每一关都是新的小发现",
        195,
        669,
        11,
        "#8cadba",
        "center",
      );
      this.button(
        "levels",
        28,
        705,
        158,
        54,
        "关卡地图",
        () => (this.scene = "levels"),
        {
          fill: "rgba(157,204,220,.055)",
          stroke: "rgba(157,204,220,.14)",
          color: "#d0e4e9",
          size: 14,
        },
      );
      this.button(
        "aquarium",
        204,
        705,
        158,
        54,
        "我的水族箱",
        () => (this.scene = "aquarium"),
        {
          fill: "rgba(157,204,220,.055)",
          stroke: "rgba(157,204,220,.14)",
          color: "#d0e4e9",
          size: 14,
        },
      );
    }
    start(id) {
      C.sync(this.profile, Date.now());
      if (this.profile.active && this.profile.active.level !== id) {
        this.modal = { type: "abandon", next: id };
        return;
      }
      if (!this.profile.active) {
        if (this.profile.energy < 1) {
          this.modal = { type: "energy" };
          return;
        }
        this.profile.active = C.createLevel(id);
        this.save();
      }
      this.game = C.ensure(this.profile.active);
      this.displayBoard = null;
      this.scene = "game";
      this.modal = null;
      this.selected = -1;
      if (this.game.status === "won") this.finish();
      else if (this.game.status === "lost") this.finish();
    }
    startFresh(id) {
      this.profile.active = null;
      this.start(id);
    }
    finish() {
      if (!this.game || this.game.settled) return;
      const s = this.game;
      s.settled = true;
      if (s.status === "won") {
        const first = !this.profile.completed.includes(s.level);
        this.winReward = first ? 20 : 5;
        this.profile.shells += this.winReward;
        if (first) this.profile.completed.push(s.level);
        this.profile.unlocked = Math.max(
          this.profile.unlocked,
          Math.min(30, s.level + 1),
        );
        this.modal = { type: "won", reward: this.winReward };
      } else {
        C.spend(this.profile, Date.now());
        this.modal = { type: "lost" };
      }
      this.profile.active = null;
      this.save();
    }
    backGame() {
      this.modal = { type: "pause" };
    }
    levels(t) {
      this.header("OCEAN ATLAS");
      this.text("沿着星光，往前游", 27, 125, 25, "#f0f6ef", "left", "600");
      this.text("30 个小小挑战 · 从浅海到星潮之夜", 28, 163, 12, "#8cabb9");
      this.iconButton("back", 28, 741, "‹", () => (this.scene = "home"));
      for (let i = 0; i < 30; i++) {
        const x = 28 + (i % 5) * 69,
          y = 205 + Math.floor(i / 5) * 77,
          open = i + 1 <= this.profile.unlocked,
          done = this.profile.completed.includes(i + 1);
        this.box(
          x,
          y,
          58,
          60,
          18,
          done
            ? "rgba(130,228,201,.13)"
            : open
              ? "#274f61"
              : "rgba(161,196,207,.035)",
          open ? "rgba(157,239,220,.32)" : "rgba(157,204,220,.07)",
        );
        this.text(
          open ? String(i + 1) : "·",
          x + 29,
          y + 25,
          19,
          open ? "#e3fff1" : "#486775",
          "center",
          "600",
        );
        this.text(
          done ? "已完成" : open ? "出发" : "未解锁",
          x + 29,
          y + 45,
          8,
          done ? "#a4e6bf" : "#658b9a",
          "center",
        );
        if (open)
          this.buttons.push({
            id: "level-" + (i + 1),
            x,
            y,
            w: 58,
            h: 60,
            fn: () => this.start(i + 1),
          });
      }
      this.text("完成上一关，解锁下一片海", 195, 719, 11, "#7899a8", "center");
    }
    aquarium(t) {
      this.header("MY LITTLE OCEAN");
      this.text("属于你的，一小片海", 27, 124, 25, "#f1f8ef", "left", "600");
      this.text("通关收集贝壳，把喜欢的东西留在这里", 28, 161, 11, "#92aebb");
      this.reef(24, 189, 342, 277, t, true);
      this.text("海底小铺", 28, 499, 19, "#e7f7ef", "left", "600");
      this.text(
        "贝壳 " + this.profile.shells,
        362,
        499,
        13,
        "#e6d6ae",
        "right",
      );
      for (let i = 0; i < 6; i++) {
        const d = DECOR[i],
          owned = this.profile.decor.includes(i),
          x = 28 + (i % 3) * 114,
          y = 528 + Math.floor(i / 3) * 95;
        this.box(
          x,
          y,
          106,
          84,
          17,
          "rgba(171,215,224,.05)",
          "rgba(171,215,224,.13)",
        );
        this.critter(i, x + 22, y + 24, 24);
        this.text(d.name, x + 58, y + 25, 10, "#d1e8e8", "center");
        this.button(
          "buy-" + i,
          x + 8,
          y + 48,
          90,
          26,
          owned ? "已放入水族箱" : d.cost + " 贝壳",
          () => {
            if (owned) return;
            if (this.profile.shells < d.cost) {
              this.toast("贝壳还不够，去闯关收集吧");
              return;
            }
            this.profile.shells -= d.cost;
            this.profile.decor.push(i);
            this.save();
            this.toast(d.name + "已放入水族箱");
          },
          {
            fill: owned ? "rgba(141,221,194,.03)" : "rgba(141,221,194,.12)",
            color: owned ? "#688f8b" : "#b9ead5",
            size: 10,
            radius: 10,
            disabled: owned,
          },
        );
      }
      this.iconButton("back", 28, 748, "‹", () => (this.scene = "home"));
      this.text("小小收藏，慢慢填满", 195, 767, 11, "#708f9e", "center");
    }
    gameView(t) {
      const s = this.game,
        l = C.levels[s.level - 1];
      this.iconButton("pause", 24, 48, "‹", () => this.backGame());
      this.text(
        "第 " + String(s.level).padStart(2, "0") + " 关",
        78,
        61,
        16,
        "#ecf6f0",
        "left",
        "600",
      );
      this.text(l.title, 78, 81, 10, "#7da4b5");
      this.energyPill(28, 215);
      this.box(
        24,
        110,
        342,
        93,
        23,
        "rgba(153,206,222,.055)",
        "rgba(153,206,222,.14)",
      );
      const progress =
        this.visualProgress === undefined ? s.progress : this.visualProgress;
      this.text(
        l.kind === "collect"
          ? "收集" + NAMES[l.type]
          : l.kind === "sand"
            ? "清理海底沙层"
            : "救出小鱼",
        44,
        136,
        12,
        "#a0bac5",
      );
      if (l.kind === "collect") this.critter(l.type, 57, 171, 26);
      else if (l.kind === "rescue") this.critter(-1, 57, 171, 26, "fish");
      else {
        this.box(46, 160, 22, 22, 6, "#a28e67");
        this.circle(51, 175, 1, "#e8d9b3");
        this.circle(59, 166, 1.5, "#e8d9b3");
      }
      this.text(
        Math.min(progress, C.need(s)) + " / " + C.need(s),
        81,
        171,
        23,
        "#e5fff3",
        "left",
        "600",
      );
      this.line(248, 129, 248, 184, "rgba(150,196,211,.14)");
      this.text("剩余步数", 303, 135, 11, "#9eb8c2", "center");
      this.text(
        String(this.visualLeft === undefined ? s.left : this.visualLeft),
        303,
        169,
        30,
        s.left <= 5 ? "#ffbbac" : "#f6edd3",
        "center",
        "600",
      );
      this.text(
        s.level === 1
          ? "点击相邻伙伴，连成三个"
          : s.belt.length
            ? "传送带：每两步移动一次"
            : s.vines.some(Boolean)
              ? "藤蔓：命中后解除束缚"
              : s.ice.some(Boolean)
                ? "冰块：每次消除减一层"
                : "四连冲浪 · 五连魔力",
        143,
        231,
        11,
        "#94b7c3",
      );
      this.box(24, 259, 342, 342, 27, "#0e263a", "rgba(156,220,229,.20)");
      this.drawBoard(t, s);
      const ratio = Math.min(1, progress / C.need(s));
      this.box(28, 621, 334, 5, 3, "#203d4b");
      if (ratio > 0)
        this.box(28, 621, Math.max(5, 334 * ratio), 5, 3, "#b1eccf");
      this.text(
        "海洋亮度 " + Math.round(ratio * 100) + "%",
        28,
        647,
        11,
        "#8eacb6",
      );
      this.text(
        "得分 " + (this.visualScore === undefined ? s.score : this.visualScore),
        362,
        647,
        11,
        "#bccecb",
        "right",
      );
      this.button(
        "hint",
        28,
        683,
        158,
        48,
        "找个灵感",
        () => {
          if (this.busy) return;
          this.hintPair = C.moves(s)[0];
          this.hintUntil = Date.now() + 2200;
          this.toast("试试交换发光的两个伙伴");
        },
        {
          fill: "rgba(171,215,224,.06)",
          stroke: "rgba(171,215,224,.13)",
          color: "#cee8e6",
          size: 13,
        },
      );
      this.button(
        "help",
        204,
        683,
        158,
        48,
        "?  玩法图鉴",
        () => (this.modal = { type: "help" }),
        {
          fill: "rgba(171,215,224,.06)",
          stroke: "rgba(171,215,224,.13)",
          color: "#cee8e6",
          size: 13,
        },
      );
      const leftClear = Math.max(0, 2 - (this.profile.clearAds || 0));
      this.button(
        "ad-clear",
        28,
        744,
        334,
        44,
        this.adLoading
          ? "广告加载中…"
          : !leftClear
            ? "今日清屏次数已用完"
            : this.profile.ads >= 5
              ? "今日广告总次数已用完"
              : "看广告清除全屏  ·  " + leftClear + "/2",
        () => this.watchClearAd(),
        {
          fill:
            leftClear && this.profile.ads < 5
              ? "rgba(166,230,206,.14)"
              : "rgba(120,150,170,.06)",
          stroke: "rgba(166,230,206,.20)",
          color: "#c7ecdb",
          size: 13,
          disabled:
            this.busy || this.adLoading || !leftClear || this.profile.ads >= 5,
        },
      );
    }
    drawBoard(t, s) {
      C.ensure(s);
      const g = this.ctx,
        b = this.displayBoard || s.board,
        overlay = this.visualOverlay || s;
      const anim = this.animation,
        raw = anim
          ? Math.min(1, (Date.now() - anim.started) / anim.duration)
          : 0;
      const moving = new Set();
      if (anim && anim.kind === "swap") {
        moving.add(anim.a);
        moving.add(anim.b);
      }
      if (anim && ["fall", "belt"].includes(anim.kind))
        anim.motions.forEach((m) => moving.add(m.to));
      const vanishing =
        anim && anim.kind === "clear"
          ? new Set(anim.frame.removed.map((c) => c.index))
          : new Set();
      for (let i = 0; i < 49; i++) {
        const x = 34 + (i % 7) * 46,
          y = 269 + Math.floor(i / 7) * 46;
        this.box(
          x + 1,
          y + 1,
          44,
          44,
          12,
          overlay.sand[i]
            ? "rgba(198,169,115,.29)"
            : (i + Math.floor(i / 7)) % 2
              ? "rgba(125,182,203,.08)"
              : "rgba(125,182,203,.045)",
        );
        if (overlay.sand[i]) {
          this.circle(x + 8, y + 35, 1, "#bca06f");
          this.circle(x + 32, y + 9, 1, "#bca06f");
        }
        if (s.belt.includes(i)) {
          this.box(
            x + 3,
            y + 3,
            40,
            40,
            10,
            "rgba(97,149,176,.10)",
            "rgba(155,212,229,.25)",
          );
          this.line(x + 10, y + 40, x + 34, y + 40, "#78a5b7", 1.5);
        }
        if (
          i === this.selected ||
          (this.hintPair &&
            this.hintPair.includes(i) &&
            Date.now() < this.hintUntil)
        )
          this.box(
            x + 1,
            y + 1,
            44,
            44,
            12,
            "rgba(159,244,212,.13)",
            "#baf5d9",
          );
      }
      g.save();
      this.round(33, 268, 324, 324, 14);
      g.clip();
      for (let i = 0; i < 49; i++) {
        if (!b[i] || moving.has(i)) continue;
        let size = 38,
          alpha = 1;
        if (vanishing.has(i)) {
          const u = anim.frame.effects.some((e) => e.kind === "all")
            ? Math.max(0, (raw - 0.5) * 2)
            : raw;
          size *= Math.max(0.02, 1 + 0.14 * Math.sin(u * Math.PI) - u * 0.95);
          alpha = 1 - u;
        }
        g.globalAlpha = alpha;
        this.critter(
          b[i].type,
          57 + (i % 7) * 46,
          292 + Math.floor(i / 7) * 46,
          size,
          b[i].special,
          t / 700 + i,
        );
        g.globalAlpha = 1;
        if (b[i].special === "nest") {
          for (let n = 0; n < (b[i].hp || 1); n++)
            this.circle(
              53 + (i % 7) * 46 + n * 8,
              307 + Math.floor(i / 7) * 46,
              2,
              "#ffdea3",
            );
        }
      }
      if (anim && anim.kind === "transform") {
        for (const i of anim.frame.converted) {
          const x = 57 + (i % 7) * 46,
            y = 292 + Math.floor(i / 7) * 46;
          g.beginPath();
          g.arc(x, y, 19 + Math.sin(raw * Math.PI) * 5, 0, Math.PI * 2);
          g.strokeStyle = "#e7fbd7";
          g.lineWidth = 1 + Math.sin(raw * Math.PI) * 2;
          g.stroke();
        }
      }
      if (anim && anim.kind === "swap") {
        const smooth = raw * raw * (3 - 2 * raw),
          p = anim.reverse ? 1 - smooth : smooth;
        for (const [from, to, sign] of [
          [anim.a, anim.b, 1],
          [anim.b, anim.a, -1],
        ]) {
          const c = b[from];
          if (!c) continue;
          const fx = from % 7,
            fy = Math.floor(from / 7),
            dx = (to % 7) - fx,
            dy = Math.floor(to / 7) - fy,
            arc = Math.sin(p * Math.PI) * 3 * sign;
          const x = 57 + (fx + dx * p) * 46 - dy * arc,
            y = 292 + (fy + dy * p) * 46 + dx * arc;
          g.shadowColor = "#b4fff0";
          g.shadowBlur = 12;
          this.critter(
            c.type,
            x,
            y,
            38 + Math.sin(p * Math.PI) * 2,
            c.special,
            t / 700,
          );
          g.shadowBlur = 0;
        }
      }
      if (anim && ["fall", "belt"].includes(anim.kind)) {
        for (const m of anim.motions) {
          const fromCol = ((m.from % 7) + 7) % 7,
            fromRow = Math.floor(m.from / 7),
            delay = anim.kind === "fall" ? (m.to % 7) * 0.015 : 0,
            u = Math.max(0, Math.min(1, (raw - delay) / (1 - delay))),
            p =
              anim.kind === "belt"
                ? u * u * (3 - 2 * u)
                : 1 - Math.pow(1 - u, 3),
            x = 57 + (fromCol + ((m.to % 7) - fromCol) * p) * 46,
            y =
              292 +
              (fromRow + (Math.floor(m.to / 7) - fromRow) * p) * 46 -
              (anim.kind === "fall" && fromRow !== Math.floor(m.to / 7)
                ? Math.sin((Math.max(0, u - 0.78) / 0.22) * Math.PI) * 2
                : 0);
          g.save();
          if (m.clipTop !== undefined) {
            g.beginPath();
            g.rect(
              34 + (m.to % 7) * 46,
              269 + m.clipTop * 46,
              46,
              (m.clipBottom - m.clipTop + 1) * 46,
            );
            g.clip();
          }
          this.critter(m.cell.type, x, y, 38, m.cell.special, t / 700);
          g.restore();
        }
      }
      for (let i = 0; i < 49; i++) {
        const x = 34 + (i % 7) * 46,
          y = 269 + Math.floor(i / 7) * 46;
        if (overlay.ice[i] > 0) {
          const n = Math.min(3, overlay.ice[i]);
          this.box(
            x + 3,
            y + 3,
            40,
            40,
            11,
            "rgba(153,221,255," + (0.06 + n * 0.025) + ")",
            "rgba(175,231,255,.6)",
          );
          this.line(x + 7, y + 16, x + 18, y + 6, "rgba(232,252,255,.7)", 1);
          for (let k = 0; k < n; k++)
            this.circle(x + 28 + k * 5, y + 37, 1.5, "#e4faff");
        }
        if (overlay.vines[i]) {
          g.strokeStyle = "#76bca2";
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(x + 5, y + 6);
          g.bezierCurveTo(x + 34, y + 4, x + 9, y + 41, x + 40, y + 36);
          g.stroke();
          g.beginPath();
          g.moveTo(x + 6, y + 36);
          g.bezierCurveTo(x + 36, y + 40, x + 8, y + 3, x + 39, y + 6);
          g.stroke();
          this.circle(x + 13, y + 14, 3, "#b1dca9");
        }
      }
      if (anim && anim.kind === "clear") {
        const staged = anim.frame.effects.some((e) => e.kind === "all");
        const pulse = Math.sin(raw * Math.PI);
        for (const e of anim.frame.effects) {
          const local = staged
            ? e.kind === "all"
              ? Math.max(0, (raw - 0.5) * 2)
              : Math.min(1, raw * 2)
            : raw;
          g.globalAlpha = Math.sin(local * Math.PI) * 0.75;
          const cells = e.cells || [];
          if (e.kind === "line" && cells.length) {
            const positions = cells.map((i) =>
                e.axis === "row" ? i % 7 : Math.floor(i / 7),
              ),
              lo = Math.min(...positions),
              hi = Math.max(...positions);
            const x1 =
                e.axis === "row" ? 57 + lo * 46 : 57 + (e.origin % 7) * 46,
              y1 =
                e.axis === "row"
                  ? 292 + Math.floor(e.origin / 7) * 46
                  : 292 + lo * 46,
              x2 = e.axis === "row" ? 57 + hi * 46 : x1,
              y2 = e.axis === "row" ? y1 : 292 + hi * 46;
            this.line(x1, y1, x2, y2, "#9effe6", 9 * pulse + 1);
            this.line(x1, y1, x2, y2, "#f0fff9", 2);
          } else {
            for (const i of cells) {
              const x = 34 + (i % 7) * 46,
                y = 269 + Math.floor(i / 7) * 46;
              this.box(
                x + 2,
                y + 2,
                42,
                42,
                11,
                e.kind === "all"
                  ? "rgba(255,246,205,.35)"
                  : e.kind === "area"
                    ? "rgba(229,177,255,.27)"
                    : "rgba(171,233,255,.27)",
              );
            }
          }
        }
        g.globalAlpha = 1;
      }
      g.restore();
      if (anim && anim.kind === "clear" && anim.frame.name)
        this.text(anim.frame.name, 195, 614, 12, "#d6f7e0", "center", "600");
    }
    async animate(kind, data, duration) {
      this.animation = { kind, ...data, started: Date.now(), duration };
      await new Promise((r) => setTimeout(r, duration));
      this.animation = null;
    }
    async doSwap(a, b) {
      if (
        this.busy ||
        !this.game ||
        this.game.status !== "playing" ||
        !C.adjacent(a, b)
      )
        return;
      if (!C.movable(this.game, a) || !C.movable(this.game, b)) {
        this.toast("先清除藤蔓或固定障碍，再交换这里");
        return;
      }
      this.selected = -1;
      this.hintPair = null;
      this.busy = true;
      this.displayBoard = C.clone(this.game.board);
      this.visualProgress = this.game.progress;
      this.visualScore = this.game.score;
      this.visualLeft = this.game.left;
      this.visualOverlay = {
        sand: this.game.sand.slice(),
        ice: C.ensure(this.game).ice.slice(),
        vines: this.game.vines.slice(),
      };
      const result = C.play(this.game, a, b);
      if (result.valid) this.save();
      await this.animate("swap", { a, b }, 210);
      if (!result.valid) {
        await this.animate("swap", { a, b, reverse: true }, 190);
        this.toast("没有连成三个，已轻轻换回原位");
      } else {
        this.displayBoard = result.swappedBoard;
        this.visualLeft = this.game.left;
        await this.playFrames(result.frames);
      }
      this.animation = null;
      this.displayBoard = null;
      this.visualProgress = undefined;
      this.visualScore = undefined;
      this.visualLeft = undefined;
      this.visualOverlay = null;
      this.busy = false;
      this.save();
      if (result.shuffled) this.toast("没有可行交换，潮汐已重新排列棋盘");
      if (this.game.status !== "playing") this.finish();
    }
    async playFrames(frames) {
      for (let n = 0; n < frames.length; n++) {
        const f = frames[n];
        if (f.kind === "clear") {
          this.displayBoard = f.beforeBoard;
          if (f.converted && f.converted.length)
            await this.animate("transform", { frame: f }, 160);
          this.burst(f.removed);
          if (this.profile.sound) this.p.sound();
          if (this.profile.haptic && n === 0) this.p.vibrate();
          await this.animate(
            "clear",
            { frame: f },
            f.effects.some((e) => e.kind === "all")
              ? 560
              : f.effects.length
                ? 330
                : 210,
          );
          this.displayBoard = f.board;
        } else if (f.kind === "fall" || f.kind === "belt") {
          this.displayBoard = f.board;
          await this.animate(
            f.kind,
            { motions: f.motions },
            f.kind === "belt" ? 360 : 350,
          );
        } else {
          this.displayBoard = f.board;
          await this.animate("shuffle", {}, 260);
        }
        this.visualProgress = f.progress;
        this.visualScore = f.score;
        this.visualOverlay = { sand: f.sand, ice: f.ice, vines: f.vines };
      }
    }
    async watchClearAd() {
      C.sync(this.profile, Date.now());
      if (
        this.busy ||
        this.adLoading ||
        !this.game ||
        this.game.status !== "playing"
      )
        return;
      if (this.profile.clearAds >= 2) {
        this.toast("今日两次清屏已用完");
        return;
      }
      if (this.profile.ads >= 5) {
        this.toast("今日广告总次数已用完");
        return;
      }
      if (!this.p.hasAds) {
        this.toast("广告暂未开放，配置真实广告位后可用");
        return;
      }
      const active = this.game;
      this.adLoading = true;
      this.syncMusic();
      try {
        await this.p.watchAd();
        if (this.game !== active || active.status !== "playing") {
          this.toast("关卡已结束，未消耗清屏次数");
          return;
        }
        C.sync(this.profile, Date.now());
        if (this.profile.clearAds >= 2 || this.profile.ads >= 5) {
          this.toast("今日广告额度已用完");
          return;
        }
        const next = C.clone(active),
          result = C.clearScreen(next);
        if (!result.valid || !C.claimClear(this.profile, Date.now())) return;
        this.busy = true;
        this.selected = -1;
        this.hintPair = null;
        this.visualProgress = active.progress;
        this.visualScore = active.score;
        this.visualOverlay = {
          sand: active.sand.slice(),
          ice: active.ice.slice(),
          vines: active.vines.slice(),
        };
        this.game = next;
        this.profile.active = next;
        this.save();
        await this.playFrames(result.frames);
        if (this.game.status !== "playing") this.finish();
        else
          this.toast(
            "清屏完成，今日还可使用 " + (2 - this.profile.clearAds) + " 次",
          );
      } catch (e) {
        this.toast(e.message || "广告暂不可用，请稍后再试");
      } finally {
        this.animation = null;
        this.displayBoard = null;
        this.visualProgress = undefined;
        this.visualScore = undefined;
        this.visualOverlay = null;
        this.busy = false;
        this.adLoading = false;
        this.syncMusic();
      }
    }
    burst(cells) {
      cells.forEach((c) => {
        for (let k = 0; k < 3; k++)
          this.particles.push({
            x: 57 + (c.index % 7) * 46,
            y: 292 + Math.floor(c.index / 7) * 46,
            vx: (Math.random() - 0.5) * 3,
            vy: -1 - Math.random() * 3,
            color: COLORS[c.type] || "#fff",
            life: 1,
          });
      });
    }
    toast(t) {
      this.toastText = t;
      this.toastUntil = Date.now() + 2400;
    }
    showModal() {
      const m = this.modal,
        g = this.ctx;
      this.buttons = [];
      this.box(0, 0, 390, 844, 0, "rgba(3,13,23,.78)");
      let y = 234,
        h = 376;
      if (m.type === "help") {
        y = 148;
        h = 558;
      }
      if (m.type === "energy") {
        y = 217;
        h = 410;
      }
      this.box(
        24,
        y,
        342,
        h,
        28,
        this.gradient(24, y, 342, h, "#214557", "#10293e"),
        "rgba(170,228,231,.25)",
      );
      const center = 195;
      this.iconButton("close-modal", 316, y + 13, "×", () => {
        if (m.type === "won" || m.type === "lost") {
          this.scene = "home";
        }
        this.modal = null;
      });
      if (m.type === "energy") {
        C.sync(this.profile, Date.now());
        this.text(
          "给小海洋补点氧气",
          center,
          y + 52,
          22,
          "#effbef",
          "center",
          "600",
        );
        this.text(
          "当前体力 " + this.profile.energy + " / 5",
          center,
          y + 94,
          16,
          "#bcecd6",
          "center",
        );
        const ms = C.remaining(this.profile, Date.now()),
          seconds = Math.ceil(ms / 1000);
        this.text(
          ms
            ? "下次恢复 " +
                String(Math.floor(seconds / 60)).padStart(2, "0") +
                ":" +
                String(seconds % 60).padStart(2, "0")
            : "自然恢复体力已满",
          center,
          y + 126,
          12,
          "#9dbbc5",
          "center",
        );
        this.button(
          "claim-modal",
          48,
          y + 166,
          294,
          44,
          this.profile.dailyClaimed ? "今日补给已领取" : "领取每日补给  +3",
          () => {
            if (C.claim(this.profile, Date.now())) {
              this.save();
              this.toast("已获得 3 点体力");
            }
          },
          {
            disabled: this.profile.dailyClaimed,
            fill: "rgba(156,228,207,.10)",
            color: this.profile.dailyClaimed ? "#6d929a" : "#c0f5d9",
            size: 14,
          },
        );
        let label = this.adLoading
          ? "正在加载广告…"
          : this.profile.ads >= 5
            ? "今日广告次数已用完"
            : this.p.hasAds
              ? "看广告，获得 1 点体力"
              : "广告暂未开放";
        this.button("ad", 48, y + 225, 294, 48, label, () => this.watchAd(), {
          disabled: this.adLoading || this.profile.ads >= 5 || !this.p.hasAds,
          fill: this.p.hasAds && this.profile.ads < 5 ? "#a8ebd3" : "#355463",
          color: this.p.hasAds ? "#153b40" : "#9db6c1",
          size: 14,
        });
        this.text(
          "今日剩余 " + (5 - this.profile.ads) + " / 5 次 · 完整观看后获得",
          center,
          y + 297,
          11,
          "#98b9c4",
          "center",
        );
        this.text(
          "每 30 分钟恢复 1 点，上限 5 点",
          center,
          y + 334,
          11,
          "#87a9b8",
          "center",
        );
        this.text(
          "每日补给可超过上限 · 北京时间零点刷新",
          center,
          y + 358,
          10,
          "#668e9f",
          "center",
        );
      }
      if (m.type === "settings") {
        this.text("海洋偏好", center, y + 48, 23, "#effbef", "center", "600");
        const options = [
          ["music", "背景音乐"],
          ["sound", "气泡音效"],
          ["haptic", "轻触震动"],
        ];
        options.forEach(([key, label], i) =>
          this.button(
            key,
            48,
            y + 90 + i * 57,
            294,
            44,
            label + "    " + (this.profile[key] ? "已开启" : "已关闭"),
            () => {
              this.profile[key] = !this.profile[key];
              this.syncMusic();
              this.save();
            },
            { fill: "rgba(167,220,223,.08)", color: "#d5eee9", size: 14 },
          ),
        );
        this.text(
          "背景音乐 · 海洋微光",
          center,
          y + 280,
          11,
          "#9cb9c5",
          "center",
        );
        this.text(
          "进度与声音偏好保存在当前设备",
          center,
          y + 306,
          11,
          "#7e9eaf",
          "center",
        );
        this.text(
          "啵啵水族箱 · v0.3",
          center,
          y + 344,
          10,
          "#6a91a0",
          "center",
        );
      }
      if (m.type === "help") {
        const page = m.page || 0;
        const titles = ["基础与优先级", "特效组合", "特殊关卡元素"];
        const pages = [
          [
            ["三消与交换", "交换相邻动物；无效交换回弹，不扣步数"],
            ["四连 → 直线", "清除整行或整列，遇银币会被阻挡"],
            ["T / L 型 → 爆炸", "五个同色相连，生成 3×3 爆炸特效"],
            ["五连及以上 → 魔力鸟", "海洋造型是彩虹珍珠；六连、七连同样生成"],
            ["特效优先级", "魔力鸟 > 爆炸 > 直线，每组只生成一个"],
            ["自动连锁与洗牌", "下落后继续消除；无可行交换时自动洗牌"],
          ],
          [
            ["直线 + 直线", "同向：一条直线；异向：交换目标格十字"],
            ["直线 + 爆炸", "四行或四列；朝交换来源侧多扩散一条"],
            ["爆炸 + 爆炸", "以目标格为中心，菱形向外扩散 4 格"],
            ["魔力鸟 + 普通动物", "清除棋盘上所有与该动物同色的动物"],
            ["魔力鸟 + 直线 / 爆炸", "同色动物变成对应特效，再一起触发"],
            ["魔力鸟 + 魔力鸟", "先引爆全部特效，再进行一次全屏清除"],
          ],
          [
            ["银币", "相邻消除或爆炸可清除；否则阻挡直线"],
            ["冰块（最多三层）", "消除其上的动物，冰层随之减少一层"],
            ["藤蔓", "无法交换或下落；命中先解开藤蔓"],
            ["鸡窝与小黄鸡", "每波敲击一次；敲两次，每个窝产生两只"],
            ["传送带", "每成功交换两次，动物沿轨道前进一格"],
            ["染色蛋", "与特效交换消同色；配爆炸再扩展 5×5"],
          ],
        ];
        this.text(titles[page], center, y + 47, 21, "#effbef", "center", "600");
        pages[page].forEach((r, i) => {
          const yy = y + 93 + i * 62;
          this.circle(52, yy + 6, 3, COLORS[i]);
          this.text(r[0], 67, yy, 13, "#dcefe9");
          this.text(r[1], 67, yy + 23, 10, "#91b3bf");
        });
        this.button(
          "help-prev",
          47,
          y + 492,
          86,
          35,
          "上一页",
          () => (m.page = (page + 2) % 3),
          { fill: "rgba(155,212,218,.08)", color: "#c6e4e0", size: 11 },
        );
        this.text(page + 1 + " / 3", center, y + 510, 11, "#8eafb9", "center");
        this.button(
          "help-next",
          257,
          y + 492,
          86,
          35,
          "下一页",
          () => (m.page = (page + 1) % 3),
          { fill: "rgba(155,212,218,.08)", color: "#c6e4e0", size: 11 },
        );
      }
      if (m.type === "pause" || m.type === "abandon") {
        this.text(
          m.type === "pause" ? "让海洋歇一会儿" : "开始另一段冒险？",
          center,
          y + 59,
          22,
          "#effbef",
          "center",
          "600",
        );
        this.text(
          m.type === "pause"
            ? "返回首页会保留当前棋盘和步数"
            : "结束当前关卡会消耗 1 点体力",
          center,
          y + 107,
          12,
          "#9dbac7",
          "center",
        );
        this.button("resume", 48, y + 152, 294, 49, "继续当前关卡", () => {
          this.modal = null;
          if (m.type === "abandon") this.start(this.profile.active.level);
        });
        this.button(
          "save-home",
          48,
          y + 218,
          294,
          44,
          m.type === "pause" ? "保存并返回首页" : "放弃并开始新关卡",
          () => {
            if (m.type === "pause") {
              this.modal = null;
              this.scene = "home";
              this.save();
            } else {
              C.spend(this.profile, Date.now());
              this.profile.active = null;
              this.save();
              this.modal = null;
              this.start(m.next);
            }
          },
          { fill: "rgba(167,220,223,.07)", color: "#b6d3db", size: 13 },
        );
        if (m.type === "pause")
          this.button(
            "abandon",
            48,
            y + 285,
            294,
            36,
            "结束本局（消耗 1 点体力）",
            () => {
              C.spend(this.profile, Date.now());
              this.profile.active = null;
              this.save();
              this.modal = null;
              this.scene = "home";
            },
            { fill: "transparent", color: "#b4959f", size: 11 },
          );
      }
      if (m.type === "won" || m.type === "lost") {
        const won = m.type === "won";
        this.critter(won ? 0 : 3, center, y + 66, 65);
        this.text(
          won ? "这片海，被你点亮了" : "差一点点，就成功了",
          center,
          y + 131,
          21,
          "#f0faec",
          "center",
          "600",
        );
        this.text(
          won
            ? "收获 " + m.reward + " 贝壳 · 本局不扣体力"
            : "已消耗 1 点体力，换个思路再试试",
          center,
          y + 172,
          12,
          "#abc8cd",
          "center",
        );
        this.button(
          "result-next",
          48,
          y + 220,
          294,
          49,
          won
            ? this.game.level === 30
              ? "回到海洋，再逛一逛"
              : "前往下一片海  →"
            : "再挑战一次",
          () => {
            const id = this.game.level;
            if (won && id === 30) {
              this.modal = null;
              this.scene = "aquarium";
            } else {
              this.modal = null;
              this.start(won ? id + 1 : id);
            }
          },
        );
        this.button(
          "result-home",
          48,
          y + 286,
          294,
          38,
          "返回我的海洋",
          () => {
            this.modal = null;
            this.scene = "home";
          },
          { fill: "transparent", color: "#95b8c5", size: 12 },
        );
      }
    }
    async watchAd() {
      C.sync(this.profile, Date.now());
      if (this.adLoading || this.profile.ads >= 5) return;
      this.adLoading = true;
      this.syncMusic();
      try {
        await this.p.watchAd();
        if (C.reward(this.profile, Date.now())) {
          this.save();
          this.toast("已获得 1 点体力");
        } else this.toast("今日奖励次数已用完");
      } catch (e) {
        this.toast(e.message);
      } finally {
        this.adLoading = false;
        this.syncMusic();
      }
    }
    point(x, y) {
      return { x: (x - this.ox) / this.scale, y: (y - this.oy) / this.scale };
    }
    indexAt(p) {
      const x = Math.floor((p.x - 34) / 46),
        y = Math.floor((p.y - 269) / 46);
      return p.x >= 34 && p.y >= 269 && x < 7 && y < 7 ? y * 7 + x : -1;
    }
    syncMusic() {
      if (this.p.music)
        this.p.music(
          this.musicUnlocked &&
            this.profile.music &&
            !this.hidden &&
            !this.adLoading,
        );
    }
    pointerDown(x, y) {
      this.musicUnlocked = true;
      this.syncMusic();
      this.down = this.point(x, y);
    }
    cancelPointer() {
      this.down = null;
    }
    pointerUp(x, y) {
      const p = this.point(x, y),
        down = this.down;
      this.down = null;
      if (!down || this.busy || this.adLoading) return;
      if (this.scene === "game" && !this.modal) {
        const a = this.indexAt(down),
          b = this.indexAt(p);
        if (a >= 0 && b >= 0) {
          if (a !== b) {
            if (C.adjacent(a, b)) this.doSwap(a, b);
            else this.toast("试试交换相邻且能连成三个的伙伴");
            return;
          }
          if (this.selected === a) {
            this.selected = -1;
            return;
          }
          if (
            this.selected >= 0 &&
            Math.abs((this.selected % 7) - (a % 7)) +
              Math.abs(Math.floor(this.selected / 7) - Math.floor(a / 7)) ===
              1
          ) {
            this.doSwap(this.selected, a);
            return;
          }
          this.selected = a;
          return;
        }
      }
      if (Math.hypot(p.x - down.x, p.y - down.y) > 18) return;
      const b = this.buttons
        .slice()
        .reverse()
        .find(
          (b) =>
            p.x >= b.x &&
            p.x <= b.x + b.w &&
            p.y >= b.y &&
            p.y <= b.y + b.h &&
            down.x >= b.x &&
            down.x <= b.x + b.w &&
            down.y >= b.y &&
            down.y <= b.y + b.h,
        );
      if (b) b.fn();
    }
    draw(t) {
      if (this.hidden) return;
      const g = this.ctx;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.fillStyle = "#071827";
      g.fillRect(0, 0, this.width, this.height);
      g.translate(this.ox, this.oy);
      g.scale(this.scale, this.scale);
      g.save();
      g.beginPath();
      g.rect(0, 0, 390, 844);
      g.clip();
      this.buttons = [];
      C.sync(this.profile, Date.now());
      this.background(t);
      if (this.scene === "home") this.home(t);
      if (this.scene === "levels") this.levels(t);
      if (this.scene === "aquarium") this.aquarium(t);
      if (this.scene === "game") this.gameView(t);
      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.024;
        g.globalAlpha = Math.max(0, p.life);
        this.circle(p.x, p.y, 2 + p.life * 2, p.color);
      }
      g.globalAlpha = 1;
      this.particles = this.particles.filter((p) => p.life > 0);
      if (this.modal) this.showModal();
      if (Date.now() < this.toastUntil) {
        this.box(
          26,
          91,
          338,
          39,
          14,
          "rgba(3,17,30,.96)",
          "rgba(185,236,227,.18)",
        );
        this.text(this.toastText, 195, 111, 11, "#d8eee7", "center");
      }
      g.restore();
    }
  }
  return App;
});
