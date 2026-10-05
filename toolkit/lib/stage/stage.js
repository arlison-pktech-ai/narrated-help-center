// The stage of the tutorial videos. The app runs unchanged inside an iframe;
// recorder.mjs drives the real mouse and keyboard and asks this page for the
// visible layer: a smoothed cursor or touch mark, click ripples, a camera
// that zooms on what matters, key chips, captions and title cards. Positions
// are in app coordinates (CSS px inside the iframe). Settings come from
// config.js (window.HELP_STAGE), written by recorder.mjs.
(() => {
  const setup = window.HELP_STAGE || {};
  const device = setup.device === "phone" ? "phone" : "desktop";
  const theme = setup.theme === "dark" ? "dark" : "light";
  const app = setup.app || (device === "phone" ? { width: 390, height: 763 } : { width: 1440, height: 900 });
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.device = device;
  if (setup.color) root.style.setProperty("--mark", setup.color);
  if (setup.font) root.style.setProperty("--font", setup.font);
  const W = innerWidth, H = innerHeight;
  const camera = document.getElementById("camera"), frame = document.getElementById("frame");
  const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const esc = (text) => String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ---------------------------------------------------------------- the frame
  const iframe = document.createElement("iframe");
  iframe.width = app.width;
  iframe.height = app.height;
  iframe.setAttribute("title", setup.title || "App");
  let inner = { x: 0, y: 0 }, size;
  if (device === "desktop") {
    frame.className = "window";
    frame.innerHTML = `<div class="titlebar"><i></i><i></i><i></i><span>${setup.symbol ? `<img src="${esc(setup.symbol)}" alt="">` : ""}${esc(setup.title || "")}</span></div>`;
    frame.append(iframe);
    inner = { x: 0, y: 38 };
    size = { width: app.width, height: app.height + 38 };
  } else {
    frame.className = "phone";
    frame.innerHTML = `<div class="screen"><div class="status"><span>9:41</span><span class="island"></span><span class="icons">
      <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
      <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 11.5 5.6 9.1a3.4 3.4 0 0 1 4.8 0L8 11.5Zm-4.2-4.2L2.4 5.9a8 8 0 0 1 11.2 0l-1.4 1.4a6 6 0 0 0-8.4 0ZM.9 4.4-.5 3a12 12 0 0 1 17 0l-1.4 1.4a10 10 0 0 0-14.2 0Z"/></svg>
      <svg width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x=".5" y=".5" width="23" height="12" rx="3.5" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="18" height="9" rx="2" fill="currentColor"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity=".45"/></svg>
      </span></div></div>`;
    const screen = frame.querySelector(".screen");
    screen.append(iframe);
    const home = document.createElement("div");
    home.className = "home";
    screen.append(home);
    inner = { x: 14, y: 14 + 47 };
    size = { width: app.width + 28, height: app.height + 47 + 34 + 28 };
  }
  frame.style.width = `${size.width}px`;
  frame.style.height = `${size.height}px`;

  const overlay = document.createElement("div");
  overlay.id = "overlay";
  overlay.style.cssText = `left:${inner.x}px;top:${inner.y}px;width:${app.width}px;height:${app.height}px`;
  overlay.innerHTML = device === "desktop"
    ? `<svg id="cursor" viewBox="0 0 24 24"><path d="M3.5 2.2v17.6l4.9-4.6 3 6.9 3.1-1.3-3-6.8h6.8L3.5 2.2Z" fill="#101114" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`
    : `<div id="touch"></div>`;
  camera.append(overlay);
  const pointer = overlay.firstElementChild;

  // --------------------------------------------------------------- the camera
  // Base: the frame centered with breathing room. Focus: a point of the app at
  // the stage center, zoomed, without showing past the frame's edges.
  const pad = setup.pad ?? (device === "desktop" ? { x: 110, y: 64 } : { x: 90, y: 96 });
  const base = Math.min((W - pad.x * 2) / size.width, (H - pad.y * 2) / size.height);
  const centered = (s) => ({ x: (W - size.width * s) / 2, y: (H - size.height * s) / 2, s });
  let view = centered(base), animation = null;
  const apply = () => { camera.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`; };
  apply();
  function target(ax, ay, zoom) {
    const s = base * zoom, px = inner.x + ax, py = inner.y + ay;
    let x = W / 2 - px * s, y = H / 2 - py * s;
    const margin = 24;
    const fit = (value, span, total) => span + margin * 2 <= total ? (total - span) / 2 : Math.min(margin, Math.max(total - span - margin, value));
    x = fit(x, size.width * s, W);
    y = fit(y, size.height * s, H);
    return { x, y, s };
  }
  function animate(to, ms) {
    const from = { ...view }, start = performance.now();
    if (animation) animation.cancel = true;
    const current = { cancel: false };
    animation = current;
    return new Promise((resolve) => {
      const step = (now) => {
        if (current.cancel) return resolve();
        const t = Math.min(1, (now - start) / ms), k = ease(t);
        view = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, s: from.s + (to.s - from.s) * k };
        apply();
        if (t < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  // --------------------------------------------------------- cursor and touch
  let cursor = { x: app.width * .62, y: app.height * .58 }, cursorVisible = device === "desktop", pressed = false;
  const place = () => {
    if (device === "desktop") pointer.style.transform = `translate(${cursor.x - 3}px, ${cursor.y - 3}px) scale(${pressed ? .86 : 1})`;
    else pointer.style.transform = `translate(${cursor.x}px, ${cursor.y}px) scale(${pressed ? .82 : 1})`;
  };
  pointer.style.opacity = cursorVisible ? "1" : "0";
  place();
  function moveTo(x, y, ms = 650) {
    const from = { ...cursor }, start = performance.now();
    const dx = x - from.x, dy = y - from.y, distance = Math.hypot(dx, dy);
    // A slight arc, like a hand moving a mouse.
    const bend = Math.min(60, distance * .12), control = { x: from.x + dx / 2 - dy / (distance || 1) * bend, y: from.y + dy / 2 + dx / (distance || 1) * bend };
    return new Promise((resolve) => {
      const step = (now) => {
        const t = Math.min(1, (now - start) / ms), k = ease(t), u = 1 - k;
        cursor = { x: u * u * from.x + 2 * u * k * control.x + k * k * x, y: u * u * from.y + 2 * u * k * control.y + k * k * y };
        place();
        if (t < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
  }
  function ripple() {
    const mark = document.createElement("span");
    mark.className = "ripple";
    mark.style.left = `${cursor.x}px`;
    mark.style.top = `${cursor.y}px`;
    overlay.append(mark);
    setTimeout(() => mark.remove(), 700);
  }
  async function press() {
    pressed = true; place();
    if (device === "phone") pointer.style.opacity = "1";
    ripple();
    await new Promise((resolve) => setTimeout(resolve, 120));
    pressed = false; place();
    // A touch mark only exists while the finger is on the screen.
    if (device === "phone" && !cursorVisible) setTimeout(() => { if (!cursorVisible) pointer.style.opacity = "0"; }, 260);
  }

  // ----------------------------------------------------- keys, captions, card
  const keys = document.getElementById("keys"), caption = document.getElementById("caption"), card = document.getElementById("card");
  // The cards show the wide logo; or the square symbol with the name.
  const brand = document.getElementById("card-brand"), logo = document.getElementById("card-logo");
  const wide = theme === "dark" ? setup.logoDark || setup.logoLight : setup.logoLight || setup.logoDark;
  if (wide) { logo.src = wide; brand.hidden = false; }
  else if (setup.symbol) { logo.src = setup.symbol; logo.classList.add("is-symbol"); document.getElementById("card-name").textContent = setup.title || ""; brand.hidden = false; }
  let keysTimer;

  window.stage = {
    device, theme, app, ready: new Promise((resolve) => iframe.addEventListener("load", resolve, { once: true })),
    load(src) { iframe.src = src; return this.ready; },
    // Colors of the app behind the phone's status bar and home indicator.
    paintPhone(topSelector, bottomSelector) {
      if (device !== "phone") return;
      const doc = iframe.contentDocument;
      if (!doc) return;
      const color = (node) => node && getComputedStyle(node).backgroundColor;
      const solid = (value) => value && value !== "transparent" && !/rgba\(.*,\s*0\)$/.test(value);
      const body = color(doc.body), html = color(doc.documentElement);
      const page = solid(body) ? body : solid(html) ? html : theme === "dark" ? "#111214" : "#ffffff";
      const top = color(topSelector && doc.querySelector(topSelector)), bottom = color(bottomSelector && doc.querySelector(bottomSelector));
      root.style.setProperty("--app-top", solid(top) ? top : page);
      root.style.setProperty("--app-bottom", solid(bottom) ? bottom : page);
      const [r, g, b] = (page.match(/\d+(\.\d+)?/g) || [255, 255, 255]).map(Number);
      root.style.setProperty("--status-ink", (r * 299 + g * 587 + b * 114) / 1000 > 140 ? "#111214" : "#ffffff");
    },
    toPage(x, y) { return { x: view.x + (inner.x + x) * view.s, y: view.y + (inner.y + y) * view.s }; },
    cursor: () => ({ ...cursor }),
    moveTo, press,
    showPointer(on = true) { cursorVisible = on; pointer.style.opacity = on ? "1" : "0"; },
    focus(x, y, zoom = 1.6, ms = 1000) { return animate(target(x, y, zoom), ms); },
    // Closer on a region of the app, never so close that it does not fit
    // above the caption: a tall side panel stays whole.
    focusBox(box, zoom = 1.25, ms = 900, dy = 0.5) {
      const room = { width: W - 120, height: H - (device === "phone" ? 300 : 190) };
      const fit = Math.min(room.width / (box.width * base), room.height / (box.height * base));
      const level = Math.max(1, Math.min(zoom, fit));
      return animate(target(box.x + box.width / 2, box.y + box.height * dy, level), ms);
    },
    reset(ms = 1000) { return animate(centered(base), ms); },
    // Moves the camera just enough for a region of the app to be seen whole,
    // above the caption (a button at the foot of a side panel, for example).
    reveal(box, ms = 600) {
      const top = view.y + (inner.y + box.y) * view.s, foot = view.y + (inner.y + box.y + box.height) * view.s;
      const left = view.x + (inner.x + box.x) * view.s, end = view.x + (inner.x + box.x + box.width) * view.s;
      const limit = H - (device === "phone" ? 280 : 150);
      let dy = foot > limit ? limit - foot : 0, dx = 0;
      if (top + dy < 24) dy = 24 - top;
      if (end > W - 24) dx = W - 24 - end;
      if (left + dx < 24) dx = 24 - left;
      if (Math.abs(dy) < 2 && Math.abs(dx) < 2) return Promise.resolve();
      return animate({ ...view, x: view.x + dx, y: view.y + dy }, ms);
    },
    keys(list, ms = 1100) {
      clearTimeout(keysTimer);
      keys.innerHTML = list.map((key) => `<kbd>${esc(key)}</kbd>`).join("");
      keys.classList.add("on");
      caption.classList.remove("on");
      keysTimer = setTimeout(() => keys.classList.remove("on"), ms);
    },
    // Captions are trusted markup written by the video spec (<b>, .step).
    caption(html) {
      if (!html) return caption.classList.remove("on");
      caption.innerHTML = html;
      caption.classList.add("on");
    },
    card(title, subtitle = "") {
      if (!title) return card.classList.remove("on");
      document.getElementById("card-title").textContent = title;
      document.getElementById("card-subtitle").textContent = subtitle;
      card.classList.add("on");
    },
  };
})();
