// Chạy lại khi muốn đổi icon: cd scripts && npm i --no-save sharp && node make-icons.mjs ../assets/images
// Tạo bộ icon Calo Món Việt: tô phở bốc khói nằm trong vòng calo (giống vòng tròn ở màn Hôm nay).
import fs from 'fs';
import sharp from 'sharp';

const out = process.argv[2];
const S = 1024;

// Hình vẽ trong hệ toạ độ 1024×1024, tâm (512, 540)
function art({ white = false } = {}) {
  const ink = '#ffffff';
  const C = 2 * Math.PI * 330;
  const track = white ? '' : `<circle cx="512" cy="540" r="330" fill="none" stroke="#ffffff" stroke-opacity=".16" stroke-width="44"/>`;
  const arc = `<circle cx="512" cy="540" r="330" fill="none" stroke="${white ? ink : '#9be7c4'}" stroke-width="44" stroke-linecap="round"
      stroke-dasharray="${C * 0.74} ${C}" transform="rotate(-90 512 540)"/>`;
  const steam = [432, 512, 592].map((x, i) =>
    `<path d="M${x},${452 - i % 2 * 14} c-34,-30 34,-52 0,-82 c-34,-30 34,-52 0,-82" fill="none" stroke="${ink}" stroke-width="26" stroke-linecap="round" opacity="${white ? 1 : 0.92}"/>`).join('');
  const bowl = `
    <path d="M318,504 H706 A194,176 0 0 1 318,504 Z" fill="${ink}"/>
    <rect x="300" y="486" width="424" height="36" rx="18" fill="${ink}"/>
    <rect x="448" y="664" width="128" height="34" rx="14" fill="${ink}"/>
    ${white ? '' : '<path d="M368,566 Q512,600 656,566" fill="none" stroke="#0f6b4f" stroke-opacity=".28" stroke-width="16" stroke-linecap="round"/>'}`;
  return track + arc + steam + bowl;
}

const bg = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#16946b"/><stop offset="1" stop-color="#0a5640"/></linearGradient></defs>
  <rect width="${S}" height="${S}" fill="url(#g)"/>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${body}</svg>`;
// thu nhỏ hình quanh tâm (Android chỉ hiển thị chắc chắn vùng giữa 66%)
const scaled = (body, k) => `<g transform="translate(512 512) scale(${k}) translate(-512 -540)">${body}</g>`;

const files = {
  'icon.png': [svg(bg + scaled(art(), 0.92)), 1024, true],
  'android-icon-foreground.png': [svg(scaled(art(), 0.66)), 512],
  'android-icon-background.png': [svg(bg), 512, true],
  'android-icon-monochrome.png': [svg(scaled(art({ white: true }), 0.66)), 432],
  'splash-icon.png': [svg(scaled(art(), 1)), 1024],
  'favicon.png': [svg(bg + scaled(art(), 0.92)), 48],
};
fs.writeFileSync(new URL('../assets/icon-src/icon.svg', import.meta.url), files['icon.png'][0]);
for (const [name, [s, size, opaque]] of Object.entries(files)) {
  let img = sharp(Buffer.from(s)).resize(size, size);
  if (opaque) img = img.flatten({ background: '#0f6b4f' }).removeAlpha(); // App Store không nhận icon có kênh trong suốt
  await img.png().toFile(out + '/' + name);
  console.log(name, size);
}
