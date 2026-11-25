// Báo cáo xu hướng dạng HTML (A4) để in ra PDF bằng expo-print.
import type { Data } from './core';
import type { Lang, Strings } from './i18n';
import { buildTrend, chartScale, topRounded, type Bar } from './trend';

const COL = { carb: '#c48a12', fat: '#3a6ea5', protein: '#b4432f', accent: '#0f6b4f', warn: '#a3561a', fg: '#16231d', muted: '#5d6d65', line: '#d9e2dd', soft: '#e1f0ea' };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function chartSvg(bars: Bar[], t: Strings, r0: (n: number) => string, short: (s: string) => string) {
  const W = 680, H = 250, ml = 46, mr = 10, mt = 16, mb = 26, pw = W - ml - mr, ph = H - mt - mb, N = bars.length;
  const { step, top } = chartScale(bars);
  const y = (v: number) => mt + ph - (v / top) * ph, bw = pw / N, barW = Math.max(5, Math.min(30, bw * 0.62));
  const every = N <= 14 ? 1 : N <= 31 ? 3 : 2;
  let g = '';
  for (let v = 0; v <= top; v += step)
    g += `<line x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}" stroke="${COL.line}"/><text x="${ml - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="${COL.muted}">${r0(v)}</text>`;
  bars.forEach((x, i) => {
    const cx = ml + bw * i + bw / 2, x0 = cx - barW / 2;
    if (x.k > 0) {
      const mk = x.c * 4 + x.f * 9 + x.p * 4 || 1;
      const segs = ([[x.c * 4, COL.carb], [x.f * 9, COL.fat], [x.p * 4, COL.protein]] as [number, string][]).filter((s) => s[0] > 0);
      let base = 0;
      segs.forEach((s, j) => {
        const v = (s[0] / mk) * x.k, yT = y(base + v), yB = y(base) - (j > 0 ? 1.5 : 0), h = Math.max(0, yB - yT);
        if (h > 0) g += j === segs.length - 1 ? `<path d="${topRounded(x0, yT, barW, h, 4)}" fill="${s[1]}"/>` : `<rect x="${x0}" y="${yT}" width="${barW}" height="${h}" fill="${s[1]}"/>`;
        base += v;
      });
      if (N <= 14) g += `<text x="${cx}" y="${Math.max(11, y(x.k) - 5)}" text-anchor="middle" font-size="10" fill="${COL.fg}">${r0(x.k)}</text>`;
    }
    if ((N - 1 - i) % every === 0) g += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="10" fill="${COL.muted}">${short(x.d)}</text>`;
  });
  let tp = '';
  bars.forEach((x, i) => { tp += `${i ? 'L' : 'M'}${ml + bw * i},${y(x.tg)}H${ml + bw * (i + 1)}`; });
  g += `<path d="${tp}" fill="none" stroke="${COL.fg}" stroke-width="1.5" stroke-dasharray="5 4" opacity=".75"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system,Helvetica,Arial,sans-serif">${g}</svg>`;
}

export function trendReportHtml(data: Data, t: Strings, lang: Lang, range: number, viewDate: string, now = new Date()) {
  const r0 = (n: number) => Math.round(n).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
  const fmt = (s: string) => { const [yy, m, d] = s.split('-'); return lang === 'en' ? `${m}/${d}/${yy}` : `${d}/${m}/${yy}`; };
  const short = (s: string) => { const [, m, d] = s.split('-'); return lang === 'en' ? `${+m}/${+d}` : `${+d}/${+m}`; };
  const wd = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'vi-VN', { weekday: 'short' });
  const tr = buildTrend(data, range, viewDate);
  const { daily, bars, logged } = tr;
  const kc = tr.avgP * 4 + tr.avgC * 4 + tr.avgF * 9 || 1;
  const pct = (g: number, f: number) => Math.round(((g * f) / kc) * 100);
  const stamp = now.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN', { dateStyle: 'short', timeStyle: 'short' });

  const rows = [...(range > 30 ? bars : daily)].reverse().map((x) => {
    const has = x.k > 0, diff = x.k - x.tg;
    const label = x.week ? `${t.week} ${short(x.d)}–${short(x.d2)}` : `${wd(x.d)} ${fmt(x.d)}`;
    return `<tr class="${has ? '' : 'empty'}"><td>${esc(label)}</td>
      <td class="n">${has ? r0(x.k) : '—'}</td><td class="n">${r0(x.tg)}</td>
      <td class="n ${has && diff > 0 ? 'over' : ''}">${has ? (diff > 0 ? '+' : '') + r0(diff) : '—'}</td>
      <td class="n">${has ? r0(x.p) : '—'}</td><td class="n">${has ? r0(x.c) : '—'}</td><td class="n">${has ? r0(x.f) : '—'}</td>
      <td class="n">${x.week ? `${x.n}/7` : x.meals || '—'}</td></tr>`;
  }).join('');

  const legend = [[COL.carb, t.carb], [COL.fat, t.fat], [COL.protein, t.protein]].map(([c, l]) => `<span><i style="background:${c}"></i>${esc(l)}</span>`).join('')
    + `<span><i class="dash"></i>${esc(t.legendTarget)}</span>`;

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(t.reportTitle)}</title>
<style>
@page { size: A4; margin: 14mm 14mm 16mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; color: ${COL.fg}; font-size: 11pt; line-height: 1.4; }
header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid ${COL.accent}; padding-bottom: 8px; margin-bottom: 14px; }
h1 { font-size: 19pt; margin: 0; color: ${COL.accent}; }
.sub { color: ${COL.muted}; font-size: 9.5pt; }
.right { text-align: right; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
.stat { border: 1px solid ${COL.line}; border-radius: 8px; padding: 8px 10px; }
.stat b { display: block; font-size: 16pt; }
.stat b.mix { font-size: 14pt; white-space: nowrap; line-height: 1.45; }
.stat span { color: ${COL.muted}; font-size: 8.5pt; }
h2 { font-size: 12pt; margin: 14px 0 6px; }
.legend { display: flex; gap: 14px; font-size: 9pt; color: ${COL.muted}; margin-bottom: 4px; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
.legend i.dash { width: 16px; height: 0; border-top: 2px dashed ${COL.fg}; border-radius: 0; vertical-align: 3px; }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
th { text-align: left; font-weight: 600; color: ${COL.muted}; border-bottom: 1.5px solid ${COL.fg}; padding: 5px 6px; }
td { border-bottom: 1px solid ${COL.line}; padding: 4px 6px; }
.n { text-align: right; font-variant-numeric: tabular-nums; }
th.n { text-align: right; }
tr.empty td { color: #a8b3ad; }
td.over { color: ${COL.warn}; font-weight: 600; }
tr { page-break-inside: avoid; }
.chart { page-break-inside: avoid; }
footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid ${COL.line}; color: ${COL.muted}; font-size: 8pt; }
</style></head><body>
<header>
  <div><h1>${esc(t.reportTitle)}</h1><div class="sub">${esc(t.appName)} · ${esc(t.authorLbl)}: Tran Hong Quan</div></div>
  <div class="right"><b>${range} ${esc(t.days)}: ${fmt(daily[0].d)} – ${fmt(daily[daily.length - 1].d)}</b><div class="sub">${esc(t.reportMade)} ${esc(stamp)}</div></div>
</header>
<div class="stats">
  <div class="stat"><b>${r0(tr.avg)}</b><span>kcal · ${esc(t.avgLbl)}</span></div>
  <div class="stat"><b>${logged.length}/${range}</b><span>${esc(t.loggedLbl)}</span></div>
  <div class="stat"><b>${tr.over}</b><span>${esc(t.overLbl)}</span></div>
  <div class="stat"><b class="mix">${pct(tr.avgP, 4)} · ${pct(tr.avgC, 4)} · ${pct(tr.avgF, 9)} %</b><span>${esc(t.protein)} · ${esc(t.carb)} · ${esc(t.fat)} (${esc(t.reportEnergy)})</span></div>
</div>
<div class="chart">
  <h2>${esc(t.trendTitle)}${range > 30 ? ` <span class="sub">(${esc(t.weekAvg)})</span>` : ''}</h2>
  <div class="legend">${legend}</div>
  ${logged.length ? chartSvg(bars, t, r0, short) : `<p class="sub">${esc(t.noTrend)}</p>`}
</div>
<h2>${esc(range > 30 ? t.reportWeeks : t.reportDays)}</h2>
<table><thead><tr><th>${esc(range > 30 ? t.week : t.reportDate)}</th><th class="n">kcal</th><th class="n">${esc(t.legendTarget)}</th><th class="n">±</th>
  <th class="n">${esc(t.protein)} (g)</th><th class="n">${esc(t.carb)} (g)</th><th class="n">${esc(t.fat)} (g)</th><th class="n">${esc(range > 30 ? t.loggedLbl : t.reportMeals)}</th></tr></thead>
<tbody>${rows}</tbody></table>
<footer>${esc(t.footer)}</footer>
</body></html>`;
}
