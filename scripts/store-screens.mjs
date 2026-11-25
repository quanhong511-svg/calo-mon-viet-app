// Chụp ảnh màn hình cho trang CH Play từ bản web của app (dữ liệu mẫu 14 ngày).
// Cần: `npx expo start --web --port 8092` đang chạy, Google Chrome đã cài.
// Chạy: npm i --no-save puppeteer-core && node scripts/store-screens.mjs store/screens
import fs from 'fs';
import puppeteer from 'puppeteer-core';

const out = process.argv[2] || 'store/screens';
const URL0 = process.env.APP_URL || 'http://localhost:8092';
fs.mkdirSync(out, { recursive: true });

// --- dữ liệu mẫu ---
const FOOD = {
  'pho-bo': [500, 450, 25, 55, 12], 'ca-phe-sua': [200, 120, 2, 20, 4], 'com-tam': [400, 650, 30, 80, 22],
  'bun-cha': [450, 550, 25, 65, 20], 'banh-mi': [200, 450, 18, 50, 18], 'goi-cuon': [150, 180, 10, 25, 4],
  'canh-chua': [300, 120, 10, 10, 4], 'com-trang': [150, 195, 4, 43, 0.4], 'ca-kho': [150, 250, 25, 8, 13],
  'rau-muong': [150, 110, 4, 8, 7], 'tra-sua': [500, 350, 3, 55, 12], 'bun-bo-hue': [550, 500, 28, 60, 15],
  'xoi-xeo': [250, 480, 12, 75, 14], 'chuoi': [120, 105, 1, 27, 0.4], 'thit-kho-trung': [200, 420, 26, 8, 30],
};
const NAME = { 'pho-bo': 'Phở bò', 'ca-phe-sua': 'Cà phê sữa đá', 'com-tam': 'Cơm tấm sườn', 'bun-cha': 'Bún chả', 'banh-mi': 'Bánh mì thịt', 'goi-cuon': 'Gỏi cuốn', 'canh-chua': 'Canh chua cá', 'com-trang': 'Cơm trắng', 'ca-kho': 'Cá kho tộ', 'rau-muong': 'Rau muống xào tỏi', 'tra-sua': 'Trà sữa trân châu', 'bun-bo-hue': 'Bún bò Huế', 'xoi-xeo': 'Xôi xéo', 'chuoi': 'Chuối', 'thit-kho-trung': 'Thịt kho trứng' };
const item = (id, k = 1) => { const [g, kcal, p, c, f] = FOOD[id]; return { id, name: NAME[id], grams: Math.round(g * k), kcal: +(kcal * k).toFixed(1), p: +(p * k).toFixed(1), c: +(c * k).toFixed(1), f: +(f * k).toFixed(1) }; };
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const PLANS = [
  [[0, '07:10', ['banh-mi', 'ca-phe-sua']], [1, '12:15', ['com-tam']], [2, '19:00', ['canh-chua', 'com-trang', 'ca-kho', 'rau-muong']]],
  [[0, '07:30', ['pho-bo']], [1, '12:00', ['bun-cha', 'goi-cuon']], [3, '15:30', ['tra-sua']], [2, '19:20', ['com-trang', 'thit-kho-trung', 'rau-muong']]],
  [[0, '06:50', ['xoi-xeo']], [1, '11:45', ['bun-bo-hue']], [3, '16:00', ['chuoi']], [2, '18:45', ['canh-chua', 'com-trang', 'ca-kho']]],
];
const days = {}, water = {}, now = new Date();
for (let k = 13; k >= 0; k--) {
  const d = new Date(now); d.setDate(d.getDate() - k);
  const key = iso(d), plan = PLANS[k % 3];
  const meals = plan.slice(0, k === 0 ? 2 : plan.length).map(([meal, time, ids], i) => ({
    id: `demo-${key}-${i}`, meal, time, servings: 1, photo: null, upd: 1,
    source: i === 1 ? 'Gemini' : 'manual', items: ids.map((id) => item(id, 0.9 + ((k * 7 + i * 3) % 5) / 20)),
  }));
  days[key] = meals;
  water[key] = k === 0 ? 1250 : 1500 + ((k * 370) % 900);
}
const data = { v: 1, target: 2000, days, started: true, water, waterCfg: { goal: 2000, on: true, every: 120, from: 8, to: 21 }, lastBackup: iso(now) };

// --- chụp ---
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--hide-scrollbars'],
});
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
await page.setViewport({ width: 360, height: 720, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); // 1080×2160 (tỉ lệ 2:1, đúng giới hạn của Play)
await page.goto(URL0, { waitUntil: 'networkidle0' });
await page.evaluate((d) => {
  localStorage.clear();
  localStorage.setItem('calo-data', JSON.stringify(d));
  localStorage.setItem('lang', JSON.stringify('vi'));
  localStorage.setItem('range', JSON.stringify(14));
  localStorage.setItem('ai-cfg', JSON.stringify({ prov: 'gemini', gemini: { model: 'gemini-3.1-flash-lite' } }));
}, data);
await page.reload({ waitUntil: 'networkidle0' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = async (txt) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('div,span,button,a')].reverse().find((e) => e.textContent?.trim() === t && e.offsetParent);
    if (!el) return false; el.click(); return true;
  }, txt);
  if (!ok) throw new Error('Không thấy: ' + txt);
  await sleep(600);
};
const shot = async (name) => { await sleep(500); await page.screenshot({ path: `${out}/${name}.png` }); console.log(name); };
const scrollMain = async (y) => { await page.mouse.move(180, 360); await page.mouse.wheel({ deltaY: y }); await sleep(700); };
const scrollToText = async (txt) => { await page.evaluate((t) => { const el = [...document.querySelectorAll('div')].reverse().find((e) => e.textContent?.trim() === t); el?.scrollIntoView({ block: 'start' }); }, txt); await sleep(700); };

await shot('1-hom-nay');
await scrollMain(520);
await shot('2-bua-an-va-nuoc');
await clickText('Tiến độ');
await shot('3-tien-do');
await clickText('Cài đặt');
await scrollToText('Nhận diện ảnh tự động');
await shot('4-cai-dat');
await browser.close();
