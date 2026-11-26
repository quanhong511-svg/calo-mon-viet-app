// Sao lưu dạng PDF: một nhật ký ăn uống đọc/in được, kèm bản sao lưu JSON giấu trong file
// để nhập lại vào app.
//
// Cách giấu: thêm các dòng chú thích PDF ("%...") ngay trước phần đuôi `startxref … %%EOF`.
// Trình đọc PDF bỏ qua chú thích, còn đuôi file được chép lại nguyên vẹn nên file vẫn mở bình thường.
// JSON được đổi hết ký tự ngoài ASCII thành \uXXXX và không có xuống dòng, nên nằm gọn trong chú thích.
import { backup, itemName, mealName } from './backup';
import { mealTot, sum, targetOn, type Data } from './core';
import type { Lang, Strings } from './i18n';

const BEGIN = '%CALO-MON-VIET-BACKUP-BEGIN';
const END = '%CALO-MON-VIET-BACKUP-END';
const LINE = '%CMV ';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function logPdfHtml(data: Data, t: Strings, lang: Lang, now = new Date()): string {
  const loc = lang === 'en' ? 'en-US' : 'vi-VN';
  const r0 = (n: number) => Math.round(n).toLocaleString(loc);
  const days = Object.keys(data.days).filter((d) => data.days[d].some((m) => !m.example)).sort().reverse();
  const head = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(loc, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  let nMeals = 0, kAll = 0;
  const blocks = days.map((d) => {
    const meals = data.days[d].filter((m) => !m.example).sort((a, b) => a.time.localeCompare(b.time));
    const tots = meals.map(mealTot), k = sum(tots, 'k'), tgt = targetOn(data, d), ml = data.water?.[d] || 0;
    nMeals += meals.length; kAll += k;
    const rows = meals.map((m, i) => {
      const sv = Number(m.servings) || 1, tt = tots[i];
      const dishes = m.items.map((it) => `${esc(itemName(lang, it))} <span class="mu">${r0(it.grams * sv)} g</span>`).join('<br>');
      return `<tr><td><b>${esc(mealName(t, m.meal))}</b><br><span class="mu">${esc(m.time)}${sv !== 1 ? ` · ×${sv}` : ''}</span></td><td>${dishes}</td>
        <td class="n"><b>${r0(tt.k)}</b></td><td class="n">${r0(tt.p)}</td><td class="n">${r0(tt.c)}</td><td class="n">${r0(tt.f)}</td></tr>`;
    }).join('');
    const over = k > tgt * 1.1;
    return `<section><div class="dh"><b>${esc(head(d))}</b><span><b style="color:${over ? '#a3561a' : '#0f6b4f'}">${r0(k)}</b> / ${r0(tgt)} kcal${ml ? ` · ${t.water} ${r0(ml)} ml` : ''}</span></div>
      <table><tr><th style="width:18%">${t.pdfMeal}</th><th>${t.pdfDishes}</th><th class="n" style="width:9%">kcal</th><th class="n" style="width:10%">${t.protein} g</th><th class="n" style="width:13%">${t.carb} g</th><th class="n" style="width:13%">${t.fat} g</th></tr>${rows}</table></section>`;
  }).join('');
  const avg = days.length ? kAll / days.length : 0;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
    body{font:12px/1.45 -apple-system,Helvetica,Arial,sans-serif;color:#16231d;margin:0}
    h1{font-size:20px;margin:0 0 2px;color:#0f6b4f} .mu{color:#5d6d65} .n{text-align:right;white-space:nowrap}
    .sum{display:flex;gap:18px;margin:10px 0 16px;padding:10px 12px;background:#e1f0ea;border-radius:8px}
    section{break-inside:avoid;margin-bottom:14px} .dh{display:flex;justify-content:space-between;border-bottom:2px solid #0f6b4f;padding:4px 0;margin-bottom:4px}
    table{width:100%;border-collapse:collapse;table-layout:fixed} th{font-size:10px;text-transform:uppercase;color:#5d6d65;text-align:left;font-weight:600;padding:4px 6px;border-bottom:1px solid #d9e2dd}
    td{padding:5px 6px;border-bottom:1px solid #eef2ef;vertical-align:top} .ft{margin-top:18px;font-size:10px;color:#5d6d65}
  </style></head><body>
    <h1>${t.pdfTitle}</h1><div class="mu">${t.appName} · ${t.reportMade} ${esc(now.toLocaleString(loc))}</div>
    <div class="sum"><span>${t.pdfDays}: <b>${days.length}</b></span><span>${t.reportMeals}: <b>${nMeals}</b></span><span>${t.pdfAvg}: <b>${r0(avg)} kcal</b></span></div>
    ${blocks || `<p class="mu">${t.emptyMeals}</p>`}
    <p class="ft">${t.pdfFooter}</p>
  </body></html>`;
}

const ascii = (s: string) => s.replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

/** Chèn bản sao lưu vào file PDF (bytes) vừa tạo. */
export function embedBackup(pdf: Uint8Array, data: Data, lang: Lang): Uint8Array {
  const json = ascii(JSON.stringify(backup(data, lang)));
  let block = '\n' + BEGIN + '\n';
  for (let i = 0; i < json.length; i += 2000) block += LINE + json.slice(i, i + 2000) + '\n';
  block += END + '\n';
  const extra = new Uint8Array(block.length);
  for (let i = 0; i < block.length; i++) extra[i] = block.charCodeAt(i);
  // tìm "startxref" cuối cùng; chèn khối chú thích trước nó và giữ nguyên đuôi file
  const tail = lastIndexOf(pdf, 'startxref');
  const cut = tail >= 0 ? tail : pdf.length;
  const out = new Uint8Array(pdf.length + extra.length);
  out.set(pdf.subarray(0, cut), 0);
  out.set(extra, cut);
  out.set(pdf.subarray(cut), cut + extra.length);
  return out;
}

/** Lấy bản sao lưu từ PDF do app tạo; null nếu không có. */
export function extractBackup(pdf: Uint8Array): unknown | null {
  const b = indexOf(pdf, BEGIN), e = b >= 0 ? indexOf(pdf, END, b) : -1;
  if (b < 0 || e < 0) return null;
  let s = '';
  for (let i = b; i < e; i += 8192) s += String.fromCharCode(...pdf.subarray(i, Math.min(e, i + 8192)));
  const json = s.split('\n').filter((l) => l.startsWith(LINE)).map((l) => l.slice(LINE.length).replace(/\r$/, '')).join('');
  try { return JSON.parse(json); } catch { return null; }
}

export const isPdf = (b: Uint8Array) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // "%PDF"

function indexOf(h: Uint8Array, needle: string, from = 0): number {
  const n = needle.length, first = needle.charCodeAt(0);
  outer: for (let i = from; i <= h.length - n; i++) {
    if (h[i] !== first) continue;
    for (let j = 1; j < n; j++) if (h[i + j] !== needle.charCodeAt(j)) continue outer;
    return i;
  }
  return -1;
}
function lastIndexOf(h: Uint8Array, needle: string): number {
  const n = needle.length;
  outer: for (let i = h.length - n; i >= 0; i--) {
    for (let j = 0; j < n; j++) if (h[i + j] !== needle.charCodeAt(j)) continue outer;
    return i;
  }
  return -1;
}
