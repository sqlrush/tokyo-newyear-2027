/* 东京新年游戏机之旅（第五版）：渲染与交互。版式与第二、三版一致。数据来自 data.js（window.GUIDE5），只读不改。 */
(function () {
  "use strict";

  const G = window.GUIDE5;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const yen = (n) => "¥" + Math.round(n).toLocaleString("en-US");
  const DAYS = ["1/1", "1/2", "1/3", "1/4", "1/5"];
  const WEEK = { "1/1": "周五", "1/2": "周六", "1/3": "周日", "1/4": "周一", "1/5": "周二" };
  const STATE_LABEL = { open: "开", closed: "休", unknown: "待定" };

  const REQUIRED = ["items", "picks", "days", "notes", "timeline", "credits", "sources"];
  const missing = G ? REQUIRED.filter((k) => !Array.isArray(G[k])) : REQUIRED;
  if (missing.length) {
    document.body.insertAdjacentHTML("afterbegin",
      `<p style="padding:16px;background:#1e4c9a;color:#fff;margin:0">数据没有加载完整（缺少：${missing.join("、")}）。请确认 data.js 和 index.html 在同一个文件夹里。</p>`);
    return;
  }
  const byId = new Map(G.items.map((x) => [x.id, x]));
  const RATE = G.rate || 23.6;

  /* ---------- 主题：跟随系统，可手动切换 ---------- */
  function initTheme() {
    const btn = $("#themeBtn");
    const saved = localStorage.getItem("tokyo5-theme");
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
      localStorage.setItem("tokyo5-theme", next);
      label();
    });
  }

  /* ---------- 精选 ---------- */
  function renderPicks() {
    $("#picks").innerHTML = G.picks.map((p) => {
      const x = byId.get(p.id);
      if (!x) return "";
      return `
        <a class="pick${x.img ? "" : " noimg"} reveal" href="#s-${esc(x.id)}" data-open="${esc(x.id)}">
          ${x.img ? `<img src="img/${esc(x.img)}" alt="${esc(x.img_alt || x.name_zh)}" loading="lazy">` : ""}
          <span class="k">${esc(p.kicker)}</span>
          <h3>${esc(x.name_zh)}</h3>
          <p>${esc(p.text)}</p>
        </a>`;
    }).join("");
  }

  /* ---------- 五日行程（账本） ---------- */
  const dayTotal = (d) => d.rows.reduce((s, r) => s + (r.cost || 0), 0);
  const cny = (n) => Math.round(n / RATE).toLocaleString("en-US");

  function renderDay(i) {
    const d = G.days[i];
    const total = dayTotal(d);
    const all = G.days.reduce((s, x) => s + dayTotal(x), 0);
    $("#ledger").innerHTML = d.rows.map((r) => {
      const it = r.ref ? byId.get(r.ref) : null;
      const name = it ? `<a href="#s-${esc(it.id)}" data-open="${esc(it.id)}">${esc(r.title)}</a>` : esc(r.title);
      return `<tr>
        <td class="t num">${esc(r.time)}</td>
        <td class="w"><b>${name}</b><span>${esc(r.note)}</span>${r.move ? `<span class="move">${esc(r.move)}</span>` : ""}</td>
        <td class="c num">${r.cost ? yen(r.cost) : esc(r.cost_text || "免费")}<small>${esc(r.cost_note || "")}</small></td>
      </tr>`;
    }).join("");
    const stops = d.rows.filter((r) => r.ref).length;
    $("#total").innerHTML = `
      <div class="lab">${esc(d.date)}（${WEEK[d.date] || ""}）${esc(d.title || "")}</div>
      <div class="sum num">${stops} 站</div>
      <div class="cny">${d.book ? `要提前订：${esc(d.book)}` : "这天不用提前订位"}</div>
      <p>${esc(d.note)}</p>
      <div class="cum">
        ${total ? `<div><span>这天的主题咖啡</span><b class="num">${yen(total)}（估算）</b></div>` : ""}
        <div><span>五天主题咖啡合计</span><b class="num">${yen(all)}（约 ${cny(all)} 元）</b></div>
      </div>
      <p class="fine">买机器、卡带、扭蛋和街机投币都另算，也不含住宿、交通和其他餐饮。</p>`;
  }

  function initDays() {
    const tabs = $("#dayTabs");
    tabs.innerHTML = G.days.map((d, i) => `<button class="chip" type="button" data-i="${i}" aria-pressed="${i === 0}">${esc(d.date)} ${esc(d.short)}</button>`).join("");
    tabs.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      tabs.querySelectorAll(".chip").forEach((t) => t.setAttribute("aria-pressed", String(t === b)));
      renderDay(Number(b.dataset.i));
    });
    renderDay(0);
  }

  /* ---------- 逛街须知 ---------- */
  function renderNotes() {
    $("#notes").innerHTML = G.notes.map((n) => `<div><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p></div>`).join("");
  }

  /* ---------- 按日期找（与第二版相同的日期栏 + 类别 + 索引列表） ---------- */
  const EMPTY = Object.freeze({ day: "", group: "", hideClosed: true });
  let state = EMPTY;
  const openCount = (d) => G.items.filter((x) => x.days[d]?.state === "open").length;

  function renderDayband() {
    $("#dayband").innerHTML = DAYS.map((d) => `
      <button type="button" data-d="${d}" aria-pressed="${state.day === d}">
        <span class="d num">${d}</span>
        <span class="w">${WEEK[d]}</span>
        <span class="c">确定营业 <b class="num">${openCount(d)}</b> 处</span>
      </button>`).join("");
  }

  function renderChips() {
    const groups = [...new Set(G.items.map((x) => x.group))];
    const opts = [{ k: "", t: "全部", n: G.items.length }, ...groups.map((g) => ({ k: g, t: g, n: G.items.filter((x) => x.group === g).length }))];
    $("#groupChips").innerHTML = opts.map((o) => `<button class="chip" type="button" data-k="${esc(o.k)}" aria-pressed="${state.group === o.k}">${esc(o.t)}<small class="num">${o.n}</small></button>`).join("");
  }

  function availStrip(x) {
    return `<div class="avail" aria-label="1 月 1 日至 5 日营业情况">${DAYS.map((d) => {
      const st = x.days[d]?.state || "unknown";
      return `<span class="${st}${state.day === d ? " sel" : ""}" title="${esc(x.days[d]?.text || "")}"><b>${d}</b>${STATE_LABEL[st]}</span>`;
    }).join("")}</div>`;
  }

  function row(x) {
    const thumb = x.img
      ? `<img class="thumb" src="img/${esc(x.img)}" alt="" loading="lazy">`
      : `<div class="thumb-ph" aria-hidden="true">${esc(x.name_zh.slice(0, 1))}</div>`;
    const links = (x.links || []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("");
    const dim = state.day && x.days[state.day]?.state === "closed";
    const rows = [["价格", x.price_full], ["预订", x.booking], ["取消", x.cancel], ["着装", x.dress], ["时间", x.hours],
      ["怎么去", x.from_hotel], ["新年", x.event], ["提示", x.tip]].filter(([, v]) => v && String(v).trim() && v !== "-");
    return `
      <li>
        <details class="row${dim ? " dim" : ""}" id="s-${esc(x.id)}">
          <summary class="has-price">
            ${thumb}
            <div>
              <h3>${esc(x.name_zh)}</h3>
              <div class="jp">${esc(x.name_ja)}</div>
              <div class="meta"><span>${esc(x.group)}</span><span>${esc(x.area)}</span></div>
              ${x.honor ? `<div class="honor">${esc(x.honor)}</div>` : ""}
            </div>
            <div class="rprice num">${esc(x.price_main || "")}<small>${esc(x.price_label || "")}</small></div>
            ${availStrip(x)}
            <span class="plus" aria-hidden="true">+</span>
          </summary>
          <div class="detail">
            <div>
              <p class="why">${esc(x.why)}</p>
              <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
              <div class="days">${DAYS.map((d) => `<div><b>${d}</b><span>${esc(x.days[d]?.text || "未查到")}</span></div>`).join("")}</div>
              <p class="note">新年数据：${esc(x.year || "未公布")}${x.verified ? "" : "；部分信息待复核"}</p>
              <div class="links">${links}</div>
            </div>
            ${x.img ? `<img src="img/${esc(x.img)}" alt="${esc(x.img_alt || x.name_zh)}" loading="lazy">` : "<div></div>"}
          </div>
        </details>
      </li>`;
  }

  const ORDER = { open: 0, unknown: 1, closed: 2 };
  function renderIndex() {
    const base = G.items.filter((x) => !state.group || x.group === state.group);
    const visible = state.day && state.hideClosed ? base.filter((x) => x.days[state.day]?.state !== "closed") : base;
    const sorted = state.day
      ? [...visible].sort((a, b) => ORDER[a.days[state.day]?.state || "unknown"] - ORDER[b.days[state.day]?.state || "unknown"])
      : visible;
    const dayText = state.day ? `${state.day}（${WEEK[state.day]}）` : "1/1 至 1/5";
    $("#found").innerHTML = `<span>${dayText}：显示 <b class="num">${sorted.length}</b> 处</span>
      <label class="toggle"><input type="checkbox" id="hideClosed" ${state.hideClosed ? "checked" : ""} ${state.day ? "" : "disabled"}> 隐藏当天休息的</label>`;
    $("#index").innerHTML = sorted.length
      ? sorted.map(row).join("")
      : `<li class="empty"><strong>这一天这个类别没有营业的地方</strong>换一个类别，或者取消「隐藏当天休息的」。</li>`;
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

  function openItem(id) {
    if (!document.getElementById("s-" + id)) {
      state = EMPTY;
      renderDayband();
      renderChips();
      renderIndex();
    }
    const target = document.getElementById("s-" + id);
    if (!target) return;
    target.open = true;
    target.scrollIntoView({ block: "start" });
  }

  /* ---------- 时间线与页脚 ---------- */
  function renderTimeline() {
    $("#timeline").innerHTML = G.timeline.map((t) => `<li><div class="when num">${esc(t.when)}</div><div class="what">${esc(t.what)}</div><p>${esc(t.text)}</p></li>`).join("");
  }

  function renderFooter() {
    $("#credits").innerHTML = G.credits.map((c) => `<li>${esc(c.what)}：<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title)}</a>，${esc(c.author)}，${esc(c.license)}</li>`).join("");
    $("#sources").innerHTML = G.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join("");
    const hc = G.credits.find((c) => c.file === G.hero?.img);
    $("#heroCredit").textContent = hc ? `${G.hero.caption ? G.hero.caption + "。" : ""}照片：${hc.author}，${hc.license}` : "";
  }

  function initJump() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-open]");
      if (!a) return;
      e.preventDefault();
      openItem(a.dataset.open);
    });
  }

  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach((x) => x.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    els.forEach((x) => io.observe(x));
  }

  initTheme();
  renderPicks();
  initDays();
  renderNotes();
  initFinder();
  renderTimeline();
  renderFooter();
  initJump();
  initReveal();
})();
