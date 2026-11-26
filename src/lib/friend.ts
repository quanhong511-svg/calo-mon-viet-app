// So sánh với bạn bè qua mã QR: đóng gói biệt danh + tóm tắt 3 ngày gần nhất thành một chuỗi ngắn.
// Không có món ăn chi tiết, không có ảnh; dữ liệu chỉ đi từ máy này sang máy kia khi người dùng tự chia sẻ.
import { scoreDay } from './compare';
import { addDays, type Data } from './core';

export type FriendDay = { d: string; k: number; t: number; p: number; c: number; f: number; w: number; s: number; m: number };
export type FriendCard = { v: 1; n: string; at: string; days: FriendDay[] };

const PREFIX = 'CMV1.';
const DAYS = 3;
export const NICK_MAX = 20;

export function myCard(data: Data, today: string, nick: string): FriendCard {
  const days = [];
  for (let k = DAYS - 1; k >= 0; k--) {
    const d = addDays(today, -k), s = scoreDay(data, d);
    days.push({
      d, k: Math.round(s.tot.k), t: Math.round(s.tgt), p: Math.round(s.tot.p), c: Math.round(s.tot.c), f: Math.round(s.tot.f),
      w: data.water?.[d] || 0, s: s.score, m: s.main.filter(Boolean).length,
    });
  }
  return { v: 1, n: nick.trim().slice(0, NICK_MAX), at: today, days };
}

// JSON chỉ gồm ký tự ASCII (tên tiếng Việt đổi thành \uXXXX) để mã QR gọn và dán qua Zalo không bị lỗi
const ascii = (s: string) => s.replace(/[\u007f-￿]/g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
export const encodeCard = (c: FriendCard) => PREFIX + ascii(JSON.stringify([c.v, c.n, c.at, c.days.map((x) => [x.d, x.k, x.t, x.p, x.c, x.f, x.w, x.s, x.m])]));

const num = (x: unknown, max: number) => { const n = Math.round(Number(x)); return n >= 0 && n <= max ? n : 0; };

/** Đọc mã từ QR hoặc từ đoạn tin nhắn có chứa mã; null nếu không hợp lệ. */
export function decodeCard(text: string): FriendCard | null {
  const i = text.indexOf(PREFIX);
  if (i < 0) return null;
  const rest = text.slice(i + PREFIX.length), end = rest.lastIndexOf(']');
  if (end < 0) return null;
  try {
    const a = JSON.parse(rest.slice(0, end + 1));
    if (!Array.isArray(a) || a[0] !== 1 || !Array.isArray(a[3]) || a[3].length !== DAYS) return null;
    const days: FriendDay[] = a[3].map((x: unknown[]) => ({
      d: /^\d{4}-\d{2}-\d{2}$/.test(String(x[0])) ? String(x[0]) : '', k: num(x[1], 20000), t: num(x[2], 5000) || 2000,
      p: num(x[3], 2000), c: num(x[4], 3000), f: num(x[5], 2000), w: num(x[6], 20000), s: num(x[7], 100), m: num(x[8], 3),
    }));
    if (days.some((x) => !x.d)) return null;
    return { v: 1, n: String(a[1] || '?').slice(0, NICK_MAX), at: /^\d{4}-\d{2}-\d{2}$/.test(String(a[2])) ? String(a[2]) : days[DAYS - 1].d, days };
  } catch { return null; }
}

/** Tổng điểm 3 ngày (chỉ tính ngày có ghi) và các chỉ số trung bình. */
export function cardStats(c: FriendCard) {
  const logged = c.days.filter((x) => x.k > 0);
  const n = logged.length || 1;
  return {
    total: c.days.reduce((s, x) => s + x.s, 0),
    logged: logged.length,
    avgK: logged.reduce((s, x) => s + x.k, 0) / n,
    avgPct: logged.reduce((s, x) => s + x.k / x.t, 0) / n,
    avgP: logged.reduce((s, x) => s + x.p, 0) / n,
    avgW: c.days.reduce((s, x) => s + x.w, 0) / DAYS,
    fullDays: c.days.filter((x) => x.m === 3).length,
  };
}
