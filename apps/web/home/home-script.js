import { iconMarkup } from "@secmgr/ui";

let mounted = false;

export function mountHome() {
  if (mounted) return;
  mounted = true;

  const doc = document;
  const root = doc.documentElement;
  const reduce = root.classList.contains("reduce");
  const DOT = "\u2022";
  const ARROW = "\u2192";
  const $ = (s, r) => (r || doc).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || doc).querySelectorAll(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - (1 - t) ** 4;
  const easeOutSoft = (t) => 1 - (1 - t) ** 3;
  const dots = (n) => new Array(n + 1).join(DOT);
  const ic = (name, size) => `<span class="ic" data-icon="${name}"${size ? ` data-size="${size}"` : ""}></span>`;

  const store = {
    get(k, session) {
      try {
        return (session ? window.sessionStorage : window.localStorage).getItem(k);
      } catch (_e) {
        return null;
      }
    },
    set(k, v, session) {
      try {
        (session ? window.sessionStorage : window.localStorage).setItem(k, v);
      } catch (_e) {}
    },
  };

  function hydrate(scope) {
    $$("[data-icon]", scope).forEach((el) => {
      if (el.firstElementChild) return;
      let size = +el.getAttribute("data-size");
      if (!size) size = el.classList.contains("feature__icon") ? 18 : 16;
      el.innerHTML = iconMarkup(el.getAttribute("data-icon"), size);
    });
  }

  const Ticker = (() => {
    const subs = new Set();
    let raf = 0;
    let last = 0;
    const frame = (t) => {
      raf = 0;
      const dt = last ? Math.min(t - last, 64) : 16;
      last = t;
      subs.forEach((fn) => {
        fn(dt, t);
      });
      if (subs.size && !doc.hidden) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const kick = () => {
      if (!raf && subs.size && !doc.hidden) raf = requestAnimationFrame(frame);
    };
    doc.addEventListener("visibilitychange", () => {
      if (doc.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      } else kick();
    });
    return {
      add(fn) {
        subs.add(fn);
        kick();
      },
      remove(fn) {
        subs.delete(fn);
      },
      has(fn) {
        return subs.has(fn);
      },
    };
  })();

  const S = { y: window.scrollY, vh: window.innerHeight, vw: window.innerWidth, tx: 0, ty: 0 };

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const fontsReady = new Promise((resolve) => {
    const timer = setTimeout(resolve, 1500);
    try {
      Promise.all([
        doc.fonts.load('500 88px "Geist"'),
        doc.fonts.load('300 88px "Geist"'),
        doc.fonts.load('400 16px "Geist"'),
        doc.fonts.load('500 14px "Geist"'),
        doc.fonts.load('400 13px "Geist Mono"'),
      ]).then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        () => {
          clearTimeout(timer);
          resolve();
        },
      );
    } catch (_e) {
      clearTimeout(timer);
      resolve();
    }
  });

  hydrate(doc);

  const flips = $$("[data-flip]");
  const toggle = $("#theme-toggle");
  const nav = $("#nav");
  let sections = [];

  function applyTheme(dark, animate) {
    const run = () => {
      flips.forEach((el) => {
        el.setAttribute("data-theme", dark ? "dark" : "light");
      });
      toggle.setAttribute("aria-pressed", dark ? "true" : "false");
      paintChrome();
    };
    if (animate && !reduce && typeof doc.startViewTransition === "function") {
      try {
        doc.startViewTransition(run);
        return;
      } catch (_e) {}
    }
    run();
  }
  toggle.setAttribute("aria-label", "Dark mode");
  const savedTheme = store.get("secmgr-home-theme");
  const hostTheme = doc.documentElement.getAttribute("data-theme");
  applyTheme(savedTheme ? savedTheme === "dark" : hostTheme === "dark", false);
  toggle.addEventListener("click", () => {
    const dark = toggle.getAttribute("aria-pressed") !== "true";
    store.set("secmgr-home-theme", dark ? "dark" : "light");
    applyTheme(dark, true);
  });

  function measure() {
    S.vh = window.innerHeight;
    S.vw = window.innerWidth;
    const y = window.scrollY;
    sections = $$("main section[data-theme], footer[data-theme]").map((el) => {
      const r = el.getBoundingClientRect();
      return { el, top: r.top + y, bottom: r.bottom + y, h: r.height };
    });
    const hero = sections[0];
    if (hero) {
      hero.top = 0;
      hero.bottom = hero.h;
    }
  }
  const sec = (el) => sections.find((s) => s.el === el);

  function themeAt(docY) {
    let found = null;
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if (docY >= s.top && docY < s.bottom) found = s;
    }
    return found ? found.el.getAttribute("data-theme") : "dark";
  }

  function paintChrome() {
    const navTheme = themeAt(S.y + 36);
    if (nav.getAttribute("data-theme") !== navTheme) nav.setAttribute("data-theme", navTheme);
    const tTheme = themeAt(S.y + S.vh - 42);
    if (toggle.getAttribute("data-theme") !== tTheme) toggle.setAttribute("data-theme", tTheme);
    nav.classList.toggle("is-scrolled", S.y > 24);
  }

  (function menu() {
    const btn = $(".nav__menu");
    const sheet = $("#nav-sheet");
    const setOpen = (open, focusBtn) => {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      sheet.hidden = !open;
      if (open) {
        const a = $("a", sheet);
        if (a) a.focus();
      } else if (focusBtn) btn.focus();
    };
    btn.addEventListener("click", () => setOpen(btn.getAttribute("aria-expanded") !== "true"));
    doc.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !sheet.hidden) {
        e.preventDefault();
        setOpen(false, true);
      }
    });
    doc.addEventListener("pointerdown", (e) => {
      if (!sheet.hidden && !sheet.contains(e.target) && !btn.contains(e.target)) setOpen(false);
    });
    sheet.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });
    sheet.addEventListener("focusout", (e) => {
      if (e.relatedTarget && !sheet.contains(e.relatedTarget) && e.relatedTarget !== btn) setOpen(false);
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth >= 720 && !sheet.hidden) setOpen(false);
    });
  })();

  (function copy() {
    const live = $("#live");
    const write = (text) => {
      try {
        if (navigator.clipboard && window.isSecureContext)
          return navigator.clipboard.writeText(text).then(
            () => true,
            () => legacy(text),
          );
      } catch (_e) {}
      return Promise.resolve(legacy(text));
    };
    const legacy = (text) => {
      try {
        const ta = doc.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        doc.body.appendChild(ta);
        ta.select();
        const ok = doc.execCommand("copy");
        ta.remove();
        return ok;
      } catch (_e) {
        return false;
      }
    };
    $$("[data-copy]").forEach((btn) => {
      let timer = 0;
      const host = btn.closest(".install") || btn;
      const label = $(".code__copy-label", btn);
      const tip = $(".install__tip", host);
      const source = host.classList.contains("install")
        ? $(".install__cmd", host)
        : $(".code__pre", btn.closest(".code"));
      const selectSource = () => {
        try {
          const range = doc.createRange();
          range.selectNodeContents(source);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (_e) {}
      };
      btn.addEventListener("click", () => {
        const text = btn.getAttribute("data-copy");
        write(text).then((ok) => {
          host.classList.remove("is-copied");
          void host.offsetWidth;
          host.classList.add("is-copied");
          if (!ok) selectSource();
          if (label) label.textContent = ok ? "Copied" : "Press \u2318C";
          if (tip) tip.textContent = ok ? "Copied" : "Press \u2318C to copy";
          host.classList.toggle("is-failed", !ok);
          live.textContent = ok
            ? `Copied ${text} to the clipboard`
            : "Could not copy automatically. The command is selected, press Command C to copy it.";
          clearTimeout(timer);
          timer = setTimeout(
            () => {
              host.classList.remove("is-copied", "is-failed");
              if (label) label.textContent = "Copy";
            },
            ok ? 1800 : 3200,
          );
        });
      });
    });
  })();

  window.addEventListener(
    "pointermove",
    (e) => {
      S.tx = clamp((e.clientX / S.vw) * 2 - 1, -1, 1);
      S.ty = clamp((e.clientY / S.vh) * 2 - 1, -1, 1);
    },
    { passive: true },
  );

  const CHIP_DATA = [
    {
      t: "secret",
      key: "STRIPE_SECRET_KEY",
      val: dots(8),
      d: 0.04,
      rz: -5,
      lg: [0.13, 0.27],
      md: [0.14, 0.2],
      sm: [0.3, 0.13],
    },
    {
      t: "env",
      name: "production",
      c: "rose",
      lock: true,
      d: 0.3,
      rz: 4,
      lg: [0.1, 0.72],
      md: [0.14, 0.82],
      sm: [0.2, 0.9],
    },
    {
      t: "secret",
      key: "DATABASE_URL",
      val: `postgres://${dots(4)}`,
      d: 0.2,
      rz: 4,
      lg: [0.86, 0.3],
      md: [0.83, 0.18],
      sm: null,
    },
    {
      t: "secret",
      key: "JWT_SIGNING_KEY",
      val: dots(8),
      d: 0.1,
      rz: -4,
      lg: [0.87, 0.7],
      md: [0.84, 0.84],
      sm: [0.74, 0.88],
    },
    { t: "secret", key: "SESSION_SECRET", val: dots(6), d: 0.82, rz: 7, lg: [0.3, 0.13], md: null, sm: null },
    { t: "env", name: "staging", c: "amber", d: 0.62, rz: -6, lg: [0.72, 0.88], md: [0.6, 0.93], sm: null },
    {
      t: "secret",
      key: "OPENAI_API_KEY",
      val: `sk-proj-${dots(4)}`,
      d: 0.9,
      rz: -3,
      lg: [0.69, 0.12],
      md: [0.56, 0.1],
      sm: [0.8, 0.2],
    },
    { t: "secret", key: "RESEND_API_KEY", val: `re_${dots(5)}`, d: 0.72, rz: 5, lg: [0.28, 0.9], md: null, sm: null },
    { t: "env", name: "development", c: "blue", d: 0.5, rz: 3, lg: [0.05, 0.5], md: null, sm: null },
  ];

  function createHero() {
    const hero = $("#top");
    const canvas = $("#hero-canvas");
    const inner = $("#hero-inner");
    const chipsEl = $("#hero-chips");
    const ctx = canvas.getContext("2d");
    let W = 0;
    let H = 0;
    let dpr = 1;
    let R = 0;
    let cx = 0;
    let cy = 0;
    let ink = "#ececed";
    let inkRGB = "236,236,237";
    let intro = 1;
    let introState = "done";
    let from = null;
    let px = 0;
    let py = 0;
    let lastSc = -1;
    let clock = 0;
    let chipIntro = 1;
    let active = false;
    const N = 132;
    const WEAVE = 0.17;
    const TAU = Math.PI * 2;
    const pts = [];
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i <= N; i++) {
        const th = (i / N) * TAU;
        const s = k === 0 ? -1 : 1;
        pts.push([s * 0.5 + Math.cos(th), Math.sin(th), s * WEAVE * Math.sin(th), th]);
      }
    }
    const P = pts.length;
    const PX = new Float32Array(P);
    const PY = new Float32Array(P);
    const PZ = new Float32Array(P);
    const SEG = 2 * N;
    const SZ = new Float32Array(SEG);
    const SA = new Float32Array(SEG);
    const SW = new Float32Array(SEG);
    const mask = { x: 0, y: 0, w: 0, h: 0 };
    const sprite = doc.createElement("canvas");
    const glow = doc.createElement("canvas");
    glow.className = "hero__glow";
    glow.setAttribute("aria-hidden", "true");
    hero.insertBefore(glow, canvas);
    const gctx = glow.getContext("2d");
    const GS = 1 / 3;
    const segRing = new Uint8Array(SEG);
    const segIdx = new Uint16Array(SEG);
    const CROSS = [
      [[], []],
      [[], []],
    ];
    const KNOCK = [
      [[], []],
      [[], []],
    ];
    const angDist = (a, b) => {
      const x = Math.abs(a - b) % TAU;
      return x > Math.PI ? TAU - x : x;
    };
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < N; i++) {
        const s = k * N + i;
        segRing[s] = k;
        segIdx[s] = k * (N + 1) + i;
        const th = ((i + 0.5) / N) * TAU;
        const cross = k === 0 ? [Math.PI / 3, (5 * Math.PI) / 3] : [(2 * Math.PI) / 3, (4 * Math.PI) / 3];
        for (let c = 0; c < 2; c++) {
          if (angDist(th, cross[c]) < 0.3) CROSS[k][c].push(s);
          if (angDist(th, cross[c]) < 0.2) KNOCK[k][c].push(s);
        }
      }
    }

    const rand = rng(11);
    const parts = [];
    const bokeh = [];

    const chips = CHIP_DATA.map((c, i) => {
      const el = doc.createElement("div");
      el.className = "chip3d";
      if (c.t === "secret") {
        el.innerHTML =
          '<span class="chip3d__icon">' +
          ic("key-round", 13) +
          '</span><span class="chip3d__key">' +
          c.key +
          '</span><span class="chip3d__val">' +
          c.val +
          "</span>";
      } else {
        el.innerHTML =
          '<span class="chip3d__env"><span class="env-dot" style="--_c: var(--env-' +
          c.c +
          ')"></span>' +
          c.name +
          (c.lock ? `<span class="chip3d__lock">${ic("lock", 13)}</span>` : "") +
          "</span>";
      }
      if (c.d < 0.25) el.classList.add("is-near");
      if (c.d > 0.55) el.style.filter = `blur(${((c.d - 0.45) * 4.2).toFixed(2)}px)`;
      chipsEl.appendChild(el);
      return { c, el, w: 0, h: 0, x: 0, y: 0, on: true, ph: i * 1.7, sp: 0.35 + (i % 4) * 0.08 };
    });
    hydrate(chipsEl);

    function layout() {
      W = hero.clientWidth;
      H = hero.clientHeight;
      dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4200000 / Math.max(1, W * H))));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      glow.width = Math.max(1, Math.round(W * GS));
      glow.height = Math.max(1, Math.round(H * GS));
      R = W < 720 ? Math.min(W * 0.37, H * 0.3) : Math.min(W * 0.235, H * 0.37);
      cx = W / 2;
      cy = H * 0.5;
      ink = getComputedStyle(hero).getPropertyValue("--text").trim() || ink;
      sprite.width = 64;
      sprite.height = 64;
      const sg = sprite.getContext("2d");
      const n = parseInt(ink.replace("#", ""), 16) || 0;
      const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
      inkRGB = rgb;
      const grd = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, `rgba(${rgb},1)`);
      grd.addColorStop(0.45, `rgba(${rgb},0.45)`);
      grd.addColorStop(1, `rgba(${rgb},0)`);
      sg.clearRect(0, 0, 64, 64);
      sg.fillStyle = grd;
      sg.fillRect(0, 0, 64, 64);
      let l = 1e9,
        t = 1e9,
        r = -1e9,
        b = -1e9;
      [".hero__title", ".hero__lede", ".hero__actions"].forEach((sel) => {
        const el = $(sel, inner);
        if (!el) return;
        l = Math.min(l, el.offsetLeft);
        t = Math.min(t, el.offsetTop);
        r = Math.max(r, el.offsetLeft + el.offsetWidth);
        b = Math.max(b, el.offsetTop + el.offsetHeight);
      });
      if (r > l) {
        mask.x = (l + r) / 2;
        mask.y = (t + b) / 2;
        mask.w = (r - l) / 2 + 70;
        mask.h = (b - t) / 2 + 56;
      }
      const count = W < 720 ? 70 : W < 1200 ? 120 : 160;
      parts.length = 0;
      for (let i = 0; i < count; i++) {
        const z = rand() ** 1.6;
        parts.push({
          x: rand() * 2 - 1,
          y: rand() * 2 - 1,
          z,
          s: 0.5 + z * 1.4,
          ph: rand() * TAU,
          tw: 0.4 + rand() * 1.4,
          v: 0.3 + rand() * 0.7,
        });
      }
      bokeh.length = 0;
      const bc = W < 720 ? 4 : 7;
      for (let i = 0; i < bc; i++)
        bokeh.push({
          x: rand() * 2 - 1,
          y: rand() * 2 - 1,
          r: 18 + rand() * 40,
          ph: rand() * TAU,
          a: 0.03 + rand() * 0.04,
        });
      const size = W >= 1024 ? "lg" : W >= 720 ? "md" : "sm";
      chips.forEach((ch) => {
        const pos = ch.c[size];
        ch.on = !!pos;
        ch.el.style.display = pos ? "" : "none";
        if (!pos) return;
        ch.w = ch.el.offsetWidth;
        ch.h = ch.el.offsetHeight;
        ch.x = pos[0] * W;
        ch.y = pos[1] * H;
      });
      lastSc = -1;
    }

    function draw(t, sc) {
      const e = intro >= 1 ? 1 : easeOutSoft(intro);
      const time = t * 0.001;
      const amp = e;
      const yaw = (Math.sin(time * 0.16) * 0.5 + Math.sin(time * 0.061 + 0.7) * 0.28) * amp + px * 0.24;
      const pitch = (Math.sin(time * 0.11 + 1.3) * 0.3 + 0.16) * amp - py * 0.18;
      const roll = Math.sin(time * 0.047) * 0.1 * amp;
      const cyw = Math.cos(yaw),
        syw = Math.sin(yaw),
        cp = Math.cos(pitch),
        sp = Math.sin(pitch),
        cr = Math.cos(roll),
        sr = Math.sin(roll);
      let scale = 1;
      let ox = cx;
      let oy = cy;
      if (from && e < 1) {
        scale = lerp(from.s, 1, e);
        ox = lerp(from.x, cx, e);
        oy = lerp(from.y, cy, e);
      }
      scale *= 1 + sc * 0.45;
      oy -= sc * H * 0.1;
      const Rs = R * scale;
      const f = 3.4;
      for (let i = 0; i < P; i++) {
        const p = pts[i];
        const x1 = p[0] * cr - p[1] * sr;
        const y1 = p[0] * sr + p[1] * cr;
        const z1 = p[2];
        const x2 = x1 * cyw + z1 * syw;
        const z2 = -x1 * syw + z1 * cyw;
        const y3 = y1 * cp - z2 * sp;
        const z3 = y1 * sp + z2 * cp;
        const k = f / (f - z3);
        PX[i] = ox + x2 * Rs * k;
        PY[i] = oy - y3 * Rs * k;
        PZ[i] = z3;
      }
      const fade = 1 - sc * 0.75;
      const markStroke = from ? from.stroke : 1.3;
      const lw = lerp(markStroke, 1.35, e) * (1 + sc * 0.2);
      const hl0 = time * 0.32;
      const my = mask.y - sc * 110;
      for (let s = 0; s < SEG; s++) {
        const a = segIdx[s];
        const z = (PZ[a] + PZ[a + 1]) * 0.5;
        SZ[s] = z;
        const near = clamp((z + 1.3) / 2.6, 0, 1);
        const blur = Math.min(1, Math.abs(z) / 1.1) * e;
        const th = pts[a][3];
        const hp = segRing[s] === 0 ? hl0 : Math.PI - hl0;
        const dd = angDist(th, ((hp % TAU) + TAU) % TAU);
        const hl = Math.exp(-(dd * dd) / 0.3) * e;
        let m = 1;
        if (e > 0 && mask.w > 0) {
          const dx = ((PX[a] + PX[a + 1]) * 0.5 - mask.x) / mask.w;
          const dy = ((PY[a] + PY[a + 1]) * 0.5 - my) / mask.h;
          const dist = dx * dx + dy * dy;
          if (dist < 1) {
            const u = clamp((dist - 0.15) / 0.85, 0, 1);
            m = lerp(1, 0.16 + 0.84 * u * u * (3 - 2 * u), e);
          }
        }
        SA[s] = clamp((lerp(1, 0.18 + 0.8 * near, e) + hl * 0.32) * (1 - blur * 0.35), 0, 1) * m * fade;
        SW[s] = lw * (1 + blur * 1.2) * lerp(1, 0.78 + 0.44 * near, e);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = ink;
      const partA = e * fade;
      if (partA > 0.01) {
        for (let i = 0; i < bokeh.length; i++) {
          const b = bokeh[i];
          const bx = cx + b.x * W * 0.55 + px * 40 + Math.sin(time * 0.1 + b.ph) * 20;
          const by = cy + b.y * H * 0.55 + py * 30 - sc * H * 0.5;
          ctx.globalAlpha = b.a * partA * (0.7 + 0.3 * Math.sin(time * 0.3 + b.ph));
          ctx.drawImage(sprite, bx - b.r, by - b.r, b.r * 2, b.r * 2);
        }
        const spanX = W * 0.62;
        const spanY = H * 0.62;
        for (let i = 0; i < parts.length; i++) {
          const q = parts[i];
          const x = cx + q.x * spanX + px * (6 + 26 * q.z);
          const y = cy + q.y * spanY + py * (4 + 18 * q.z) - sc * H * (0.1 + 0.5 * q.z);
          const a = (0.1 + 0.5 * q.z) * (0.55 + 0.45 * Math.sin(time * q.tw + q.ph)) * partA;
          if (a < 0.02) continue;
          ctx.globalAlpha = a;
          if (q.s < 1.2) ctx.fillRect(x, y, q.s, q.s);
          else {
            ctx.beginPath();
            ctx.arc(x, y, q.s * 0.6, 0, TAU);
            ctx.fill();
          }
        }
      }

      ctx.strokeStyle = ink;
      ctx.lineCap = "butt";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = "source-over";
      runs(ctx, 0, SA, SW, 28, 5);
      runs(ctx, 1, SA, SW, 28, 5);

      const gapW = lw * 2.1 + 3.2 * e;
      for (let c = 0; c < 2; c++) {
        let za = 0;
        let zb = 0;
        const la = CROSS[0][c];
        const lb = CROSS[1][c];
        for (let i = 0; i < la.length; i++) za += SZ[la[i]];
        for (let i = 0; i < lb.length; i++) zb += SZ[lb[i]];
        const over = za / la.length > zb / lb.length ? 0 : 1;
        const knock = KNOCK[over][c];
        const list = CROSS[over][c];
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = 1;
        ctx.lineWidth = gapW;
        pathAlong(knock);
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
        let aa = 0;
        let ww = 0;
        for (let i = 0; i < list.length; i++) {
          aa += SA[list[i]];
          ww += SW[list[i]];
        }
        ctx.globalAlpha = aa / list.length;
        ctx.lineWidth = ww / list.length;
        pathAlong(list);
        ctx.stroke();
      }
      gctx.setTransform(1, 0, 0, 1, 0, 0);
      gctx.globalCompositeOperation = "source-over";
      gctx.globalAlpha = 1;
      gctx.clearRect(0, 0, glow.width, glow.height);
      if (e > 0.01) {
        const ga = e * fade;
        gctx.setTransform(GS, 0, 0, GS, 0, 0);
        gctx.lineCap = "round";
        gctx.lineJoin = "round";
        gctx.globalCompositeOperation = "lighter";
        for (let k = 0; k < 2; k++) {
          const b0 = k * (N + 1);
          let iMin = b0;
          let iMax = b0;
          for (let i = b0; i < b0 + N; i++) {
            if (PZ[i] < PZ[iMin]) iMin = i;
            if (PZ[i] > PZ[iMax]) iMax = i;
          }
          const ringPath = () => {
            gctx.beginPath();
            gctx.moveTo(PX[b0], PY[b0]);
            for (let i = b0 + 1; i <= b0 + N; i++) gctx.lineTo(PX[i], PY[i]);
          };
          const passes = [
            [26, 0.035, 0.12],
            [10, 0.07, 0.26],
          ];
          for (let q = 0; q < passes.length; q++) {
            const g = gctx.createLinearGradient(PX[iMin], PY[iMin], PX[iMax], PY[iMax]);
            g.addColorStop(0, `rgba(${inkRGB},${(passes[q][1] * ga).toFixed(4)})`);
            g.addColorStop(1, `rgba(${inkRGB},${(passes[q][2] * ga).toFixed(4)})`);
            gctx.strokeStyle = g;
            gctx.lineWidth = passes[q][0];
            ringPath();
            gctx.stroke();
          }
          const hp = k === 0 ? hl0 : Math.PI - hl0;
          const hi = Math.round(((((hp % TAU) + TAU) % TAU) / TAU) * N);
          const span = 11;
          gctx.beginPath();
          for (let o = -span; o <= span; o++) {
            const i = b0 + ((((hi + o) % N) + N) % N);
            if (o === -span) gctx.moveTo(PX[i], PY[i]);
            else gctx.lineTo(PX[i], PY[i]);
          }
          gctx.strokeStyle = `rgba(${inkRGB},${(0.2 * ga).toFixed(4)})`;
          gctx.lineWidth = 12;
          gctx.stroke();
        }
        if (mask.w > 0) {
          gctx.globalCompositeOperation = "destination-out";
          gctx.setTransform(GS * mask.w, 0, 0, GS * mask.h, GS * mask.x, GS * my);
          const rg = gctx.createRadialGradient(0, 0, 0, 0, 0, 1);
          rg.addColorStop(0, `rgba(0,0,0,${(0.85 * e).toFixed(3)})`);
          rg.addColorStop(0.6, `rgba(0,0,0,${(0.6 * e).toFixed(3)})`);
          rg.addColorStop(1, "rgba(0,0,0,0)");
          gctx.fillStyle = rg;
          gctx.fillRect(-1, -1, 2, 2);
          gctx.setTransform(1, 0, 0, 1, 0, 0);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    function pathAlong(list) {
      ctx.beginPath();
      const a0 = segIdx[list[0]];
      ctx.moveTo(PX[a0], PY[a0]);
      for (let i = 0; i < list.length; i++) {
        const a = segIdx[list[i]];
        ctx.lineTo(PX[a + 1], PY[a + 1]);
      }
    }

    function runs(c2, ring, A, Wd, qa, qw) {
      const base = ring * N;
      let i = 0;
      while (i < N) {
        const s0 = base + i;
        const ka = Math.round(A[s0] * qa);
        const kw = Math.round(Wd[s0] * qw);
        const a0 = segIdx[s0];
        c2.beginPath();
        c2.moveTo(PX[a0], PY[a0]);
        let j = i;
        while (j < N) {
          const s = base + j;
          if (j > i && (Math.round(A[s] * qa) !== ka || Math.round(Wd[s] * qw) !== kw)) break;
          const a = segIdx[s];
          c2.lineTo(PX[a + 1], PY[a + 1]);
          j++;
        }
        if (ka > 0) {
          c2.globalAlpha = ka / qa;
          c2.lineWidth = kw / qw;
          c2.stroke();
        }
        i = j;
      }
    }

    function placeChips(t, sc) {
      const time = t * 0.001;
      for (let i = 0; i < chips.length; i++) {
        const ch = chips[i];
        if (!ch.on) continue;
        const c = ch.c;
        const par = 1 - c.d;
        const ci = clamp(chipIntro * 1.6 - i * 0.07, 0, 1);
        const ce = easeOut(ci);
        const x = ch.x - ch.w / 2 + px * par * 28 + Math.sin(time * ch.sp + ch.ph) * 7;
        const y =
          ch.y -
          ch.h / 2 +
          py * par * 18 +
          Math.cos(time * ch.sp * 0.8 + ch.ph) * 9 -
          sc * H * (0.12 + par * 0.55) +
          (1 - ce) * 24;
        const ry = Math.sin(time * 0.3 + ch.ph) * 9 + px * 14 * par;
        const rx = Math.cos(time * 0.26 + ch.ph) * 7 - py * 10 * par;
        const sca = (1 - c.d * 0.38) * lerp(0.94, 1, ce);
        ch.el.style.transform =
          "translate3d(" +
          x.toFixed(1) +
          "px," +
          y.toFixed(1) +
          "px,0) rotateX(" +
          rx.toFixed(2) +
          "deg) rotateY(" +
          ry.toFixed(2) +
          "deg) rotateZ(" +
          c.rz +
          "deg) scale(" +
          sca.toFixed(3) +
          ")";
        ch.el.style.opacity = ((1 - c.d * 0.5) * ce * clamp(1 - sc * 1.3, 0, 1)).toFixed(3);
      }
    }

    function frame(dt, _t) {
      clock += dt;
      if (introState === "run") {
        intro = Math.min(1, intro + dt / 1900);
        chipIntro = Math.min(1, chipIntro + dt / 1800);
        if (intro >= 1 && chipIntro >= 1) introState = "done";
      } else if (introState === "wait" && root.classList.contains("loader-gone")) {
        intro = 1;
        chipIntro = 1;
        introState = "done";
      }
      const k = 1 - Math.exp(-dt / 420);
      px += (S.tx - px) * k;
      py += (S.ty - py) * k;
      const sc = clamp(S.y / H, 0, 1);
      draw(clock, sc);
      placeChips(clock, sc);
      if (sc !== lastSc) {
        lastSc = sc;
        inner.style.transform =
          sc > 0 ? `translate3d(0,${(-sc * 110).toFixed(1)}px,0) scale(${(1 - sc * 0.06).toFixed(4)})` : "";
        inner.style.opacity = sc > 0 ? clamp(1 - sc * 1.25, 0, 1).toFixed(3) : "";
      }
    }

    function staticFrame() {
      px = 0;
      py = 0;
      intro = 1;
      chipIntro = 1;
      draw(9000, 0);
      placeChips(9000, 0);
    }

    function setActive(on) {
      if (reduce) return;
      if (on === active) return;
      active = on;
      if (on) Ticker.add(frame);
      else Ticker.remove(frame);
    }

    layout();

    return {
      el: hero,
      layout() {
        layout();
        if (reduce || !active) staticFrameOr();
      },
      prepare(markRect) {
        setFrom(markRect);
        intro = 0;
        chipIntro = 0;
        introState = "wait";
        draw(0, 0);
        placeChips(0, 0);
      },
      begin(markRect) {
        if (markRect) setFrom(markRect);
        introState = "run";
        clock = 0;
        setActive(true);
      },
      start() {
        if (reduce) {
          staticFrame();
          return;
        }
        clock = 4000;
        setActive(true);
      },
      update() {
        if (reduce || introState === "wait") return;
        setActive(S.y < H + 4);
      },
    };

    function setFrom(r) {
      const h = r.height || 52;
      from = {
        x: r.left + r.width / 2,
        y: r.top + h / 2 - hero.getBoundingClientRect().top,
        s: (h * 8.75) / 32 / R,
        stroke: h / 16,
      };
    }

    function staticFrameOr() {
      if (reduce) staticFrame();
      else {
        const sc = clamp(S.y / H, 0, 1);
        draw(clock, sc);
        placeChips(clock, sc);
      }
    }
  }

  function createLoader(hero) {
    const loader = $("#loader");
    const pct = $("#loader-pct");
    const mark = $(".loader__mark");
    if (!loader || !root.classList.contains("is-loading")) {
      hero.start();
      return;
    }
    root.classList.add("is-intro");
    let fontsOk = false;
    let shown = -1;
    let done = false;
    const t0 = performance.now();
    fontsReady.then(() => {
      fontsOk = true;
    });
    hero.prepare(mark.getBoundingClientRect());
    const tick = () => {
      const el = performance.now() - t0;
      let target = fontsOk ? 100 : 72;
      if (el > 1700) target = 100;
      const v = Math.min(target, Math.round(100 * (1 - (1 - Math.min(1, el / 620)) ** 2.2)));
      if (v !== shown) {
        shown = v;
        pct.textContent = String(v);
      }
      if (shown >= 100 && !done) leave();
    };
    const leave = () => {
      done = true;
      Ticker.remove(tick);
      clearTimeout(failsafe);
      loader.classList.add("is-leaving");
      root.classList.remove("is-loading");
      hero.begin(mark.getBoundingClientRect());
      requestAnimationFrame(() => root.classList.add("is-intro-run"));
      store.set("secmgr-home-seen", "1", true);
      setTimeout(() => {
        root.classList.add("loader-gone");
      }, 620);
      setTimeout(() => {
        root.classList.remove("is-intro", "is-intro-run");
      }, 1600);
    };
    const failsafe = setTimeout(() => {
      if (!done) {
        pct.textContent = "100";
        leave();
      }
    }, 2300);
    Ticker.add(tick);
  }

  function splitWords(el) {
    const words = [];
    const walk = (node) => {
      Array.prototype.slice.call(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = doc.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) {
              frag.appendChild(doc.createTextNode(p));
              return;
            }
            const s = doc.createElement("span");
            s.className = "w";
            s.textContent = p;
            frag.appendChild(s);
            words.push(s);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    return words;
  }

  function createManifesto() {
    const el = $("#manifesto");
    const text = $("#manifesto-text");
    if (reduce) return { update() {} };
    const words = splitWords(text);
    let lit = -1;
    return {
      update() {
        const m = sec(el);
        if (!m) return;
        const p = clamp((S.y - m.top + S.vh * 0.45) / (m.h - S.vh * 0.85), 0, 1);
        const n = Math.round(p * words.length);
        if (n === lit) return;
        const from = Math.max(0, Math.min(n, lit));
        const to = Math.max(n, lit);
        for (let i = from; i < to && i < words.length; i++) words[i].classList.toggle("is-lit", i < n);
        lit = n;
      },
    };
  }

  function createGiant() {
    const svg = $("#footer-word");
    const footer = $(".footer");
    let last = -1;
    return {
      update() {
        if (reduce) return;
        const f = sec(footer);
        if (!f) return;
        const p = clamp((S.y + S.vh - f.top) / f.h, 0, 1);
        const y = lerp(46, 8, easeOutSoft(p));
        if (Math.abs(y - last) < 0.05) return;
        last = y;
        svg.style.transform = `translate3d(0,${y.toFixed(2)}%,0)`;
      },
    };
  }

  const TILE_DATA = [
    { t: "secret", key: "STRIPE_SECRET_KEY", val: `sk_live_${dots(6)}`, lock: true },
    { t: "env", name: "production", c: "rose", lock: true },
    { t: "secret", key: "DATABASE_URL", val: `postgres://${dots(5)}` },
    { t: "badge", icon: "timer-reset", text: "Rotation due", tone: "warn" },
    { t: "env", name: "staging", c: "amber" },
    { t: "secret", key: "JWT_SIGNING_KEY", val: dots(10) },
    { t: "token", key: "ci-deploy", val: "smg_live_7Hk2\u2026Qp4" },
    { t: "env", name: "development", c: "blue" },
    { t: "secret", key: "RESEND_API_KEY", val: `re_${dots(7)}` },
    { t: "badge", icon: "check", text: "Saved 3 changes", tone: "ok" },
    { t: "secret", key: "OPENAI_API_KEY", val: `sk-proj-${dots(5)}` },
    { t: "env", name: "preview", c: "violet" },
    { t: "secret", key: "SESSION_SECRET", val: dots(8) },
    { t: "badge", icon: "triangle-alert", text: "Shared live key", tone: "danger" },
    { t: "secret", key: "AWS_SECRET_ACCESS_KEY", val: dots(9) },
    { t: "secret", key: "POSTHOG_KEY", val: `phc_${dots(6)}` },
    { t: "badge", icon: "lock", text: "Protected", tone: "" },
    { t: "secret", key: "SENTRY_DSN", val: `https://${dots(5)}` },
    { t: "env", name: "production", c: "rose", lock: true },
    { t: "secret", key: "STRIPE_WEBHOOK_SECRET", val: `whsec_${dots(5)}` },
    { t: "token", key: "vercel-preview", val: `smg_live_${dots(4)}` },
    { t: "secret", key: "REDIS_URL", val: `redis://${dots(4)}` },
    { t: "badge", icon: "history", text: "Updated 4 min ago", tone: "" },
    { t: "secret", key: "AWS_ACCESS_KEY_ID", val: `AKIA${dots(6)}` },
  ];

  function createCta() {
    const section = $("#get-started");
    const host = $("#cta-tiles");
    let tiles = [];
    let W = 0;
    let H = 0;
    let active = false;
    let clock = 0;
    let px = 0;
    let py = 0;

    function build() {
      host.innerHTML = "";
      W = section.clientWidth;
      H = section.clientHeight;
      const small = W < 720;
      const cols = small ? 3 : W < 1100 ? 5 : 6;
      const rows = small ? 7 : 5;
      const rand = rng(29);
      const exW = small ? W * 0.5 : Math.min(420, W * 0.3);
      const exH = small ? 170 : 190;
      const cells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = ((c + 0.5 + (rand() - 0.5) * 0.7) / cols - 0.5) * W * 1.04;
          const y = ((r + 0.5 + (rand() - 0.5) * 0.6) / rows - 0.5) * H * 0.92;
          if (Math.abs(x) < exW && Math.abs(y) < exH) continue;
          cells.push([x, y]);
        }
      }
      tiles = cells.map((pos, i) => {
        const data = TILE_DATA[i % TILE_DATA.length];
        const el = doc.createElement("div");
        let cls = "tile";
        let html = "";
        if (data.t === "secret" || data.t === "token") {
          if (data.t === "token") cls += " tile--token";
          html =
            '<span class="tile__key">' +
            data.key +
            '</span><span class="tile__val"><span class="tile__dots">' +
            data.val +
            "</span>" +
            (data.lock ? ic("lock", 14) : "") +
            "</span>";
        } else if (data.t === "env") {
          cls += " tile--env";
          html =
            '<span class="env-dot" style="--_c: var(--env-' +
            data.c +
            ')"></span>' +
            data.name +
            (data.lock ? ic("lock", 13) : "");
        } else {
          cls += ` tile--badge${data.tone ? ` tile--${data.tone}` : ""}`;
          html = ic(data.icon, 14) + data.text;
        }
        el.className = cls;
        el.innerHTML = html;
        host.appendChild(el);
        const z = -rand() * 620 + 90;
        if (z < -340) el.style.filter = `blur(${z < -480 ? 2.4 : 1.2}px)`;
        return {
          el,
          x: pos[0],
          y: pos[1],
          z,
          rx: (rand() - 0.5) * 44,
          ry: (rand() - 0.5) * 56,
          rz: (rand() - 0.5) * 22,
          ph: rand() * 6.28,
          sp: 0.4 + rand() * 0.5,
          a: clamp(0.4 + ((z + 620) / 710) * 0.6, 0, 1),
        };
      });
      hydrate(host);
    }

    function place(t) {
      const s = sec(section);
      if (!s) return;
      const top = s.top - S.y;
      const p = clamp(1 - top / S.vh, 0, 1.6);
      const inP = easeOutSoft(clamp(p, 0, 1));
      const out = Math.max(0, p - 1);
      const time = t * 0.001;
      for (let i = 0; i < tiles.length; i++) {
        const q = tiles[i];
        const depth = (q.z + 620) / 710;
        const z = q.z - (1 - inP) * 1100 + out * 260 * (0.4 + depth);
        const x = q.x * lerp(0.55, 1, inP) + px * (10 + depth * 36);
        const y =
          q.y * lerp(0.6, 1, inP) + py * (8 + depth * 24) + Math.sin(time * q.sp + q.ph) * 8 - out * 120 * depth;
        const rx = q.rx * lerp(1.8, 1, inP) + Math.sin(time * 0.4 + q.ph) * 3;
        const ry = q.ry * lerp(1.8, 1, inP) + Math.cos(time * 0.35 + q.ph) * 4;
        q.el.style.transform =
          "translate(-50%,-50%) translate3d(" +
          x.toFixed(1) +
          "px," +
          y.toFixed(1) +
          "px," +
          z.toFixed(1) +
          "px) rotateX(" +
          rx.toFixed(2) +
          "deg) rotateY(" +
          ry.toFixed(2) +
          "deg) rotateZ(" +
          q.rz.toFixed(2) +
          "deg)";
        const sy = top + H / 2 + y;
        const edge = clamp((sy - 70) / 90, 0, 1);
        q.el.style.opacity = (q.a * clamp(inP * 1.4 - 0.15, 0, 1) * edge).toFixed(3);
      }
    }

    function frame(dt) {
      clock += dt;
      const k = 1 - Math.exp(-dt / 500);
      px += (S.tx - px) * k;
      py += (S.ty - py) * k;
      place(clock);
    }

    build();
    if (reduce) {
      tiles.forEach((q) => {
        q.el.style.transform =
          "translate(-50%,-50%) translate3d(" +
          q.x.toFixed(1) +
          "px," +
          q.y.toFixed(1) +
          "px," +
          q.z.toFixed(1) +
          "px) rotateX(" +
          q.rx.toFixed(2) +
          "deg) rotateY(" +
          q.ry.toFixed(2) +
          "deg) rotateZ(" +
          q.rz.toFixed(2) +
          "deg)";
        q.el.style.opacity = String(q.a);
      });
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting && !active) {
              active = true;
              Ticker.add(frame);
            } else if (!en.isIntersecting && active) {
              active = false;
              Ticker.remove(frame);
            }
          });
        },
        { rootMargin: "10% 0px 10% 0px" },
      );
      io.observe(section);
    }
    return {
      layout() {
        const w = section.clientWidth;
        if (Math.abs(w - W) > 40 || Math.abs(section.clientHeight - H) > 80) {
          build();
          if (reduce)
            tiles.forEach((q) => {
              q.el.style.opacity = String(q.a);
              q.el.style.transform =
                "translate(-50%,-50%) translate3d(" +
                q.x +
                "px," +
                q.y +
                "px," +
                q.z +
                "px) rotateX(" +
                q.rx +
                "deg) rotateY(" +
                q.ry +
                "deg) rotateZ(" +
                q.rz +
                "deg)";
            });
          else place(clock);
        }
      },
    };
  }

  function director(section, demo) {
    if (reduce) {
      demo.final();
      return;
    }
    let gen = null;
    let wait = 0;
    let active = false;
    const tick = (dt) => {
      wait -= dt;
      let guard = 0;
      while (wait <= 0 && guard++ < 40) {
        if (!gen) gen = demo.run();
        const r = gen.next();
        if (r.done) {
          gen = null;
          continue;
        }
        wait += r.value || 0;
      }
    };
    section.classList.add("is-static");
    demo.final();
    void section.offsetWidth;
    section.classList.add("is-paused");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          const on = en.isIntersecting;
          if (on && !active) {
            active = true;
            section.classList.remove("is-paused", "is-static");
            Ticker.add(tick);
          } else if (!on && active) {
            active = false;
            section.classList.add("is-paused");
            Ticker.remove(tick);
          }
        });
      },
      { threshold: 0.3 },
    );
    io.observe($(".frame", section));
  }

  const envb = (name, c, lock) =>
    '<span class="envb envb--' +
    c +
    '"><span class="env-dot"></span>' +
    name +
    (lock ? ic("lock", 12) : "") +
    "</span>";

  function importDemo() {
    const host = $("#demo-import");
    const LINES = [
      [
        "DATABASE_URL",
        "postgres://lumen:k3P9v2x@db.internal:5432/lumen",
        "new",
        `postgres://lumen:${dots(4)}@db.internal:5432/lumen`,
      ],
      ["DATABASE_POOL_SIZE", "20", "changed", ["10", "20"]],
      ["REDIS_URL", "redis://cache.internal:6379", "new", "redis://cache.internal:6379"],
      ["STRIPE_SECRET_KEY", "sk_test_51NzQ8vK2eYh4Tq7Lm0RbX", "new", `sk_test_51N${dots(6)}`],
      ["STRIPE_WEBHOOK_SECRET", "whsec_9f2Kd81LmQpZ", "new", `whsec_${dots(6)}`],
      ["SENTRY_DSN", "https://4f1c@o77.ingest.sentry.io/12", "new", `https://${dots(4)}@o77.ingest.sentry.io/12`],
      ["RESEND_API_KEY", "re_Hq72bXk9Ws", "new", `re_${dots(6)}`],
      ["OPENAI_API_KEY", "sk-proj-7yTq0xLm2Vd8", "new", `sk-proj-${dots(6)}`],
      ["JWT_SIGNING_KEY", "Qm9vdHN0cmFwLWtleQ", "new", dots(10)],
      ["SESSION_SECRET", "a8f1c07e9b3d", "new", dots(10)],
      ["S3_BUCKET", "lumen-uploads-staging", "new", "lumen-uploads-staging"],
      ["AWS_REGION", "eu-west-1", "new", "eu-west-1"],
      ["API_BASE_URL", "https://staging-api.lumen.dev", "new", "https://staging-api.lumen.dev"],
      ["LOG_LEVEL", "info", "changed", ["debug", "info"]],
      ["FEATURE_NEW_CHECKOUT", "true", "changed", ["false", "true"]],
      ["MAX_UPLOAD_MB", null, "invalid", "Line 16: missing ="],
    ];
    const tone = {
      new: ["badge--success", "New", "var(--success)"],
      changed: ["badge--warning", "Changed", "var(--warning)"],
      invalid: ["badge--danger", "Invalid", "var(--danger)"],
    };
    host.innerHTML =
      '<div class="panel__head"><span class="panel__title">' +
      ic("upload", 16) +
      '<span class="imp__title-text">Import .env</span></span><span class="imp__title-into" style="color: var(--text-tertiary)">into</span>' +
      envb("staging", "amber") +
      '<span class="panel__spacer"></span><span class="imp__counts"><span class="badge badge--success">12 new</span><span class="badge badge--warning">3 changed</span><span class="badge badge--danger">1 invalid</span></span></div>' +
      '<div class="imp__area"><div class="imp__hint"><span class="imp__hint-icon">' +
      ic("clipboard-paste", 18) +
      '</span><span>Paste a .env or drop a file</span><span class="kbd-group"><kbd class="kbd">\u2318</kbd><kbd class="kbd">V</kbd></span></div>' +
      '<ol class="imp__raw">' +
      LINES.map((l, i) => {
        const bad = l[2] === "invalid";
        return (
          '<li class="imp__line' +
          (bad ? " is-bad" : "") +
          '" style="--_m: ' +
          tone[l[2]][2] +
          '"><span class="ln">' +
          (i + 1) +
          '</span><span class="c-k">' +
          l[0] +
          "</span>" +
          (bad ? '<span class="c-v"> 25</span>' : `<span class="c-p">=</span><span class="c-v">${l[1]}</span>`) +
          "</li>"
        );
      }).join("") +
      '</ol><div class="imp__scan"></div>' +
      '<ol class="imp__rows">' +
      LINES.map((l) => {
        let v = l[3];
        if (Array.isArray(v)) v = `<s>${v[0]}</s> ${ARROW} <b>${v[1]}</b>`;
        return (
          '<li class="imp__row" data-s="' +
          l[2] +
          '"><span class="badge ' +
          tone[l[2]][0] +
          '">' +
          tone[l[2]][1] +
          '</span><span class="k">' +
          l[0] +
          '</span><span class="v">' +
          v +
          "</span></li>"
        );
      }).join("") +
      "</ol></div>" +
      '<div class="changes"><span class="changes__count"><i></i>15 changes</span><span class="changes__sep"></span><span class="btn btn--ghost">Discard</span><span class="btn btn--secondary">Review</span><span class="btn btn--primary" data-save>Save 15 changes</span></div>' +
      '<div class="toast">' +
      ic("circle-check", 16) +
      "Saved 15 changes to staging<u>Undo</u></div>";
    hydrate(host);
    const lines = $$(".imp__line", host);
    const rows = $$(".imp__row", host);
    const raw = $(".imp__raw", host);
    const scan = $(".imp__scan", host);
    const save = $("[data-save]", host);
    const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
    const reset = () => {
      host.className = "panel imp";
      raw.classList.remove("is-gone");
      lines.forEach((l) => {
        l.classList.remove("is-in", "is-marked");
      });
      rows.forEach((r) => {
        r.classList.remove("is-in", "is-saved");
        r.getAnimations().forEach((a) => {
          a.cancel();
        });
      });
      scan.getAnimations().forEach((a) => {
        a.cancel();
      });
    };
    return {
      idle: reset,
      final() {
        reset();
        host.classList.add("is-pasted", "has-counts", "has-bar");
        raw.classList.add("is-gone");
        rows.forEach((r) => {
          r.classList.add("is-in");
        });
      },
      run: function* () {
        reset();
        yield 900;
        host.classList.add("is-pasted");
        for (let i = 0; i < lines.length; i++) {
          lines[i].classList.add("is-in");
          yield 32;
        }
        yield 520;
        const areaH = raw.offsetHeight;
        scan.animate(
          [
            { opacity: 0, transform: "translateY(-40px)" },
            { opacity: 1, transform: `translateY(${areaH * 0.1}px)`, offset: 0.1 },
            { opacity: 1, transform: `translateY(${areaH - 30}px)`, offset: 0.9 },
            { opacity: 0, transform: `translateY(${areaH}px)` },
          ],
          { duration: 900, easing: "linear" },
        );
        for (let i = 0; i < lines.length; i++) {
          lines[i].classList.add("is-marked");
          yield 50;
        }
        yield 380;
        const deltas = rows.map((r, i) => {
          const a = $(".c-k", lines[i]).getBoundingClientRect();
          const b = $(".k", r).getBoundingClientRect();
          return [a.left - b.left, a.top - b.top];
        });
        raw.classList.add("is-gone");
        rows.forEach((r, i) => {
          r.classList.add("is-in");
          r.animate(
            [
              { transform: `translate(${deltas[i][0]}px,${deltas[i][1]}px)`, opacity: 0 },
              {
                transform: `translate(${deltas[i][0] * 0.2}px,${deltas[i][1] * 0.2}px)`,
                opacity: 1,
                offset: 0.45,
              },
              { transform: "none", opacity: 1 },
            ],
            { duration: 720, delay: i * 26, easing: EASE, fill: "backwards" },
          );
        });
        yield 900;
        host.classList.add("has-counts");
        yield 700;
        host.classList.add("has-bar");
        yield 2600;
        save.classList.add("is-pressed");
        yield 180;
        save.classList.remove("is-pressed");
        host.classList.remove("has-bar");
        rows.forEach((r) => {
          if (r.getAttribute("data-s") !== "invalid") r.classList.add("is-saved");
        });
        yield 240;
        host.classList.add("has-toast");
        yield 2600;
        host.classList.add("is-fading");
        yield 520;
      },
    };
  }

  function compareDemo() {
    const host = $("#demo-compare");
    const M = dots(8);
    const ROWS = [
      {
        key: "API_BASE_URL",
        v: ["localhost:8080", "staging-api.lumen.dev", "api.lumen.dev"],
        s: ["differs", "differs", "differs"],
        diff: true,
      },
      { key: "DATABASE_URL", v: [M, M, M], s: ["differs", "differs", "differs"], diff: true },
      { key: "DATABASE_POOL_SIZE", v: ["20", "20", "20"], s: ["same", "same", "same"], diff: false },
      { key: "LOG_LEVEL", v: ["debug", "info", "warn"], s: ["differs", "differs", "differs"], diff: true },
      {
        key: "STRIPE_SECRET_KEY",
        v: [`sk_test_51N${dots(4)}`, `sk_live_51N${dots(4)}`, `sk_live_51N${dots(4)}`],
        s: ["differs", "shared", "shared"],
        diff: true,
        warn: true,
      },
      { key: "FEATURE_NEW_CHECKOUT", v: ["true", "true", null], s: ["same", "same", "missing"], diff: true },
      { key: "AWS_REGION", v: ["eu-west-1", "eu-west-1", "eu-west-1"], s: ["same", "same", "same"], diff: false },
      { key: "SENTRY_DSN", v: [M, M, M], s: ["same", "same", "same"], diff: false },
    ];
    const RH = 38;
    host.innerHTML =
      '<div class="panel__head"><span class="panel__title">' +
      ic("git-compare-arrows", 16) +
      'Compare</span><span class="cmp__envs">' +
      envb("development", "blue") +
      envb("staging", "amber") +
      envb("production", "rose", true) +
      '</span><span class="panel__spacer"></span><span class="cmp__toggle"><span class="switch"></span><span class="cmp__toggle-label">Differences only</span></span></div>' +
      '<div class="cmp__grid"><div class="cmp__cols"><span>Key</span><span><span class="env-dot" style="--_c: var(--env-blue)"></span>development</span><span><span class="env-dot" style="--_c: var(--env-amber)"></span>staging</span><span><span class="env-dot" style="--_c: var(--env-rose)"></span>production' +
      ic("lock", 12) +
      "</span></div>" +
      '<div class="cmp__rows">' +
      ROWS.map(
        (r) =>
          '<div class="cmp__row"><span class="cmp__key"><span>' +
          r.key +
          "</span>" +
          (r.warn
            ? '<span class="cmp__warn">' +
              ic("triangle-alert", 12) +
              '<span class="cmp__warn-label">Shared live key</span></span>'
            : "") +
          "</span>" +
          r.v
            .map(
              (v, i) =>
                '<span class="cmp__cell" data-s="' +
                r.s[i] +
                '">' +
                (v === null ? `${ic("plus", 12)}<span>Missing</span>` : `<span>${v}</span>`) +
                "</span>",
            )
            .join("") +
          "</div>",
      ).join("") +
      "</div></div>" +
      '<div class="cmp__foot"><span><i style="background: var(--warning)"></i><b>4</b> differ</span><span><i style="background: var(--danger)"></i><b>1</b> missing</span><span><i style="background: var(--danger); border-radius: var(--radius-full)"></i><b>1</b> live key outside production</span></div>';
    hydrate(host);
    const rows = $$(".cmp__row", host);
    const cells = rows.map((r) => $$(".cmp__cell", r));
    const setDiffOnly = (on) => {
      host.classList.toggle("is-diff-only", on);
      let idx = 0;
      rows.forEach((r, i) => {
        const show = !on || ROWS[i].diff;
        r.classList.toggle("is-hidden", !show);
        r.style.transform = `translateY(${show ? idx * RH : (idx - 0.4) * RH}px)${show ? "" : " scale(0.98)"}`;
        if (show) idx++;
      });
    };
    const reset = () => {
      host.className = "panel cmp";
      setDiffOnly(false);
      rows.forEach((r) => {
        r.classList.remove("is-keyed");
      });
      cells.forEach((cs) => {
        cs.forEach((c) => {
          c.classList.remove("is-in");
        });
      });
    };
    return {
      idle: reset,
      final() {
        reset();
        rows.forEach((r) => {
          r.classList.add("is-keyed");
        });
        cells.forEach((cs) => {
          cs.forEach((c) => {
            c.classList.add("is-in");
          });
        });
        host.classList.add("is-pulsing", "has-warn", "has-foot");
      },
      run: function* () {
        reset();
        yield 500;
        for (let i = 0; i < rows.length; i++) {
          rows[i].classList.add("is-keyed");
          yield 50;
        }
        yield 120;
        for (let dsum = 0; dsum < rows.length + 3; dsum++) {
          cells.forEach((cs, r) => {
            cs.forEach((c, k) => {
              if (r + k === dsum) c.classList.add("is-in");
            });
          });
          yield 60;
        }
        yield 500;
        host.classList.add("is-pulsing");
        yield 1000;
        host.classList.add("has-warn");
        yield 700;
        host.classList.add("has-foot");
        yield 2600;
        for (let k = 0; k < 2; k++) {
          setDiffOnly(true);
          yield 3000;
          setDiffOnly(false);
          yield 2600;
        }
        rows.forEach((r) => {
          r.classList.remove("is-keyed");
        });
        cells.forEach((cs) => {
          cs.forEach((c) => {
            c.classList.remove("is-in");
          });
        });
        host.classList.remove("has-foot", "has-warn", "is-pulsing");
        yield 600;
      },
    };
  }

  function cliDemo() {
    const term = $("#demo-cli");
    const inner = $(".term__inner", term);
    const cmds = $$("#cli-cmds li");
    const add = (html, cls) => {
      const l = doc.createElement("div");
      l.className = `term__line${cls ? ` ${cls}` : ""}`;
      l.innerHTML = html || " ";
      inner.appendChild(l);
      follow();
      return l;
    };
    const follow = () => {
      const over = inner.offsetHeight - (term.clientHeight - 32);
      inner.style.transform = over > 0 ? `translateY(${-over}px)` : "";
    };
    const prompt = () => {
      const l = add('<span class="term__pr">$</span><span class="term__cmd"></span><span class="term__caret"></span>');
      return { line: l, cmd: $(".term__cmd", l), caret: $(".term__caret", l) };
    };
    const t = (s) => `<span class="term__time">${s}</span>`;
    const RUN = [
      [
        '<span class="term__ok">' +
          ic("check", 14) +
          "<span>Injected <b>24 secrets</b> from lumen-api/staging</span></span>",
        260,
      ],
      ["", 60],
      ['<span class="term__dim">&gt; lumen-api@1.4.0 dev</span>', 90],
      ['<span class="term__dim">&gt; go run ./cmd/api</span>', 520],
      ["", 40],
      [`${t("12:04:31")} <span class="term__inf">INF</span> connected to postgres db.internal:5432`, 200],
      [`${t("12:04:31")} <span class="term__inf">INF</span> redis ready cache.internal:6379`, 160],
      [`${t("12:04:32")} <span class="term__inf">INF</span> stripe webhook route /webhooks/stripe`, 220],
      [`${t("12:04:32")} <span class="term__inf">INF</span> listening on http://localhost:8080`, 120],
    ];
    const DIFF = [
      ['<span class="term__dim">Comparing lumen-api/staging with lumen-api/production</span>', 200],
      [`<span class="term__warn">  ~ LOG_LEVEL             info ${ARROW} warn</span>`, 110],
      ['<span class="term__bad">  - FEATURE_NEW_CHECKOUT  missing in production</span>', 110],
      ['<span class="term__bad">  ! STRIPE_SECRET_KEY     same live key in both</span>', 160],
      ["<span>3 differences</span>", 80],
    ];
    const PULL = [[`<span class="term__ok">${ic("check", 14)}<span>Wrote <b>23 secrets</b> to .env</span></span>`, 80]];
    const setCmd = (i) =>
      cmds.forEach((c, k) => {
        c.classList.toggle("is-on", k === i);
      });
    const reset = () => {
      inner.innerHTML = "";
      inner.style.transform = "";
      setCmd(-1);
    };
    function* type(p, text) {
      for (let i = 0; i < text.length; i++) {
        p.cmd.textContent += text[i];
        yield text[i] === " " ? 70 : 24 + Math.random() * 38;
      }
    }
    function* out(list) {
      for (let i = 0; i < list.length; i++) {
        const l = add(list[i][0]);
        hydrate(l);
        yield list[i][1];
      }
    }
    return {
      idle: () => {
        reset();
        prompt();
      },
      final() {
        reset();
        const p = prompt();
        p.cmd.textContent = "secmgr run --env staging -- npm run dev";
        p.caret.remove();
        RUN.forEach((r) => {
          add(r[0]);
        });
        hydrate(inner);
        add("");
        prompt();
        setCmd(0);
      },
      run: function* () {
        reset();
        let p = prompt();
        yield 700;
        setCmd(0);
        yield* type(p, "secmgr run --env staging -- npm run dev");
        yield 380;
        p.caret.remove();
        yield* out(RUN);
        add("");
        p = prompt();
        yield 2600;
        setCmd(1);
        yield* type(p, "secmgr diff staging production");
        yield 320;
        p.caret.remove();
        yield* out(DIFF);
        add("");
        p = prompt();
        yield 2400;
        setCmd(2);
        yield* type(p, "secmgr pull --env production > .env");
        yield 300;
        p.caret.remove();
        yield* out(PULL);
        p = prompt();
        yield 3000;
        $$(".term__line", inner).forEach((l) => {
          l.classList.add("is-clearing");
        });
        yield 420;
      },
    };
  }

  function activityDemo() {
    const host = $("#demo-activity");
    const PEOPLE = {
      maya: ["MC", "Maya Chen"],
      jonas: ["JW", "Jonas Weber"],
      priya: ["PR", "Priya Raman"],
      leo: ["LM", "Leo Martins"],
      aiko: ["AT", "Aiko Tanaka"],
    };
    const code = (k) => `<code>${k}</code>`;
    const EV = [
      { who: "aiko", text: `compared ${envb("staging", "amber")} and ${envb("production", "rose", true)}` },
      { who: "leo", text: `imported 12 secrets into ${envb("staging", "amber")}` },
      { who: "maya", text: `rotated ${code("JWT_SIGNING_KEY")} in ${envb("production", "rose", true)}` },
      { token: "ci-deploy", text: `read 23 secrets from ${envb("production", "rose", true)}` },
      { who: "jonas", text: `revealed ${code("DATABASE_URL")} in ${envb("production", "rose", true)}` },
      { who: "priya", text: `updated ${code("STRIPE_SECRET_KEY")} in ${envb("staging", "amber")}` },
      { token: "vercel-preview", text: `read 18 secrets from ${envb("preview", "violet")}` },
      { who: "maya", text: `added ${code("FEATURE_NEW_CHECKOUT")} to ${envb("staging", "amber")}` },
      { token: "local-dev", text: `changed ${code("LOG_LEVEL")} in ${envb("development", "blue")}` },
      { who: "jonas", text: `shared ${code("RESEND_API_KEY")} with a one-time link` },
    ];
    const TIMES = ["just now", "4 min ago", "12 min ago", "38 min ago", "2 hours ago", "yesterday at 18:32", "Sep 12"];
    const RH = 60;
    const VISIBLE = 7;
    host.innerHTML =
      '<div class="panel__head"><span class="panel__title">' +
      ic("history", 16) +
      'Activity</span><span class="panel__spacer"></span><span class="act__filter">' +
      ic("users", 14) +
      'All members</span><span class="act__filter">' +
      ic("layers", 14) +
      'All environments</span><span class="act__live"><i></i><span>Live</span></span></div><ol class="act__list"></ol>';
    hydrate(host);
    const list = $(".act__list", host);
    let rows = [];
    let cursor = 0;
    const make = (ev) => {
      const li = doc.createElement("li");
      li.className = "act__row";
      const av = ev.token
        ? `<span class="act__av act__av--token">${ic("key-round", 14)}</span>`
        : `<span class="act__av">${PEOPLE[ev.who][0]}</span>`;
      const name = ev.token ? ev.token : PEOPLE[ev.who][1];
      li.innerHTML = `${av}<span class="act__text"><b>${name}</b> ${ev.text}</span><span class="act__time"></span>`;
      hydrate(li);
      return li;
    };
    const lay = () => {
      rows.forEach((r, i) => {
        r.el.style.transform = `translateY(${i * RH}px)`;
        r.el.style.opacity = i < VISIBLE ? "1" : "0";
        $(".act__time", r.el).textContent = TIMES[Math.min(i, TIMES.length - 1)];
      });
    };
    const fill = (ids) => {
      list.innerHTML = "";
      rows = ids.map((id) => {
        const el = make(EV[id]);
        list.appendChild(el);
        return { el, id };
      });
      lay();
    };
    const push = (id) => {
      const el = make(EV[id]);
      el.style.transform = `translateY(${-RH}px)`;
      el.style.opacity = "0";
      el.classList.add("is-new");
      list.insertBefore(el, list.firstChild);
      void el.offsetWidth;
      rows.unshift({ el, id });
      lay();
      const gone = rows.slice(VISIBLE + 1);
      rows = rows.slice(0, VISIBLE + 1);
      gone.forEach((r) => {
        r.el.remove();
      });
      setTimeout(() => el.classList.remove("is-new"), 900);
    };
    return {
      idle() {
        fill([2, 1, 0, 8, 7, 6, 9]);
        cursor = 3;
      },
      final() {
        fill([5, 4, 3, 2, 1, 0, 8]);
      },
      run: function* () {
        if (cursor === 0) {
          fill([2, 1, 0, 8, 7, 6, 9]);
          cursor = 3;
        }
        yield 700;
        for (;;) {
          push(cursor);
          cursor = (cursor + 1) % EV.length;
          yield cursor === 6 ? 4200 : 2500;
        }
      },
    };
  }

  function reveals() {
    const els = $$("[data-reveal]");
    $$(".features__grid .feature").forEach((f, i) => {
      f.style.transitionDelay = `${(i % 4) * 70 + Math.floor(i / 4) * 50}ms`;
    });
    $$(".chapter__stage").forEach((s) => {
      s.style.transitionDelay = "90ms";
    });
    $$(".oss__code").forEach((s) => {
      s.style.transitionDelay = "90ms";
    });
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((e) => {
        e.classList.add("is-in");
      });
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("is-in");
            io.unobserve(en.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    els.forEach((e) => {
      io.observe(e);
    });
  }

  measure();
  const hero = createHero();
  const manifesto = createManifesto();
  const giant = createGiant();
  const cta = createCta();
  reveals();
  director($("#import"), importDemo());
  director($("#compare"), compareDemo());
  director($("#cli"), cliDemo());
  director($("#activity"), activityDemo());
  createLoader(hero);

  const onScrollFrame = () => {
    Ticker.remove(onScrollFrame);
    S.y = window.scrollY;
    paintChrome();
    manifesto.update();
    giant.update();
    hero.update();
  };
  window.addEventListener(
    "scroll",
    () => {
      Ticker.add(onScrollFrame);
    },
    { passive: true },
  );

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      measure();
      hero.layout();
      cta.layout();
      onScrollFrame();
    }, 140);
  });

  fontsReady.then(() => {
    measure();
    hero.layout();
    onScrollFrame();
  });
  window.addEventListener("load", () => {
    measure();
    onScrollFrame();
  });
  onScrollFrame();
}
