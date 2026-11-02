// Neto — wspólna nawigacja i wykresy makiet. Dane są przykładowe.
(function () {
  const params = new URLSearchParams(location.search);
  if (params.get("theme") === "dark") document.documentElement.dataset.theme = "dark";

  const ico = (d) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    pulpit: ico('<path d="M3 20h18"/><path d="M5 16l4-5 4 3 6-8"/>'),
    majatek: ico('<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>'),
    dodaj: ico('<path d="M12 5v14M5 12h14"/>'),
    cele: ico('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8"/>'),
    wiecej: ico('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
    ustawienia: ico('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/>'),
    oko: ico('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    dzwonek: ico('<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2z"/><path d="M10 21h4"/>'),
    uwaga: ico('<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.01"/>'),
    wstecz: ico('<path d="M15 5l-7 7 7 7"/>'),
  };
  window.NetoIcons = I;

  const page = document.body.dataset.page;
  const items = [
    ["pulpit", "Pulpit", "pulpit.html"],
    ["majatek", "Majątek", "majatek.html"],
    ["cele", "Cele", "cele.html"],
    ["ustawienia", "Ustawienia", "ustawienia.html"],
  ];
  const cur = (k) => (k === page ? ' aria-current="page"' : "");

  const side = document.querySelector(".sidebar");
  if (side) {
    side.innerHTML =
      `<div class="logo">Neto</div>` +
      items.map(([k, l, h]) => `<a class="nav" href="${h}"${cur(k)}>${I[k]}${l}</a>`).join("") +
      `<a class="btn" href="#">${I.dodaj}Dodaj</a>` +
      `<div class="foot">Makieta, dane przykładowe</div>`;
  }
  const bottom = document.querySelector(".bottom-nav");
  if (bottom) {
    const [p, m, c, u] = items;
    const a = ([k, l, h]) => `<a href="${h}"${cur(k)}>${I[k]}<span>${l}</span></a>`;
    bottom.innerHTML =
      a(p) + a(m) + `<a href="#" aria-label="Dodaj"><span class="add">${I.dodaj}</span></a>` + a(c) +
      `<a href="${u[2]}"${cur("ustawienia")}>${I.wiecej}<span>Więcej</span></a>`;
  }
  document.querySelectorAll("[data-icon]").forEach((el) => (el.innerHTML = I[el.dataset.icon]));
  document.querySelectorAll("[data-toggle-private]").forEach((b) =>
    b.addEventListener("click", () => {
      const on = document.body.classList.toggle("private");
      b.setAttribute("aria-pressed", String(on));
    })
  );

  // ---------- Wykres bilansu (Pulpit) ----------
  const fmtK = (v) => `${Math.round(v)} tys.`;

  window.drawBalanceChart = function (el, data) {
    const W = Math.max(320, el.clientWidth || 640), H = W < 500 ? 220 : 260, padL = 4, padR = 56, top = 14, bottom = 26;
    const maxA = Math.max(...data.map((d) => d.a));
    const maxL = Math.max(...data.map((d) => d.l));
    const span = maxA + maxL;
    const plotH = H - top - bottom;
    const zeroY = top + (maxA / span) * plotH;
    const y = (v) => zeroY - (v / span) * plotH;
    const x = (i) => padL + (i / (data.length - 1)) * (W - padL - padR);
    const line = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");

    const aPts = data.map((d, i) => [x(i), y(d.a)]);
    const lPts = data.map((d, i) => [x(i), y(-d.l)]);
    const nPts = data.map((d, i) => [x(i), y(d.a - d.l)]);
    const last = data.length - 1;

    const ticks = [maxA, (maxA / 2), 0, -maxL];
    el.innerHTML = `
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Historia: aktywa nad osią, zobowiązania pod osią, linia wartości netto">
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--down-soft)"/>
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--down)" stroke-width="2" opacity=".55"/>
          </pattern>
        </defs>
        ${ticks.map((t) => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/>
          <text class="axis-lbl" x="${W - padR + 8}" y="${y(t) + 4}">${t === 0 ? "0" : (t < 0 ? "−" : "") + fmtK(Math.abs(t))}</text>`).join("")}
        <path class="a-area" d="${line(aPts)}L${x(last)},${zeroY}L${x(0)},${zeroY}Z"/>
        <path class="l-area" d="${line(lPts)}L${x(last)},${zeroY}L${x(0)},${zeroY}Z"/>
        <line class="zero" x1="${padL}" x2="${W - padR}" y1="${zeroY}" y2="${zeroY}"/>
        <path class="net" d="${line(nPts)}"/>
        <circle cx="${nPts[last][0]}" cy="${nPts[last][1]}" r="4.5" fill="var(--brand)"/>
        ${data.map((d, i) => (i % 3 === 0 || i === last) ? `<text class="axis-lbl" x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === last ? "end" : "middle"}">${d.m}</text>` : "").join("")}
      </svg>`;
  };

  // ---------- Kalkulator emerytury (Cele) — wzór z SPEC 7.11 ----------
  window.retirement = function (o) {
    const out = {};
    for (const [k, r] of Object.entries(o.returns)) {
      const rm = Math.pow(1 + r, 1 / 12) - 1;
      const series = [];
      let firstAge = null;
      for (let age = o.age; age <= 80; age++) {
        const n = (age - o.age) * 12;
        const fv = rm === 0 ? o.pv + o.pmt * n : o.pv * Math.pow(1 + rm, n) + o.pmt * ((Math.pow(1 + rm, n) - 1) / rm);
        series.push([age, fv]);
        if (firstAge === null && fv >= o.need) firstAge = age;
      }
      out[k] = { series, firstAge, atRetire: series.find((s) => s[0] === o.retireAge)[1] };
    }
    return out;
  };

  window.drawRetirementChart = function (el, res, o) {
    const W = Math.max(320, el.clientWidth || 640), H = W < 500 ? 220 : 240, padL = 4, padR = 64, top = 12, bottom = 26;
    const ages = res.base.series.map((s) => s[0]);
    const maxV = Math.max(o.need * 1.25, ...Object.values(res).map((r) => r.series.find((s) => s[0] === 75)[1]));
    const x = (age) => padL + ((age - ages[0]) / (80 - ages[0])) * (W - padL - padR);
    const y = (v) => top + (1 - v / maxV) * (H - top - bottom);
    const path = (s) => s.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
    const mln = (v) => (v / 1e6).toFixed(1).replace(".", ",") + " mln";
    el.innerHTML = `
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kapitał w trzech scenariuszach i potrzebny kapitał">
        ${[0, 0.5, 1].map((f) => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(maxV * f)}" y2="${y(maxV * f)}"/>
          <text class="axis-lbl" x="${W - padR + 8}" y="${y(maxV * f) + 4}">${f === 0 ? "0" : mln(maxV * f)}</text>`).join("")}
        <line class="need" x1="${padL}" x2="${W - padR}" y1="${y(o.need)}" y2="${y(o.need)}"/>
        <text class="axis-lbl" x="${W - padR + 8}" y="${y(o.need) + 4}" style="fill:var(--down)">${mln(o.need)}</text>
        <line class="grid" x1="${x(o.retireAge)}" x2="${x(o.retireAge)}" y1="${top}" y2="${H - bottom}" stroke-dasharray="2 3"/>
        <clipPath id="rc"><rect x="${padL}" y="${top}" width="${W - padL - padR}" height="${H - top - bottom}"/></clipPath>
        <g clip-path="url(#rc)">
        <path class="ret ret-low" d="${path(res.low.series)}"/>
        <path class="ret ret-base" d="${path(res.base.series)}"/>
        <path class="ret ret-high" d="${path(res.high.series)}"/>
        </g>
        ${ages.filter((a) => a % 5 === 0 && a - ages[0] >= 3 || a === ages[0]).map((a) => `<text class="axis-lbl" x="${x(a)}" y="${H - 6}" text-anchor="middle">${a}</text>`).join("")}
      </svg>`;
  };

  // ---------- Wartość i koszt pozycji (Szczegóły pozycji) ----------
  window.drawValueChart = function (el, data) {
    const W = Math.max(320, el.clientWidth || 640), H = W < 500 ? 200 : 240, padL = 4, padR = 64, top = 12, bottom = 26;
    const vals = data.flatMap((d) => [d.v, d.c]);
    const lo = Math.min(...vals) * 0.95, hi = Math.max(...vals) * 1.02;
    const x = (i) => padL + (i / (data.length - 1)) * (W - padL - padR);
    const y = (v) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bottom);
    const path = (k) => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join("");
    const last = data.length - 1;
    el.innerHTML = `
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Wartość pozycji i koszt nabycia w czasie">
        ${[lo, (lo + hi) / 2, hi].map((t) => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/>
          <text class="axis-lbl" x="${W - padR + 8}" y="${y(t) + 4}">${Math.round(t)} tys.</text>`).join("")}
        <path d="${path("v")}L${x(last)},${H - bottom}L${x(0)},${H - bottom}Z" fill="var(--brand-soft)" opacity=".7"/>
        <path d="${path("c")}" fill="none" stroke="var(--ink-3)" stroke-width="1.6" stroke-dasharray="5 4"/>
        <path class="net" d="${path("v")}"/>
        ${data.map((d, i) => (i % 3 === 0 || i === last) ? `<text class="axis-lbl" x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === last ? "end" : "middle"}">${d.m}</text>` : "").join("")}
      </svg>`;
  };
})();
