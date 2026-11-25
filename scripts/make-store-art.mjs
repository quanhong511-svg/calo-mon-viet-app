// Ảnh cho trang CH Play: icon 512×512 và ảnh bìa (feature graphic) 1024×500.
// Chạy: cd scripts && npm i --no-save sharp && node make-store-art.mjs ../store
import fs from 'fs';
import sharp from 'sharp';

const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const iconSvg = fs.readFileSync(new URL('../assets/icon-src/icon.svg', import.meta.url), 'utf8');

// Icon 512: Play yêu cầu PNG 32-bit, 512×512, tối đa 1 MB
await sharp(Buffer.from(iconSvg)).resize(512, 512).png().toFile(out + '/icon-512.png');

// Hình tô phở + vòng calo (cùng nét với icon), vẽ quanh tâm (512, 540) trong hệ 1024
const bowlArt = (() => {
  const C = 2 * Math.PI * 330;
  const steam = [432, 512, 592].map((x, i) =>
    `<path d="M${x},${452 - i % 2 * 14} c-34,-30 34,-52 0,-82 c-34,-30 34,-52 0,-82" fill="none" stroke="#fff" stroke-width="26" stroke-linecap="round" opacity=".92"/>`).join('');
  return `<circle cx="512" cy="540" r="330" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="44"/>
    <circle cx="512" cy="540" r="330" fill="none" stroke="#9be7c4" stroke-width="44" stroke-linecap="round" stroke-dasharray="${C * 0.74} ${C}" transform="rotate(-90 512 540)"/>
    ${steam}
    <path d="M318,504 H706 A194,176 0 0 1 318,504 Z" fill="#fff"/>
    <rect x="300" y="486" width="424" height="36" rx="18" fill="#fff"/>
    <rect x="448" y="664" width="128" height="34" rx="14" fill="#fff"/>
    <path d="M368,566 Q512,600 656,566" fill="none" stroke="#0f6b4f" stroke-opacity=".28" stroke-width="16" stroke-linecap="round"/>`;
})();

const font = `-apple-system, 'Helvetica Neue', Arial, sans-serif`;
const chip = (x, w, label) => `<g transform="translate(${x} 352)">
  <rect width="${w}" height="46" rx="23" fill="#ffffff" fill-opacity=".14" stroke="#ffffff" stroke-opacity=".28"/>
  <text x="${w / 2}" y="30" text-anchor="middle" font-family="${font}" font-size="20" font-weight="600" fill="#ffffff">${label}</text></g>`;

const feature = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16946b"/><stop offset="1" stop-color="#0a5640"/></linearGradient></defs>
  <rect width="1024" height="500" fill="url(#g)"/>
  <circle cx="860" cy="250" r="300" fill="#ffffff" fill-opacity=".05"/>
  <g transform="translate(860 262) scale(0.5) translate(-512 -540)">${bowlArt}</g>
  <text x="64" y="176" font-family="${font}" font-size="66" font-weight="800" fill="#ffffff">Calo Món Việt</text>
  <text x="66" y="236" font-family="${font}" font-size="30" font-weight="500" fill="#d6f5e8">Chụp món ăn, biết ngay bao nhiêu calo</text>
  <text x="66" y="280" font-family="${font}" font-size="24" fill="#b7e6d2">Phở, cơm tấm, bún chả… và hơn 70 món Việt</text>
  ${chip(64, 176, 'Nhận diện ảnh')}${chip(254, 186, 'Nhắc uống nước')}${chip(454, 150, 'Báo cáo PDF')}
</svg>`;
fs.writeFileSync(out + '/feature-1024x500.svg', feature);
await sharp(Buffer.from(feature)).flatten({ background: '#0f6b4f' }).removeAlpha().png().toFile(out + '/feature-1024x500.png');

// Icon cho trang chính sách quyền riêng tư
fs.mkdirSync(new URL('../docs/privacy/', import.meta.url), { recursive: true });
await sharp(Buffer.from(iconSvg)).resize(128, 128).png().toFile(decodeURIComponent(new URL('../docs/privacy/icon.png', import.meta.url).pathname));
console.log('ok');
