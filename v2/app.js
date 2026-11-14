/* 东京小众轻奢景点：渲染与交互。数据来自 data.js（window.GUIDE2），只读不改。 */
(function () {
  "use strict";

  const G = window.GUIDE2;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DAYS = ["1/1", "1/2", "1/3", "1/4", "1/5"];
  const WEEK = { "1/1": "周五", "1/2": "周六", "1/3": "周日", "1/4": "周一", "1/5": "周二" };
  const STATE_LABEL = { open: "开", closed: "休", unknown: "待定" };

  const REQUIRED = ["spots", "picks", "routes", "notes", "credits", "sources"];
  const missing = G ? REQUIRED.filter((k) => !Array.isArray(G[k])) : REQUIRED;
  if (missing.length) {
    document.body.insertAdjacentHTML("afterbegin",
      `<p style="padding:16px;background:#1e4c9a;color:#fff;margin:0">景点数据没有加载完整（缺少：${missing.join("、")}）。请确认 data.js 和 index.html 在同一个文件夹里。</p>`);
    return;
  }
  const byId = new Map(G.spots.map((s) => [s.id, s]));

  /* ---------- 主题 ---------- */
  function initTheme() {
    const btn = $("#themeBtn");
    const saved = localStorage.getItem("tokyo2-theme");
    if (saved) document.documentElement.dataset.theme = saved;
    const isDark = () => {
      const t = document.documentElement.dataset.theme;
      return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    };
    const label = () => { btn.textContent = isDark() ? "浅色" : "深色"; };
    label();
    btn.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("tokyo2-theme", next);
      label();
    });
  }

  /* ---------- 精选 ---------- */
  function renderPicks() {
    $("#picks").innerHTML = G.picks.map((p) => {
      const s = byId.get(p.id);
      if (!s) return "";
      return `
        <a class="pick${s.img ? "" : " noimg"} reveal" href="#s-${esc(s.id)}" data-open="${esc(s.id)}">
          ${s.img ? `<img src="img/${esc(s.img)}" alt="${esc(s.img_alt || s.name_zh)}" loading="lazy">` : ""}
          <span class="k">${esc(p.kicker)}</span>
          <h3>${esc(s.name_zh)}</h3>
          <p>${esc(p.text)}</p>
        </a>`;
    }).join("");
  }

  /* ---------- 按日期找 ---------- */
  let state = Object.freeze({ day: "", group: "", hideClosed: true });
  const openCount = (d) => G.spots.filter((s) => s.days[d]?.state === "open").length;

  function renderDayband() {
    $("#dayband").innerHTML = DAYS.map((d) => `
      <button type="button" data-d="${d}" aria-pressed="${state.day === d}">
        <span class="d num">${d}</span>
        <span class="w">${WEEK[d]}</span>
        <span class="c">确定开放 <b class="num">${openCount(d)}</b> 处</span>
      </button>`).join("");
  }

  function renderChips() {
    const groups = [...new Set(G.spots.map((s) => s.group))];
    const opts = [{ k: "", t: "全部", n: G.spots.length }, ...groups.map((g) => ({ k: g, t: g, n: G.spots.filter((s) => s.group === g).length }))];
    $("#groupChips").innerHTML = opts.map((o) => `<button class="chip" type="button" data-k="${esc(o.k)}" aria-pressed="${state.group === o.k}">${esc(o.t)}<small class="num">${o.n}</small></button>`).join("");
  }

  function availStrip(s) {
    return `<div class="avail" aria-label="1 月 1 日至 5 日开放情况">${DAYS.map((d) => {
      const st = s.days[d]?.state || "unknown";
      return `<span class="${st}${state.day === d ? " sel" : ""}" title="${esc(s.days[d]?.text || "")}"><b>${d}</b>${STATE_LABEL[st]}</span>`;
    }).join("")}</div>`;
  }

  function row(s) {
    const thumb = s.img
      ? `<img class="thumb" src="img/${esc(s.img)}" alt="" loading="lazy">`
      : `<div class="thumb-ph" aria-hidden="true">${esc(s.name_zh.slice(0, 1))}</div>`;
    const links = (s.links || []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("");
    const dim = state.day && s.days[state.day]?.state === "closed";
    return `
      <li>
        <details class="row${dim ? " dim" : ""}" id="s-${esc(s.id)}">
          <summary>
            ${thumb}
            <div>
              <h3>${esc(s.name_zh)}</h3>
              <div class="jp">${esc(s.name_ja)}</div>
              <div class="meta"><span>${esc(s.group)}</span><span>${esc(s.area)}</span><span>小众 ${s.niche}/5</span><span>轻奢 ${s.lux}/5</span></div>
            </div>
            ${availStrip(s)}
            <span class="plus" aria-hidden="true">+</span>
          </summary>
          <div class="detail">
            <div>
              <p class="why">${esc(s.why)}</p>
              <dl>
                <dt>价格</dt><dd>${esc(s.fee)}</dd>
                <dt>预约</dt><dd>${esc(s.reservation)}</dd>
                <dt>平时</dt><dd>${esc(s.hours)}</dd>
                <dt>怎么去</dt><dd>${esc(s.from_hotel)}${s.station ? `（${esc(s.station)}）` : ""}</dd>
                <dt>人流</dt><dd>${esc(s.crowd)}</dd>
                ${s.event ? `<dt>新年</dt><dd>${esc(s.event)}</dd>` : ""}
                ${s.tip ? `<dt>提示</dt><dd>${esc(s.tip)}</dd>` : ""}
              </dl>
              <div class="days">${DAYS.map((d) => `<div><b>${d}</b><span>${esc(s.days[d]?.text || "未查到")}</span></div>`).join("")}</div>
              <p class="note">新年数据：${esc(s.year)}${s.verified ? "" : "；部分信息待复核"}</p>
              <div class="links">${links}</div>
            </div>
            ${s.img ? `<img src="img/${esc(s.img)}" alt="${esc(s.img_alt || s.name_zh)}" loading="lazy">` : "<div></div>"}
          </div>
        </details>
      </li>`;
  }

  const ORDER = { open: 0, unknown: 1, closed: 2 };
  function renderIndex() {
    const base = G.spots.filter((s) => !state.group || s.group === state.group);
    const visible = state.day && state.hideClosed ? base.filter((s) => s.days[state.day]?.state !== "closed") : base;
    const sorted = state.day
      ? [...visible].sort((a, b) => ORDER[a.days[state.day]?.state || "unknown"] - ORDER[b.days[state.day]?.state || "unknown"])
      : visible;
    const dayText = state.day ? `${state.day}（${WEEK[state.day]}）` : "1/1 至 1/5";
    $("#found").innerHTML = `<span>${dayText}：显示 <b class="num">${sorted.length}</b> 处</span>
      <label class="toggle"><input type="checkbox" id="hideClosed" ${state.hideClosed ? "checked" : ""} ${state.day ? "" : "disabled"}> 隐藏当天休息的</label>`;
    $("#index").innerHTML = sorted.length
      ? sorted.map(row).join("")
      : `<li class="empty"><strong>这一天这个类别没有开放的地方</strong>换一个类别，或者取消「隐藏当天休息的」。</li>`;
    $("#hideClosed").addEventListener("change", (e) => {
      state = { ...state, hideClosed: e.target.checked };
      renderIndex();
    });
  }

  function initFinder() {
    renderDayband();
    renderChips();
    renderIndex();
    $("#dayband").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-d]");
      if (!b) return;
      state = { ...state, day: state.day === b.dataset.d ? "" : b.dataset.d };
      renderDayband();
      renderIndex();
    });
    $("#groupChips").addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      state = { ...state, group: b.dataset.k };
      renderChips();
      renderIndex();
    });
  }

  function openSpot(id) {
    const el = document.getElementById("s-" + id);
    if (!el) {
      state = { ...state, day: "", group: "" };
      renderDayband();
      renderChips();
      renderIndex();
    }
    const target = document.getElementById("s-" + id);
    if (!target) return;
    target.open = true;
    target.scrollIntoView({ block: "start" });
  }

  /* ---------- 路线 ---------- */
  function renderRoutes() {
    $("#routes").innerHTML = G.routes.map((r) => `
      <article class="route">
        <span class="when">${esc(r.when)}</span>
        <h3>${esc(r.title)}</h3>
        <p>${esc(r.text)}</p>
        <ol>${r.stops.map((st) => {
          const s = st.id ? byId.get(st.id) : null;
          const name = s ? `<a href="#s-${esc(s.id)}" data-open="${esc(s.id)}">${esc(s.name_zh)}</a>` : `<span>${esc(st.name)}</span>`;
          return `<li><div>${name}<small>${esc(st.note)}</small></div></li>`;
        }).join("")}</ol>
      </article>`).join("");
  }

  /* ---------- 须知与页脚 ---------- */
  function renderNotes() {
    $("#notes").innerHTML = G.notes.map((n) => `<div><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p></div>`).join("");
    $("#credits").innerHTML = G.credits.map((c) => `<li>${esc(c.what)}：<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title)}</a>，${esc(c.author)}，${esc(c.license)}</li>`).join("");
    $("#sources").innerHTML = G.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join("");
    const heroCredit = G.credits.find((c) => c.file === G.hero?.img);
    $("#heroCredit").textContent = heroCredit ? `照片：${heroCredit.author}，${heroCredit.license}` : "";
  }

  function initJump() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-open]");
      if (!a) return;
      e.preventDefault();
      openSpot(a.dataset.open);
    });
  }

  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach((x) => x.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((x) => io.observe(x));
  }

  initTheme();
  renderPicks();
  initFinder();
  renderRoutes();
  renderNotes();
  initJump();
  initReveal();
})();
