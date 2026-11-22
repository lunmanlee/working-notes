(function () {
  const K = window.NotesKit;
  const stackEl = document.getElementById("stack");
  const scrollEl = document.getElementById("stackScroll");
  const dirList = document.getElementById("dirList");
  const preview = document.getElementById("preview");

  let openStack = [];           // array of note ids, left→right
  let renderedIds = [];         // what's currently in the DOM (for incremental render)

  // ---- theme ----
  const themeBtn = document.getElementById("themeBtn");
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("wn-theme", t);
    // the button shows the action, not the current state (☾ = go dark, ☀ = go light)
    themeBtn.textContent = t === "dark" ? "☀" : "☾";
  }
  applyTheme(localStorage.getItem("wn-theme") || "light");
  themeBtn.onclick = () =>
    applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");

  // note maturity marks — a minimal line set that grows with the thinking:
  // seedling (leaves unfurl) → budding (bud swells, accent bloom) → evergreen
  // (fir sprig that sways, seal-red berries). currentColor, 1.5px non-scaling
  // stroke; the settle gesture plays on hover (see styles.css).
  const MARK = {
    seedling: { cls: "m-seed", body:
      `<path class="stem" d="M24 38 C24 33 24 29 24 25"></path>`
      + `<path class="leaf l" d="M24 25 C19 26 13.5 23.5 14.5 17.5 C19.5 17.5 23 20 24 25 Z"></path>`
      + `<path class="leaf r" d="M24 25 C29 26 34.5 23.5 33.5 17.5 C28.5 17.5 25 20 24 25 Z"></path>` },
    budding: { cls: "m-bud", body:
      `<path class="stem" d="M24 40 V18"></path>`
      + `<path class="leaf l" d="M24 30 C20 31 15.5 29 16.5 24 C20.5 24 23 26.5 24 30 Z"></path>`
      + `<path class="leaf r" d="M24 30 C28 31 32.5 29 31.5 24 C27.5 24 25 26.5 24 30 Z"></path>`
      + `<path class="bloom" d="M24 18 C21.8 16 22.2 12.2 24 10 C25.8 12.2 26.2 16 24 18 Z"></path>`
      + `<path class="bud" d="M24 18 C21.8 16 22.2 12.2 24 10 C25.8 12.2 26.2 16 24 18 Z"></path>` },
    evergreen: { cls: "m-ever", body:
      `<g class="sprig"><path d="M24 41 V12"></path>`
      + `<path d="M24 13 L20 17"></path><path d="M24 13 L28 17"></path>`
      + `<path d="M24 19 L18.5 24"></path><path d="M24 19 L29.5 24"></path>`
      + `<path d="M24 25 L16.5 31"></path><path d="M24 25 L31.5 31"></path>`
      + `<path d="M24 31 L15 38"></path><path d="M24 31 L33 38"></path>`
      + `<circle class="berry l" cx="19" cy="22" r="1.9"></circle>`
      + `<circle class="berry r" cx="29" cy="26" r="1.9"></circle></g>` }
  };
  function statusIcon(status) {
    const m = MARK[status]; if (!m) return "";
    // viewBox cropped tight around the artwork (paths are still drawn in the
    // original 48-unit space) so the mark fills its box instead of floating in
    // empty padding. transform-origins in styles.css are re-based by (7,9) to match.
    return `<span class="status-ico ${m.cls}" aria-hidden="true">`
      + `<svg viewBox="7 9 34 34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${m.body}</svg></span>`;
  }

  // a plain left-click (no modifier) drives in-page navigation; modified / middle
  // clicks fall through to the anchor's href so "open in new tab" still works.
  function plainClick(e) {
    return !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1);
  }

  // ---- directory ----
  function renderDir() {
    const items = K.recentlyTended();
    dirList.innerHTML = items.map(n => `
      <li class="dir-item" data-active="${openStack.includes(n.id)}">
        <a class="dir-link" href="?stack=${n.id}" data-id="${n.id}">
          <span class="dir-title">${n.title}</span>
          <span class="dir-meta">
            ${statusIcon(n.status)}
            <span>${n.status}</span><span>·</span><span>tended ${K.fmt(n.tended)}</span>
          </span>
        </a>
      </li>`).join("");
    dirList.querySelectorAll(".dir-link").forEach(a => {
      a.addEventListener("click", e => {
        if (!plainClick(e)) return;
        e.preventDefault();
        openNote(a.dataset.id, 0, true);
      });
      attachPreview(a, a.dataset.id);
    });
  }

  // ---- stack rendering (incremental: only new columns are created/animated) ----
  function colInnerHTML(id, i) {
    const n = K.get(id);
    return `
      <button class="col-close" title="Close" aria-label="Close note" data-close="${i}">✕</button>
      <div class="note">
        <header class="note-head">
          <div class="note-status">${statusIcon(n.status)}<span>${n.status}</span></div>
          <h2>${n.title}</h2>
          <div class="note-dates">planted ${K.fmtLong(n.planted)} · last tended ${K.fmtLong(n.tended)}</div>
        </header>
        <div class="note-body" data-depth="${i}">${n.body}</div>
        ${renderBacklinks(n, i)}
        <div class="note-divider">≈ &gt;&lt;&gt; ≈</div>
      </div>`;
  }

  function wireColumn(el, i) {
    el.querySelectorAll(".note-body a[data-note]").forEach(a => {
      const depth = +a.closest(".note-body").dataset.depth;
      a.addEventListener("click", e => {
        if (!plainClick(e)) return;
        e.preventDefault();
        openNote(a.dataset.note, depth + 1);
      });
      attachPreview(a, a.dataset.note);
    });
    el.querySelectorAll("[data-bl]").forEach(a => {
      const depth = +a.dataset.depth;
      a.addEventListener("click", e => {
        if (!plainClick(e)) return;
        e.preventDefault();
        openNote(a.dataset.bl, depth + 1);
      });
      attachPreview(a, a.dataset.bl);
    });
    el.querySelector("[data-close]").onclick = () => {
      openStack = openStack.slice(0, i);
      commit(false, true);
    };
  }

  function renderStack() {
    if (openStack.length === 0) {
      stackEl.innerHTML = `<div class="empty">nothing open yet — pick a note to begin.</div>`;
      renderedIds = [];
      return false;
    }

    // longest common prefix between what's rendered and what we want
    let common = 0;
    while (common < renderedIds.length && common < openStack.length &&
           renderedIds[common] === openStack[common]) common++;

    if (renderedIds.length === 0) stackEl.innerHTML = ""; // clear empty-state node

    // drop columns from `common` onward (changed or truncated)
    let cols = Array.from(stackEl.querySelectorAll(":scope > .col"));
    for (let k = cols.length - 1; k >= common; k--) cols[k].remove();

    // append only the genuinely-new columns (data-enter decided after layout)
    const newEls = [];
    for (let i = common; i < openStack.length; i++) {
      const el = document.createElement("article");
      el.className = "col";
      el.dataset.enter = "false";
      el.innerHTML = colInnerHTML(openStack[i], i);
      stackEl.appendChild(el);
      wireColumn(el, i);
      newEls.push(el);
    }

    // refresh dim/index on every column (cheap, no re-render)
    Array.from(stackEl.querySelectorAll(":scope > .col")).forEach((el, i) => {
      el.dataset.col = i;
      el.dataset.dim = i < openStack.length - 1 ? "true" : "false";
    });

    // Only play the per-column slide-in when the stack does NOT need to scroll.
    // Once it overflows (first happens at the 3rd note) the smooth auto-scroll
    // reveals the new column on its own — running the translateX animation at the
    // same time as the scroll makes the column wobble. Let scroll do the reveal.
    const willScroll = scrollEl.scrollWidth > scrollEl.clientWidth + 1;
    newEls.forEach((el) => { el.dataset.enter = willScroll ? "false" : "true"; });

    renderedIds = openStack.slice();
    return willScroll;
  }

  function renderBacklinks(n, depth) {
    if (!n.backlinks.length) return "";
    return `<div class="backlinks">
      <div class="lbl">Linked from</div>
      <ul>${n.backlinks.map(id => {
        const b = K.get(id);
        return `<li class="bl-host">
          ${statusIcon(b.status)}
          <div class="bl-text">
            <a class="bl-title" href="?stack=${id}" data-bl="${id}" data-depth="${depth}">${b.title}</a>
            <div class="bl-lede">${b.lede}</div>
          </div>
        </li>`;
      }).join("")}</ul>
    </div>`;
  }

  // open a note at a given position; truncate the stack after `pos`
  function openNote(id, pos, fromDir) {
    if (fromDir) {
      const existing = openStack.indexOf(id);
      if (existing >= 0) { openStack = openStack.slice(0, existing + 1); }
      else { openStack = [id]; }
    } else {
      openStack = openStack.slice(0, pos);
      if (openStack[openStack.length - 1] !== id) openStack.push(id);
    }
    commit(true, true);
  }

  function stackUrl() {
    return openStack.length ? `?stack=${openStack.join(",")}` : location.pathname;
  }

  function commit(scrollRight, pushHistory) {
    localStorage.setItem("wn-stack", JSON.stringify(openStack));
    if (pushHistory) history.pushState({ stack: openStack.slice() }, "", stackUrl());
    const willScroll = renderStack(); renderDir();
    // Only reveal-scroll when the stack actually overflows — otherwise the newest
    // column is already fully visible and scrolling is a no-op that just risks jitter.
    if (scrollRight && willScroll) revealEnd();
  }

  // Smoothly bring the newest (rightmost) column into view. The first overflow
  // (3rd note) is also when the horizontal scrollbar first appears, which steals
  // height and re-flows the columns. Waiting two frames lets that layout settle, and
  // scrolling to a clamped max (not the raw scrollWidth) keeps the browser from
  // re-clamping the in-flight smooth scroll — both of which made the columns wobble.
  function revealEnd() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const max = scrollEl.scrollWidth - scrollEl.clientWidth;
      scrollEl.scrollTo({ left: max, behavior: "smooth" });
    }));
  }

  // back/forward navigates the stack
  window.addEventListener("popstate", () => {
    openStack = parseStackFromUrl();
    renderStack(); renderDir();
    requestAnimationFrame(() =>
      scrollEl.scrollTo({ left: scrollEl.scrollWidth - scrollEl.clientWidth }));
  });

  // ---- hover previews ----
  let pvTimer;
  function attachPreview(el, id) {
    el.addEventListener("mouseenter", () => {
      clearTimeout(pvTimer);
      pvTimer = setTimeout(() => showPreview(el, id), 240);
    });
    el.addEventListener("mouseleave", () => { clearTimeout(pvTimer); hidePreview(); });
    el.addEventListener("mousedown", hidePreview);
  }
  function showPreview(el, id) {
    const n = K.get(id); if (!n) return;
    preview.innerHTML = `
      <div class="pv-status">${statusIcon(n.status)}<span>${n.status}</span> · tended ${K.fmt(n.tended)}</div>
      <h4>${n.title}</h4><p>${n.lede}</p>`;
    const r = el.getBoundingClientRect();
    preview.style.visibility = "hidden";
    preview.setAttribute("data-show", "true");
    const pw = preview.offsetWidth, ph = preview.offsetHeight;
    let left = r.left, top = r.bottom + 8;
    if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12;
    if (top + ph > window.innerHeight - 12) top = r.top - ph - 8;
    preview.style.left = Math.max(12, left) + "px";
    preview.style.top = Math.max(12, top) + "px";
    preview.style.visibility = "visible";
  }
  function hidePreview() { preview.setAttribute("data-show", "false"); }

  // ---- init ----
  function parseStackFromUrl() {
    const m = new URLSearchParams(location.search).get("stack");
    if (!m) return null;
    return m.split(",").map(s => s.trim()).filter(id => K.get(id));
  }

  const fromUrl = parseStackFromUrl();
  const saved = JSON.parse(localStorage.getItem("wn-stack") || "[]").filter(id => K.get(id));
  const fallback = K.recentlyTended()[0];
  if (fromUrl && fromUrl.length) openStack = fromUrl;
  else if (saved.length) openStack = saved;
  else openStack = fallback ? [fallback.id] : [];
  history.replaceState({ stack: openStack.slice() }, "", stackUrl());
  renderStack(); renderDir();
})();
