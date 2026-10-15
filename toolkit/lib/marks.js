// Marks of the help pictures and videos, drawn over the app: a red box around
// what to look at, a numbered badge that matches the step in the text and,
// when useful, a short label with an arrow. The same drawing serves the
// pictures (a top-layer popover above the page and its open dialogs) and the
// videos (the stage overlay, in app coordinates, zooming with the camera).
// The drawing lives in a shadow root, so no stylesheet of the app reaches it.
//
// Items: { x, y, width, height, n?, label?, side?: "top"|"right"|"bottom"|"left",
// pad?: number | { x, y }, badge?: "corner"|"left"|"right"|"top"|"bottom", text? }.
// Options: { width, height, color, dim, obstacles }.
//
// Layout, when an item does not say otherwise: a box grows 7 px around its
// element, less when another marked element is close (stacked form rows,
// tabs side by side), so boxes never overlap. The badge takes the first place
// that covers no text, no field, no icon, no button without text and no
// other mark (`obstacles`: the visible text, fields, icons and icon buttons):
// the top-left corner of a single element, the left of stacked rows, above
// items side by side. It avoids covering its own element beyond the corner
// of its box when the screen edge pushes it in (a target in a corner of the
// screen). A label goes to the side asked for or, without one, to the side with room
// that covers the least.
// `dim` darkens everything but the boxes (an opacity such as .28; 0 for none).
(() => {
  if (window.helpMarks) return;
  const NS = "http://www.w3.org/2000/svg";
  const style = (color) => `
    .help-marks { all: initial; display: block; position: absolute; inset: 0; pointer-events: none; font-family: -apple-system, BlinkMacSystemFont, Inter, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
    svg { position: absolute; left: 0; top: 0; overflow: visible; }
    .help-mark { animation: help-in .45s cubic-bezier(.2, .8, .3, 1) both; transform-box: fill-box; transform-origin: center; }
    .help-dim { animation: help-fade .35s ease both; }
    .help-badge, .help-label { position: absolute; box-sizing: border-box; font-style: normal; text-transform: none; text-align: left; white-space: normal; animation: help-pop .45s cubic-bezier(.2, .8, .3, 1) both; }
    .help-badge { width: 32px; height: 32px; margin: -16px 0 0 -16px; border-radius: 50%; display: grid; place-items: center; background: ${color}; color: #fff; font-size: 17px; font-weight: 700; line-height: 1; letter-spacing: 0; box-shadow: 0 0 0 3px #fff, 0 4px 12px rgba(0, 0, 0, .28); font-variant-numeric: tabular-nums; }
    .help-label { max-width: 300px; padding: 9px 14px; border-radius: 10px; background: ${color}; color: #fff; font-size: 16px; font-weight: 600; line-height: 1.3; letter-spacing: -.01em; box-shadow: 0 0 0 2px #fff, 0 8px 22px rgba(0, 0, 0, .28); text-wrap: balance; }
    @keyframes help-in { from { opacity: 0; transform: scale(1.08); } to { opacity: 1; transform: none; } }
    @keyframes help-pop { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: none; } }
    @keyframes help-fade { from { opacity: 0; } to { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`;
  const svg = (name, attrs) => {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const PAD = 7, GAP = 64, RADIUS = 19, NEAR = 24;
  let current = [], masks = 0;

  // ------------------------------------------------------------------ layout
  const right = (r) => r.x + r.width, bottom = (r) => r.y + r.height;
  const overlapX = (a, b) => Math.min(right(a), right(b)) - Math.max(a.x, b.x);
  const overlapY = (a, b) => Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y);
  const gapY = (a, b) => (b.y >= bottom(a) ? b.y - bottom(a) : a.y >= bottom(b) ? a.y - bottom(b) : -1);
  const gapX = (a, b) => (b.x >= right(a) ? b.x - right(a) : a.x >= right(b) ? a.x - right(b) : -1);
  const within = (outer, inner) => inner.x >= outer.x - 1 && inner.y >= outer.y - 1 && right(inner) <= right(outer) + 1 && bottom(inner) <= bottom(outer) + 1;
  const area = (a, b) => Math.max(0, overlapX(a, b)) * Math.max(0, overlapY(a, b));
  // How far a circle reaches into a rectangle (0 when it does not touch it).
  const reach = (cx, cy, r, rect) => Math.max(0, r - Math.hypot(cx - clamp(cx, rect.x, right(rect)), cy - clamp(cy, rect.y, bottom(rect))));

  // Padding of each box: half the gap to a close neighbor, so boxes of
  // stacked rows or of items side by side never overlap.
  function pads(items) {
    return items.map((item, i) => {
      if (item.pad != null) return typeof item.pad === "object" ? { x: item.pad.x ?? PAD, y: item.pad.y ?? PAD } : { x: item.pad, y: item.pad };
      let x = PAD, y = PAD;
      items.forEach((other, j) => {
        if (i === j || within(other, item) || within(item, other)) return;
        if (overlapX(item, other) > 0 && gapY(item, other) >= 0) y = Math.min(y, Math.floor(gapY(item, other) / 2) - 1);
        if (overlapY(item, other) > 0 && gapX(item, other) >= 0) x = Math.min(x, Math.floor(gapX(item, other) / 2) - 1);
      });
      return { x: Math.max(-4, x), y: Math.max(-4, y) };
    });
  }

  // Where each badge goes: the first place (on screen) that covers no text,
  // no field, no control, no icon, no other box and no other badge, in the
  // order that suits the item's neighbors; the least covered place when none
  // is free. Covering its own element beyond the corner of the box costs too.
  function badges(boxes, items, padding, { width, height, obstacles }) {
    const placed = [];
    return boxes.map((b, i) => {
      if (b.n == null) return null;
      const own = items[i];
      const allowed = Math.max(0, RADIUS - Math.hypot(Math.max(0, padding[i].x), Math.max(0, padding[i].y))) + 1;
      // A control around the target, or inside a marked box, is the target or
      // another mark: those count below, not as obstacles.
      const blocking = obstacles.filter((rect) => !rect.control || !(within(rect, own) || boxes.some((box) => within(box, rect))));
      const near = (test) => items.some((other, j) => j !== i && test(items[i], other));
      const stacked = near((a, o) => overlapX(a, o) > a.width * 0.3 && gapY(a, o) >= 0 && gapY(a, o) < NEAR);
      const inRow = near((a, o) => overlapY(a, o) > a.height * 0.3 && gapX(a, o) >= 0 && gapX(a, o) < NEAR);
      const order = b.badge ? [b.badge] : stacked ? ["left", "corner", "right", "top", "bottom"] : inRow ? ["top", "corner", "bottom", "left", "right"] : ["corner", "left", "top", "right", "bottom"];
      const spot = (at) => ({
        x: clamp(at === "left" ? b.x - 21 : at === "right" ? right(b) + 21 : at === "top" || at === "bottom" ? b.x + b.width / 2 : b.x, 18, width - 18),
        y: clamp(at === "top" ? b.y - 21 : at === "bottom" ? bottom(b) + 21 : at === "corner" ? b.y : b.y + b.height / 2, 18, height - 18),
      });
      // Badges of a tight stack may touch rings, never cover each other's number.
      const cost = ({ x, y }) => (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 30) ? 1e5 : 0)
        + Math.max(0, reach(x, y, RADIUS, own) - allowed)
        + blocking.reduce((sum, rect) => sum + Math.max(0, reach(x, y, RADIUS, rect) - 3), 0)
        + boxes.reduce((sum, other, j) => sum + (j === i ? 0 : reach(x, y, RADIUS, other)), 0);
      const options = order.map(spot);
      const best = options.find((option) => cost(option) === 0) || options.reduce((a, c) => (cost(c) < cost(a) ? c : a));
      placed.push(best);
      return best;
    });
  }

  function draw(container, items, { width, height, dim = 0, color = "#e5322d", obstacles = [] } = {}) {
    clear(container);
    const host = document.createElement("div");
    host.className = "help-marks-root";
    host.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;";
    container.append(host);
    const root = host.attachShadow({ mode: "open" });
    const sheet = document.createElement("style");
    sheet.textContent = style(color);
    const layer = document.createElement("div");
    layer.className = "help-marks";
    layer.style.width = `${width}px`;
    layer.style.height = `${height}px`;
    root.append(sheet, layer);
    const canvas = svg("svg", { width, height, viewBox: `0 0 ${width} ${height}` });
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    layer.append(canvas);
    const padding = pads(items);
    // Boxes stay on screen, so an element at an edge (a bottom bar) keeps all
    // four sides of its box.
    const boxes = items.map((item, i) => {
      const x = Math.max(4, item.x - padding[i].x), y = Math.max(4, item.y - padding[i].y);
      const end = Math.min(width - 4, item.x + item.width + padding[i].x), foot = Math.min(height - 4, item.y + item.height + padding[i].y);
      return { ...item, x, y, width: Math.max(8, end - x), height: Math.max(8, foot - y) };
    });
    const spots = badges(boxes, items, padding, { width, height, obstacles });
    current = items.map((item) => ({ n: item.n ?? null, label: item.label ?? null, text: item.text ?? null }));

    // Everything but the marked areas darker, so the eye goes there. A mask
    // keeps overlapping boxes clear.
    const shade = dim === true ? .28 : Number(dim) || 0;
    if (shade > 0) {
      const id = `help-dim-${++masks}`, defs = svg("defs", {}), mask = svg("mask", { id, maskUnits: "userSpaceOnUse", x: 0, y: 0, width, height });
      mask.append(svg("rect", { x: 0, y: 0, width, height, fill: "#fff" }));
      for (const b of boxes) mask.append(svg("rect", { x: b.x, y: b.y, width: b.width, height: b.height, rx: 12, fill: "#000" }));
      defs.append(mask);
      canvas.append(defs, svg("rect", { class: "help-dim", x: 0, y: 0, width, height, fill: `rgba(12, 14, 18, ${shade})`, mask: `url(#${id})` }));
      host.dataset.dim = "1";
    }
    const taken = [...boxes, ...spots.filter(Boolean).map((p) => ({ x: p.x - RADIUS, y: p.y - RADIUS, width: RADIUS * 2, height: RADIUS * 2 }))];
    boxes.forEach((b, index) => {
      const delay = `${index * 0.12}s`;
      const group = svg("g", { class: "help-mark", style: `animation-delay:${delay}` });
      group.append(svg("rect", { x: b.x, y: b.y, width: b.width, height: b.height, rx: 12, fill: "none", stroke: "#fff", "stroke-width": 8, opacity: .9 }));
      group.append(svg("rect", { class: "help-box", x: b.x, y: b.y, width: b.width, height: b.height, rx: 12, fill: "none", stroke: color, "stroke-width": 4 }));
      canvas.append(group);
      if (b.label) taken.push(label(layer, canvas, b, { width, height, delay, color, obstacles, taken }));
      if (spots[index]) {
        const badge = document.createElement("div");
        badge.className = "help-badge";
        badge.textContent = b.n;
        badge.style.left = `${spots[index].x}px`;
        badge.style.top = `${spots[index].y}px`;
        badge.style.animationDelay = delay;
        layer.append(badge);
      }
    });
    return host;
  }

  // The label goes on the side asked for (when it fits) or on the side with
  // room that covers the least text and marks, with an arrow from the label
  // to the middle of that side of the box.
  function label(layer, canvas, b, { width, height, delay, color, obstacles, taken }) {
    const note = document.createElement("div");
    note.className = "help-label";
    note.textContent = b.label;
    note.style.animationDelay = delay;
    note.style.visibility = "hidden";
    layer.append(note);
    const w = note.offsetWidth, h = note.offsetHeight;
    const room = { top: b.y, bottom: height - (b.y + b.height), left: b.x, right: width - (b.x + b.width) };
    const fits = { top: room.top > h + GAP + 8, bottom: room.bottom > h + GAP + 8, left: room.left > w + GAP + 8, right: room.right > w + GAP + 8 };
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    const place = (side) => (side === "bottom" || side === "top"
      ? { x: clamp(cx - w / 2, 10, width - w - 10), y: side === "bottom" ? b.y + b.height + GAP : b.y - GAP - h, width: w, height: h }
      : { x: side === "right" ? b.x + b.width + GAP : b.x - GAP - w, y: clamp(cy - h / 2, 10, height - h - 10), width: w, height: h });
    const covered = (rect) => obstacles.reduce((sum, other) => sum + area(rect, other), 0) + taken.reduce((sum, other) => sum + area(rect, other) * 4, 0);
    const sides = ["bottom", "right", "left", "top"].filter((key) => fits[key]);
    const side = b.side && fits[b.side] ? b.side
      : sides.length ? sides.reduce((best, key) => (covered(place(key)) < covered(place(best)) ? key : best)) : "bottom";
    const spot = place(side);
    let from, to;
    if (side === "bottom" || side === "top") {
      from = { x: clamp(cx, spot.x + 18, spot.x + w - 18), y: side === "bottom" ? spot.y : spot.y + h };
      to = { x: cx, y: side === "bottom" ? b.y + b.height + 6 : b.y - 6 };
    } else {
      from = { x: side === "right" ? spot.x : spot.x + w, y: clamp(cy, spot.y + 14, spot.y + h - 14) };
      to = { x: side === "right" ? b.x + b.width + 6 : b.x - 6, y: cy };
    }
    note.style.left = `${spot.x}px`;
    note.style.top = `${spot.y}px`;
    note.style.visibility = "";
    // A slight curve and a filled head, outlined in white like the box.
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1;
    const bend = Math.min(18, length * .18), control = { x: (from.x + to.x) / 2 - dy / length * bend, y: (from.y + to.y) / 2 + dx / length * bend };
    const angle = Math.atan2(to.y - control.y, to.x - control.x), head = 15;
    const tip = (turn) => `${to.x - head * Math.cos(angle + turn)},${to.y - head * Math.sin(angle + turn)}`;
    const group = svg("g", { class: "help-mark", style: `animation-delay:${delay}` });
    const curve = `M${from.x},${from.y} Q${control.x},${control.y} ${to.x - Math.cos(angle) * 8},${to.y - Math.sin(angle) * 8}`;
    group.append(svg("path", { d: curve, fill: "none", stroke: "#fff", "stroke-width": 8, "stroke-linecap": "round" }));
    group.append(svg("polygon", { points: `${to.x},${to.y} ${tip(.45)} ${tip(-.45)}`, fill: "#fff", stroke: "#fff", "stroke-width": 5, "stroke-linejoin": "round" }));
    group.append(svg("path", { d: curve, fill: "none", stroke: color, "stroke-width": 4, "stroke-linecap": "round" }));
    group.append(svg("polygon", { points: `${to.x},${to.y} ${tip(.45)} ${tip(-.45)}`, fill: color, stroke: color, "stroke-width": 1.5, "stroke-linejoin": "round" }));
    canvas.append(group);
    return spot;
  }

  // `fade` lets a darkened screen come back smoothly (videos).
  function clear(container, { fade = false } = {}) {
    container?.querySelectorAll(":scope > .help-marks-root").forEach((node) => {
      if (!fade || !node.dataset.dim || matchMedia("(prefers-reduced-motion: reduce)").matches) return node.remove();
      node.classList.remove("help-marks-root");
      node.style.transition = "opacity .22s ease";
      requestAnimationFrame(() => { node.style.opacity = "0"; });
      setTimeout(() => node.remove(), 260);
    });
    current = [];
  }

  // The visible text, fields, controls and icons of a document (the page, or
  // the app inside the video stage): what a badge or a label should not
  // cover. What is hidden behind a dialog or a panel does not count.
  const CONTROLS = "a[href], button, summary, select, input[type=checkbox], input[type=radio], [role=button], [role=link], [role=menuitem], [role=menuitemradio], [role=menuitemcheckbox], [role=tab], [role=option], [role=checkbox], [role=radio], [role=switch]";
  const ICONS = "svg, img, i, [class*=icon]";
  function textRects(doc = document) {
    const view = doc.defaultView, out = [];
    const onScreen = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < view.innerHeight && r.left < view.innerWidth;
    const seen = (element, r) => {
      const top = doc.elementFromPoint(clamp(r.left + r.width / 2, 0, view.innerWidth - 1), clamp(r.top + r.height / 2, 0, view.innerHeight - 1));
      return !!top && (top === element || element.contains(top) || top.contains(element));
    };
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, { acceptNode: (node) => (node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const range = doc.createRange();
    for (let node = walker.nextNode(); node && out.length < 4000; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || parent.closest("#help-marks-host, script, style, noscript, option, template")) continue;
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) if (onScreen(r) && seen(parent, r)) out.push({ x: r.left, y: r.top, width: r.width, height: r.height });
    }
    // What is typed in a field is text too: its inner area.
    for (const field of doc.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, select")) {
      const r = field.getBoundingClientRect();
      if (onScreen(r) && r.width > 24 && r.height > 16 && seen(field, r)) out.push({ x: r.left + 8, y: r.top + 6, width: r.width - 16, height: r.height - 12 });
    }
    // Buttons, links, checkboxes and tabs without text, whole: a badge on
    // the X beside a button reads as part of it (the text of the others is
    // already here). Big clickable areas (a card, a row) stay out.
    for (const control of doc.querySelectorAll(CONTROLS)) {
      if (control.closest("#help-marks-host") || control.innerText?.trim()) continue;
      const r = control.getBoundingClientRect();
      if (onScreen(r) && r.width <= 480 && r.height <= 120 && seen(control, r)) out.push({ x: r.left, y: r.top, width: r.width, height: r.height, control: true });
    }
    // Icons have no text: an icon-font glyph, an SVG, a small picture.
    for (const icon of doc.querySelectorAll(ICONS)) {
      if (icon.closest("#help-marks-host") || icon.parentElement?.closest("svg")) continue;
      const r = icon.getBoundingClientRect();
      if (onScreen(r) && r.width <= 48 && r.height <= 48 && seen(icon, r)) out.push({ x: r.left, y: r.top, width: r.width, height: r.height });
    }
    return out;
  }

  // Over the app page: a popover in the top layer, so marks stay above
  // dialogs opened with showModal().
  const HOST = "position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;overflow:visible!important;pointer-events:none!important;opacity:1!important;transform:none!important;filter:none!important;color:inherit;z-index:2147483647";
  function page(items, options = {}) {
    let host = document.getElementById("help-marks-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "help-marks-host";
      host.setAttribute("popover", "manual");
      host.style.cssText = HOST;
      document.body.append(host);
    }
    if (host.matches(":popover-open")) host.hidePopover();
    const obstacles = textRects(document);
    host.showPopover();
    return draw(host, items, { width: innerWidth, height: innerHeight, obstacles, ...options });
  }
  function clearPage() {
    const host = document.getElementById("help-marks-host");
    if (host) { clear(host); if (host.matches(":popover-open")) host.hidePopover(); }
  }
  // Where the marks are on the screen (for cropping a picture around them).
  function rects() {
    const root = document.querySelector("#help-marks-host > .help-marks-root")?.shadowRoot;
    if (!root) return [];
    return [...root.querySelectorAll(".help-label, .help-badge, .help-box")].map((node) => node.getBoundingClientRect()).map((r) => ({ x: r.left, y: r.top, width: r.width, height: r.height }));
  }

  window.helpMarks = { draw, clear, page, clearPage, rects, textRects, current: () => current };
})();
