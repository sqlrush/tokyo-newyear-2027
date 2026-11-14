/* 东京新年五日攻略：渲染与交互。数据来自 data.js（window.GUIDE），这里只读不改。 */
(function () {
  "use strict";

  const G = window.GUIDE;
  const $ = (sel, root = document) => root.querySelector(sel);
  const REQUIRED = ["days", "areas", "plan", "restaurants", "jan1", "credits", "sources"];
  const missing = G ? REQUIRED.filter((k) => !Array.isArray(G[k])) : REQUIRED;
  if (missing.length) {
    document.body.insertAdjacentHTML("afterbegin",
      `<p style="padding:16px;background:#b8331d;color:#fff;margin:0">攻略数据没有加载完整（缺少：${missing.join("、")}）。请确认 data.js 和 index.html 在同一个文件夹里。</p>`);
    return;
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DIMS = ["轻奢", "现代", "古典", "生活"];
  const DIM_LABEL = { 轻奢: "轻奢", 现代: "现代", 古典: "古典", 生活: "生活气息" };

  /* ---------- 主题切换 ---------- */
  function initTheme() {
    const btn = $("#themeBtn");
    const saved = localStorage.getItem("tokyo-theme");
    if (saved) document.documentElement.dataset.theme = saved;
    const isDark = () => {
      const t = document.documentElement.dataset.theme;
      if (t) return t === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    };
    const label = () => { btn.textContent = isDark() ? "浅色" : "深色"; };
    label();
    btn.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("tokyo-theme", next);
      label();
    });
  }

  /* ---------- 新年日历 ---------- */
  function renderDays() {
    $("#days").innerHTML = G.days.map((d) => `
      <article class="day reveal">
        <div class="d"><strong class="num">${esc(d.date)}</strong><span>${esc(d.weekday)}</span></div>
        <span class="tag">${esc(d.tag)}</span>
        <h3>${esc(d.title)}</h3>
        <p>${esc(d.summary)}</p>
        <ul>${d.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      </article>`).join("");
  }

  /* ---------- 商圈风格图（单系列散点 + 直接标注 + 悬停提示） ---------- */
  function placeLabels(points, W) {
    const boxes = [];
    const overlaps = (b) => boxes.some((o) => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
    return points.map((p) => {
      const w = p.name.length * 14 + 6;
      const h = 18;
      const cands = [
        { x: p.cx + 12, y: p.cy - 9, anchor: "start", tx: p.cx + 12, ty: p.cy + 5 },
        { x: p.cx - 12 - w, y: p.cy - 9, anchor: "end", tx: p.cx - 12, ty: p.cy + 5 },
        { x: p.cx - w / 2, y: p.cy - 30, anchor: "middle", tx: p.cx, ty: p.cy - 14 },
        { x: p.cx - w / 2, y: p.cy + 12, anchor: "middle", tx: p.cx, ty: p.cy + 26 },
      ].map((c) => ({ ...c, w, h }));
      const inside = (c) => c.x > 4 && c.x + c.w < W - 4;
      const pick = cands.find((c) => inside(c) && !overlaps(c)) || cands.find(inside) || cands[0];
      boxes.push(pick);
      return { ...p, label: pick };
    });
  }

  function renderMap(activeDim) {
    const W = 920, H = 520, pad = 54;
    const sx = (v) => pad + ((v + 4) / 8) * (W - pad * 2);
    const sy = (v) => H - pad - ((v + 4) / 8) * (H - pad * 2);
    const raw = G.areas.map((a, i) => {
      const x = a.scores["现代"] - a.scores["古典"] + (a.nudge?.[0] ?? 0);
      const y = a.scores["轻奢"] - a.scores["生活"] + (a.nudge?.[1] ?? 0);
      return { i, id: a.id, name: a.short || a.name_zh, cx: sx(x), cy: sy(y), a };
    });
    const pts = placeLabels(raw, W);
    const dim = (p) => activeDim && p.a.scores[activeDim] < 4;
    const svg = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="商圈风格坐标图：横轴从古典到现代，纵轴从生活气息到轻奢">
        <line class="axis" x1="${pad}" y1="${H / 2}" x2="${W - pad}" y2="${H / 2}"/>
        <line class="axis" x1="${W / 2}" y1="${pad - 20}" x2="${W / 2}" y2="${H - pad + 20}"/>
        <text class="axis-label" x="${pad}" y="${H / 2 - 10}">古典</text>
        <text class="axis-label" x="${W - pad}" y="${H / 2 - 10}" text-anchor="end">现代</text>
        <text class="axis-label" x="${W / 2 + 10}" y="${pad - 24}">轻奢</text>
        <text class="axis-label" x="${W / 2 + 10}" y="${H - pad + 32}">生活气息</text>
        <text class="quad-label" x="${W - pad}" y="${pad - 24}" text-anchor="end">现代 + 轻奢</text>
        <text class="quad-label" x="${pad}" y="${pad - 24}">古典 + 轻奢</text>
        <text class="quad-label" x="${pad}" y="${H - pad + 32}">古典 + 生活</text>
        <text class="quad-label" x="${W - pad}" y="${H - pad + 32}" text-anchor="end">现代 + 生活</text>
        ${pts.map((p) => `
          <g class="pt${dim(p) ? " dim" : ""}" data-i="${p.i}" tabindex="0" role="link" aria-label="${esc(p.name)}：${DIMS.map((d) => DIM_LABEL[d] + p.a.scores[d]).join("，")}">
            <circle class="hit" cx="${p.cx}" cy="${p.cy}" r="16"/>
            <circle class="dot" cx="${p.cx}" cy="${p.cy}" r="6"/>
            <text x="${p.label.tx}" y="${p.label.ty}" text-anchor="${p.label.anchor}">${esc(p.name)}</text>
          </g>`).join("")}
      </svg>
      <div class="tooltip" id="tip" role="status"></div>`;
    const card = $("#mapCard");
    card.innerHTML = svg + `<p class="map-foot">位置由四项评分换算：横向 = 现代分 - 古典分，纵向 = 轻奢分 - 生活气息分。点圆点可跳到对应街区。</p>`;
    bindMapHover(card);
  }

  function bindMapHover(card) {
    const tip = $("#tip", card);
    const show = (g, evt) => {
      const a = G.areas[Number(g.dataset.i)];
      tip.innerHTML = `<b>${esc(a.name_zh)}</b>${esc(a.tagline)}<div class="sc num" style="margin-top:6px">${DIMS.map((d) => `<span>${DIM_LABEL[d]} ${a.scores[d]}</span>`).join("")}</div>`;
      const r = card.getBoundingClientRect();
      const c = g.querySelector("circle.dot").getBoundingClientRect();
      const left = Math.min(Math.max(c.left - r.left - 100, 8), r.width - 268);
      const top = c.top - r.top + 22;
      tip.style.left = left + "px";
      tip.style.top = top + "px";
      tip.classList.add("show");
    };
    const hide = () => tip.classList.remove("show");
    card.querySelectorAll(".pt").forEach((g) => {
      g.addEventListener("mouseenter", (e) => show(g, e));
      g.addEventListener("focus", (e) => show(g, e));
      g.addEventListener("mouseleave", hide);
      g.addEventListener("blur", hide);
      const go = () => document.getElementById("area-" + G.areas[Number(g.dataset.i)].id)?.scrollIntoView({ block: "start" });
      g.addEventListener("click", go);
      g.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    });
  }

  function initMapChips() {
    const wrap = $("#mapChips");
    const opts = [{ k: "", t: "全部" }, ...DIMS.map((d) => ({ k: d, t: DIM_LABEL[d] + "突出" }))];
    wrap.innerHTML = opts.map((o, i) => `<button class="chip" data-k="${o.k}" aria-pressed="${i === 0}">${o.t}</button>`).join("");
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      wrap.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      renderMap(b.dataset.k || null);
    });
  }

  /* ---------- 商圈卡片 ---------- */
  function areaCard(a, idx) {
    const best = Math.max(...DIMS.map((d) => a.scores[d]));
    const layout = a.layout || "";
    const img = a.img
      ? `<img src="img/${esc(a.img)}" alt="${esc(a.img_alt || a.name_zh)}" loading="lazy">`
      : `<div class="area-noimg">${esc(a.name_zh)}</div>`;
    return `
      <article class="area ${layout} reveal" id="area-${esc(a.id)}">
        <div class="area-img">${img}</div>
        <div class="area-body">
          <h3>${esc(a.name_zh)} <span class="jp">${esc(a.name_ja)}</span></h3>
          <p class="tagline">${esc(a.tagline)}</p>
          <div class="scores">${DIMS.map((d) => `<div class="score${a.scores[d] === best ? " top" : ""}" title="${esc(a.score_reasons?.[d] || "")}"><span>${DIM_LABEL[d]}</span><strong class="num">${a.scores[d]}</strong></div>`).join("")}</div>
          <ul class="hl">${a.highlights.map((h) => `<li><b>${esc(h.name)}</b>：${esc(h.desc)}</li>`).join("")}</ul>
          <div class="ny">${["1/1", "1/2", "1/3", "1/4"].map((d) => `<div class="${(a.best_days || []).includes(d) ? "best" : ""}"><b>${d}</b>${esc(a.newyear[d])}</div>`).join("")}</div>
          <div class="meta">
            <p><span>怎么去</span>${esc(a.access)}</p>
            <p><span>建议</span>${esc(a.tip)}</p>
          </div>
        </div>
      </article>`;
  }

  function renderAreas() {
    $("#areas").innerHTML = G.areas.map(areaCard).join("");
  }

  /* ---------- 五日路线 ---------- */
  function renderPlan(i) {
    const d = G.plan[i];
    const rmap = new Map(G.restaurants.map((r) => [r.id, r]));
    $("#planBody").innerHTML = `
      <div class="plan-side">
        <p class="big num">${esc(d.date)}</p>
        <h3>${esc(d.title)}</h3>
        <p>${esc(d.summary)}</p>
        ${d.note ? `<p>${esc(d.note)}</p>` : ""}
      </div>
      <ol class="timeline">
        ${d.steps.map((s) => `
          <li>
            <div class="when">${esc(s.when)}</div>
            <h4>${esc(s.title)}</h4>
            <p>${esc(s.text)}</p>
            ${s.eat && s.eat.length ? `<div class="eat">${s.eat.map((id) => rmap.get(id)).filter(Boolean).map((r) => `<a href="#r-${esc(r.id)}" data-r="${esc(r.id)}">${esc(r.name_zh)}</a>`).join("")}</div>` : ""}
          </li>`).join("")}
      </ol>`;
  }

  function initPlan() {
    const tabs = $("#planTabs");
    if (!G.plan.length) {
      $("#planBody").innerHTML = `<div class="empty"><strong>路线还在整理中</strong>先看上面的街区和下面的餐厅。</div>`;
      return;
    }
    tabs.innerHTML = G.plan.map((d, i) => `<button class="chip" data-i="${i}" aria-pressed="${i === 0}">${esc(d.date)} ${esc(d.short)}</button>`).join("");
    tabs.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      tabs.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      renderPlan(Number(b.dataset.i));
    });
    renderPlan(0);
    $("#planBody").addEventListener("click", (e) => {
      const a = e.target.closest("a[data-r]");
      if (!a) return;
      e.preventDefault();
      focusRestaurant(a.dataset.r);
    });
  }

  /* ---------- 餐厅 ---------- */
  const NY = {
    "1/1": { cls: "open1", text: "1/1 也开" },
    "1/2": { cls: "open2", text: "1/2 起开" },
    "1/3": { cls: "open2", text: "1/3 起开" },
    "1/4": { cls: "", text: "1/4 起开" },
    "1/5": { cls: "", text: "1/5 起开" },
    "?": { cls: "", text: "新年待确认" },
  };
  const NY_FILTERS = [
    { k: "", t: "全部" },
    { k: "d1", t: "1/1 能吃" },
    { k: "d23", t: "1/2-1/3 能吃" },
    { k: "d4", t: "1/4 能吃" },
  ];
  const nyMatch = (r, k) => {
    if (!k) return true;
    const s = r.ny;
    if (k === "d1") return s === "1/1";
    if (k === "d23") return s === "1/1" || s === "1/2" || s === "1/3";
    if (k === "d4") return s !== "1/5" && s !== "?";
    return true;
  };
  const EMPTY_FILTER = Object.freeze({ group: "", tier: "", ny: "", near: "" });
  let state = EMPTY_FILTER;

  function chipRow(el, opts, key) {
    el.innerHTML = opts.map((o) => `<button class="chip" data-k="${esc(o.k)}" aria-pressed="${state[key] === o.k}">${esc(o.t)}${o.n != null ? `<small class="num">${o.n}</small>` : ""}</button>`).join("");
  }

  function renderFilters() {
    const R = G.restaurants;
    const groups = [...new Set(R.map((r) => r.group))];
    chipRow($("#fGroup"), [{ k: "", t: "全部" }, ...groups.map((g) => ({ k: g, t: g, n: R.filter((r) => r.group === g).length }))], "group");
    chipRow($("#fTier"), [{ k: "", t: "全部" }, { k: "平价", t: "平价 ¥3,000 以下" }, { k: "中档", t: "中档 ¥3,000-10,000" }, { k: "轻奢", t: "轻奢 ¥10,000 以上" }], "tier");
    chipRow($("#fNy"), NY_FILTERS, "ny");
    const nears = [...new Set(R.map((r) => r.zone))];
    chipRow($("#fNear"), [{ k: "", t: "全部" }, ...nears.map((z) => ({ k: z, t: z }))], "near");
  }

  function rCard(r) {
    const ny = NY[r.ny] || NY["?"];
    const links = (r.links || []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("");
    return `
      <article class="r" id="r-${esc(r.id)}">
        <div class="top"><span class="type">${esc(r.type)}</span><span class="badge ${ny.cls}">${ny.text}</span></div>
        <h3>${esc(r.name_zh)}</h3>
        <div class="jp">${esc(r.name_ja)}</div>
        <div class="where">${esc(r.area)}，${esc(r.station)}</div>
        <div class="price num">${r.price_lunch ? `<span>午 <b>${esc(r.price_lunch)}</b></span>` : ""}${r.price_dinner ? `<span>晚 <b>${esc(r.price_dinner)}</b></span>` : ""}${r.price ? `<span>人均 <b>${esc(r.price)}</b></span>` : ""}<span class="tier">${esc(r.tier)}</span></div>
        <p class="hlt">${esc(r.highlight)}</p>
        ${r.reservation ? `<p class="small">预约：${esc(r.reservation)}</p>` : ""}
        ${r.hours ? `<p class="small">营业：${esc(r.hours)}</p>` : ""}
        <p class="small">新年：${esc(r.newyear)}</p>
        <div class="links">${links}${r.verified ? "" : `<span class="unv">部分信息待复核</span>`}</div>
      </article>`;
  }

  function renderRestaurants() {
    const list = G.restaurants.filter((r) =>
      (!state.group || r.group === state.group) &&
      (!state.tier || r.tier === state.tier) &&
      (!state.near || r.zone === state.near) &&
      nyMatch(r, state.ny));
    $("#rCount").textContent = `共 ${list.length} 家`;
    $("#rgrid").innerHTML = list.length
      ? list.map(rCard).join("")
      : `<div class="empty"><strong>没有同时满足这些条件的餐厅</strong>放宽一个条件试试，比如把「新年营业」改回全部。</div>`;
  }

  function initRestaurants() {
    renderFilters();
    renderRestaurants();
    const map = { fGroup: "group", fTier: "tier", fNy: "ny", fNear: "near" };
    Object.entries(map).forEach(([id, key]) => {
      $("#" + id).addEventListener("click", (e) => {
        const b = e.target.closest(".chip");
        if (!b) return;
        state = { ...state, [key]: b.dataset.k };
        $("#" + id).querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
        renderRestaurants();
      });
    });
    $("#rReset").addEventListener("click", () => {
      state = EMPTY_FILTER;
      renderFilters();
      renderRestaurants();
    });
  }

  function focusRestaurant(id) {
    state = EMPTY_FILTER;
    renderFilters();
    renderRestaurants();
    const el = document.getElementById("r-" + id);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 1800);
  }

  /* ---------- 元旦吃饭 ---------- */
  function renderJan1() {
    const cls = ["b-a", "b-b", "b-c", "b-d", "b-e", "b-f"];
    $("#bento").innerHTML = G.jan1.slice(0, 6).map((t, i) => `
      <div class="${cls[i]}${t.img ? " has-img" : ""} reveal">
        ${t.img ? `<img src="img/${esc(t.img)}" alt="${esc(t.img_alt || "")}" loading="lazy">` : ""}
        ${t.big ? `<div class="big-wrap"><p class="big num">${esc(t.big)}</p><p class="big-label">${esc(t.big_label || "")}</p></div>` : ""}
        <h3>${esc(t.title)}</h3>
        <p>${esc(t.detail)}</p>
        ${t.sources?.length ? `<div class="src">${t.sources.map((s, j) => `<a href="${esc(s)}" target="_blank" rel="noopener">来源 ${j + 1}</a>`).join("")}</div>` : ""}
      </div>`).join("");
  }

  /* ---------- 须知 ---------- */
  function renderFaq() {
    $("#calendarNote").textContent = G.calendarNote || "";
    $("#faq").innerHTML = (G.faq || []).map((f) => `
      <details>
        <summary>${esc(f.q)}</summary>
        ${f.list ? `<ul>${f.list.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p>${esc(f.a)}</p>`}
      </details>`).join("");
  }

  /* ---------- 页脚来源 ---------- */
  function renderFooter() {
    $("#credits").innerHTML = G.credits.map((c) => `<li>${esc(c.what)}：<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title)}</a>，${esc(c.author)}，${esc(c.license)}</li>`).join("");
    $("#sources").innerHTML = G.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join("");
  }

  /* ---------- 进场动效 ---------- */
  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((e) => io.observe(e));
  }

  initTheme();
  renderDays();
  initMapChips();
  renderMap(null);
  renderAreas();
  initPlan();
  initRestaurants();
  renderJan1();
  renderFaq();
  renderFooter();
  initReveal();
})();
