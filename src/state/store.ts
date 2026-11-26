// Trạng thái toàn app + các thao tác (tương ứng phần JS của bản HTML).
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSyncExternalStore } from 'react';
import { Linking, Platform } from 'react-native';

import { advicePrompt } from '@/lib/advice';
import { decodeCard, encodeCard, MAX_FRIENDS, type FriendCard } from '@/lib/friend';
import { ADVICE_PROVS, itemsFromAI, parseJson, photoPrompt, PROV, runAI, SRC, textPrompt, type AiCfg, type AiError, type ProvId } from '@/lib/ai';
import { findMeal, guessMeal, mk, newData, pad, todayIso, toSaved, uid, addDays, type Data, type EditItem } from '@/lib/core';
import { STRINGS, type Lang, type Strings } from '@/lib/i18n';
import { parseText } from '@/lib/parse-text';
import { trendReportHtml } from '@/lib/report';
import { getFoodNet, modelUsable, prepPhoto, recognizeLocal, type Photo } from '@/lib/photo';
import { store } from '@/lib/storage';
import { coffeeCfgOf, type CoffeeCfg, type CoffeeKind } from '@/lib/coffee';
import { scheduleCoffee } from '@/lib/coffee-remind';
import { MEAL_REMIND_DEFAULT, mealTimesOf, scheduleMealRemind, type MealRemindCfg } from '@/lib/meal-remind';
import { ensurePermission, remindersSupported, scheduleWater, WATER_DEFAULT, type WaterCfg } from '@/lib/water';

export type SheetName = 'add' | 'text' | 'list' | 'ai' | 'review' | 'macros' | 'cheers' | 'advice' | 'friend' | 'art';
export type Advice = { busy: boolean; text: string | null; err: string | null; at: number | null; prov: string | null };
export type Alt = { id: string; p: number };
export type Review = {
  mealId: string | null; items: EditItem[]; servings: number; meal: number; photo: string | null; source?: string; note?: string; alts?: Alt[]; altSel?: string;
};
export type Tab = 'home' | 'progress' | 'settings';
type NetMeta = { acc?: { top1: number; top5: number } } | null;

type State = {
  lang: Lang; data: Data; viewDate: string; tab: Tab; sheet: SheetName | null; rv: Review | null; listTarget: 'review' | null;
  pending: { photo: string } | null; photo: Photo | null; cfg: AiCfg; prov: ProvId; aiMsg: string | null; gptOpen: boolean; local: Alt[] | null;
  toast: { msg: string; onTap?: () => void; id: number } | null; range: number; netMeta: NetMeta; busy: boolean;
  /** thu gọn thẻ So sánh 3 ngày (nhớ giữa các lần mở app) */
  cmpHidden: boolean;
  advice: Advice;
  /** biệt danh khi chia sẻ so sánh, và thẻ của bạn bè quét gần nhất */
  nick: string; friends: FriendCard[];
  /** ảnh chọn riêng để tạo ảnh filter (không gắn với bữa ăn) */
  artUri: string | null;
  /** kết quả "quét nhanh" cho ảnh filter (không lưu vào nhật ký) */
  artScan: { items: EditItem[]; busy: boolean; source: string | null };
  /** ngày hôm nay, đổi lúc qua nửa đêm (để màn hình vẽ lại) */
  today: string;
  /** giờ hiện tại (0–23), cập nhật mỗi phút để màn hình vẽ lại khi qua giờ */
  hour: number;
};

const deviceLang = (): Lang => {
  try { return (Intl.DateTimeFormat().resolvedOptions().locale || 'vi').startsWith('en') ? 'en' : 'vi'; } catch { return 'vi'; }
};
const cfg0 = store.get<AiCfg>('ai-cfg') || {};
/** Danh sách bạn bè đã quét (lưu dạng mã); đọc cả mã đơn lẻ của bản trước. */
function loadFriends(): FriendCard[] {
  const codes = store.get<string[]>('friends') || [store.get<string>('friend-last') || ''];
  return codes.map((x) => decodeCard(x || '')).filter((x): x is FriendCard => !!x);
}
let s: State = {
  lang: store.get<Lang>('lang') || deviceLang(),
  data: store.get<Data>('calo-data') || newData(),
  viewDate: todayIso(), tab: 'home', sheet: null, rv: null, listTarget: null, pending: null, photo: null,
  cfg: cfg0, prov: cfg0.prov && PROV[cfg0.prov] ? cfg0.prov : 'none', aiMsg: null, gptOpen: false, local: null,
  toast: null, range: [7, 14, 30, 90].includes(store.get<number>('range') || 0) ? store.get<number>('range')! : 7, netMeta: null, busy: false, cmpHidden: store.get<boolean>('cmp-hidden') === true,
  nick: store.get<string>('nick') || '', friends: loadFriends(), artUri: null, artScan: { items: [], busy: false, source: null },
  advice: { busy: false, err: null, text: null, at: null, prov: null, ...(store.get<Partial<Advice>>('advice-last') || {}) },
  today: todayIso(), hour: new Date().getHours(),
};

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export const get = () => s;
export function set(p: Partial<State>) { s = { ...s, ...p }; listeners.forEach((l) => l()); }
export const useApp = () => useSyncExternalStore(subscribe, get, get);
/** Chuỗi theo ngôn ngữ hiện tại — dùng trong hàm xử lý (ngoài render). */
export const tr = (): Strings => STRINGS[s.lang];
/** Trong component phải dùng hook này: React Compiler ghi nhớ kết quả tr() nên đổi ngôn ngữ sẽ không vẽ lại. */
export const useT = (): Strings => STRINGS[useApp().lang];

// ---------- dữ liệu ----------
/** Sửa dữ liệu trên một bản sao rồi lưu xuống máy. */
let waterTimer: ReturnType<typeof setTimeout> | undefined; // khai báo trước commit(), vì commit gọi rescheduleWater
export function commit(mut: (d: Data) => void): boolean {
  const d: Data = JSON.parse(JSON.stringify(s.data));
  mut(d);
  const ok = store.set('calo-data', d);
  set({ data: d });
  rescheduleWater(); // nội dung tổng kết bữa ăn hôm nay theo dữ liệu mới
  if (!ok) toast(tr().storeFull, undefined, 9000);
  return ok;
}
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string, onTap?: () => void, ms = 3200) {
  clearTimeout(toastTimer);
  set({ toast: { msg, onTap, id: Date.now() } });
  toastTimer = setTimeout(() => set({ toast: null }), ms);
}
export function setLang(l: Lang) { store.set('lang', l); set({ lang: l }); rescheduleWater(); }
export function setRange(r: number) { store.set('range', r); set({ range: r }); }
export function toggleCompare() { const v = !s.cmpHidden; store.set('cmp-hidden', v); set({ cmpHidden: v }); }
export function saveCfg(cfg: AiCfg) { store.set('ai-cfg', cfg); set({ cfg, prov: cfg.prov && PROV[cfg.prov] ? cfg.prov : s.prov }); }
export function setProv(p: ProvId) { saveCfg({ ...s.cfg, prov: p }); set({ prov: p }); }
export function setProvField(p: ProvId, k: 'key' | 'model', v: string) { saveCfg({ ...s.cfg, [p]: { ...(s.cfg[p] || {}), [k]: v } }); }
export function goTab(tab: Tab) { set({ tab }); }
export function shiftDay(n: number) { const d = addDays(s.viewDate, n); if (d > todayIso()) return; set({ viewDate: d }); }
export function openDay(d: string) { set({ viewDate: d, tab: 'home' }); }

// ---------- bảng trượt ----------
export function openSheet(sheet: SheetName) { set({ sheet }); }
export function closeSheet() { set({ sheet: null }); }
/** Người dùng đóng bảng: bỏ ảnh đang nhận diện; đóng danh sách khi đang sửa thì quay lại màn kiểm tra. */
export function dismissSheet() {
  if (s.sheet === 'ai') { set({ pending: null, gptOpen: false, aiMsg: null }); }
  if (s.sheet === 'list' && s.listTarget === 'review' && s.rv) { set({ sheet: 'review' }); return; }
  if (s.sheet === 'art') { const back = !s.artUri && s.rv; set({ sheet: back ? 'review' : null, artUri: null, artScan: { items: [], busy: false, source: null } }); return; }
  set({ sheet: null });
}
export function openReview(o: Partial<Review> & { items: EditItem[] }) {
  set({ rv: { mealId: null, note: '', servings: 1, meal: guessMeal(), photo: null, ...o }, listTarget: 'review', sheet: 'review' });
}
export function updateReview(p: Partial<Review>) { if (s.rv) set({ rv: { ...s.rv, ...p } }); }
export function openList(forReview: boolean) { set({ listTarget: forReview ? 'review' : null, sheet: 'list' }); }
export function addFromList(id: string) {
  const it = mk(id);
  if (s.listTarget === 'review' && s.rv) { set({ rv: { ...s.rv, items: [...s.rv.items, it] }, sheet: 'review' }); }
  else openReview({ items: [it], source: 'manual' });
}

export function saveReview() {
  checkDay();
  const rv = s.rv;
  if (!rv || !rv.items.length) return;
  const items = rv.items.map(toSaved);
  const ok = commit((d) => {
    if (rv.mealId) {
      const loc = findMeal(d, rv.mealId);
      if (loc) Object.assign(loc.m, { items, servings: rv.servings, meal: rv.meal, upd: Date.now() });
    } else {
      const now = new Date();
      d.started = true;
      (d.days[s.viewDate] ||= []).push({ id: uid(), meal: rv.meal, time: pad(now.getHours()) + ':' + pad(now.getMinutes()), source: rv.source || 'manual', servings: rv.servings, photo: rv.photo || null, items, upd: Date.now() });
    }
  });
  set({ sheet: null, rv: null, photo: null, tab: 'home' });
  if (ok) toast(tr().saved);
}
export function deleteReview() {
  const id = s.rv?.mealId;
  const ok = commit((d) => {
    const loc = findMeal(d, id);
    if (loc) { loc.arr.splice(loc.i, 1); if (!loc.arr.length) delete d.days[loc.d]; (d.deleted ||= {})[id!] = Date.now(); }
    d.started = true;
  });
  set({ sheet: null, rv: null });
  if (ok) toast(tr().deleted);
}

// ---------- ảnh ----------
let photoJob = 0;
let photoAc: AbortController | null = null;
export function cancelPhotoAI(quiet?: boolean) {
  photoJob++;
  photoAc?.abort(); photoAc = null;
  if (!quiet && s.pending) set({ pending: null });
}
export function autoReady(): 'ok' | 'none' | 'key' | 'na' {
  const P = PROV[s.prov], c = s.cfg[s.prov] || {};
  if (s.prov === 'none') return 'none';
  if (s.prov === 'device') return 'ok';
  if (P.key && !c.key) return 'key';
  return 'ok';
}

export async function pickPhoto(source: 'camera' | 'library') {
  const t = tr();
  let res: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { toast(t.camDenied, undefined, 6000); return; }
    res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  } else {
    res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
  }
  if (res.canceled || !res.assets?.[0]) return;
  cancelPhotoAI(true);
  set({ sheet: null, tab: 'home', viewDate: todayIso(), pending: { photo: res.assets[0].uri }, photo: null, gptOpen: false, aiMsg: null });
  let photo: Photo;
  try { photo = await prepPhoto(res.assets[0].uri); } catch { set({ pending: null }); toast(t.imgFail); return; }
  set({ photo, pending: { photo: photo.thumb } });
  if (autoReady() === 'ok') runPhotoAI();
  else openAiSheet();
}

export async function runPhotoAI() {
  cancelPhotoAI(true);
  const job = photoJob, ac = (photoAc = new AbortController()), t = tr(), prov = s.prov;
  if (!s.pending && s.photo) set({ pending: { photo: s.photo.thumb } });
  try {
    if (prov === 'device') {
      const top = await recognizeLocal(s.photo);
      if (job !== photoJob) return;
      photoAc = null;
      if (!top) throw { msg: t.noFood };
      finishLocal(top, top[0].id);
      return;
    }
    const res = parseJson(await runAI(t, prov, s.cfg[prov] || {}, photoPrompt(s.lang), s.photo, ac.signal, (m) => setProvField(prov, 'model', m)));
    if (job !== photoJob) return;
    photoAc = null;
    if (!res) throw { msg: t.badJson };
    finishPhoto(res, SRC[prov]);
  } catch (e) {
    if (job !== photoJob) return;
    photoAc = null;
    set({ pending: null });
    const err = e as AiError;
    if (err?.code === 'cancelled' || (e as Error)?.name === 'AbortError') return;
    openAiSheet(err?.msg || t.errNet);
  }
}
export function finishPhoto(res: any, source: string) {
  const items = itemsFromAI(res), thumb = s.photo?.thumb || null;
  set({ pending: null, gptOpen: false });
  if (!items.length) { openAiSheet(res?.note ? String(res.note) : tr().noFood); return; }
  openReview({ items, photo: thumb, source, note: res?.note ? String(res.note) : '' });
}
export function finishLocal(top: Alt[], pick: string) {
  const it = mk(pick);
  it.conf = top.find((x) => x.id === pick)?.p ?? null;
  set({ pending: null, gptOpen: false });
  openReview({ items: [it], photo: s.photo?.thumb || null, source: 'device', note: tr().localHint, alts: top, altSel: pick });
}
export function openAiSheet(msg?: string) {
  set({ sheet: 'ai', aiMsg: msg || null, local: null });
  const job = photoJob;
  // gợi ý trên máy chỉ hiện khi mô hình đủ chính xác
  (async () => {
    try {
      const net = await getFoodNet();
      set({ netMeta: net });
      if (!modelUsable(net)) return;
      const top = await recognizeLocal(s.photo);
      if (job === photoJob && s.sheet === 'ai' && top) set({ local: top });
    } catch {}
  })();
}

// ChatGPT miễn phí: sao chép câu lệnh, gửi ảnh qua bảng chia sẻ (hoặc mở chatgpt.com trên web)
export async function startGpt() {
  await Clipboard.setStringAsync(photoPrompt(s.lang));
  set({ gptOpen: true });
  const uri = s.photo?.uri;
  if (Platform.OS !== 'web' && uri && (await Sharing.isAvailableAsync())) {
    try { await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'ChatGPT' }); return; } catch {}
  }
  Linking.openURL('https://chatgpt.com/');
}
export async function recopyPrompt() { await Clipboard.setStringAsync(photoPrompt(s.lang)); toast(tr().promptCopied); }
/** Đọc câu trả lời ChatGPT; trả về false nếu chưa đọc được. */
export function readPasted(text: string): boolean {
  const res = parseJson(text);
  if (!res || !Array.isArray(res.items)) return false;
  finishPhoto(res, 'ChatGPT');
  return true;
}
export async function pasteFromClipboard() {
  const x = await Clipboard.getStringAsync();
  if (!x) { set({ aiMsg: tr().pasteEmpty }); return; }
  if (!readPasted(x)) set({ aiMsg: tr().badJson });
}
export function gemQuick(key: string) {
  if (!key.trim()) { set({ aiMsg: tr().needKey }); return; }
  saveCfg({ ...s.cfg, prov: 'gemini', gemini: { ...(s.cfg.gemini || {}), key: key.trim() } });
  set({ prov: 'gemini', sheet: null, gptOpen: false, aiMsg: null });
  runPhotoAI();
}
export function aiManual() {
  set({ pending: null, gptOpen: false });
  openReview({ items: [], photo: s.photo?.thumb || null, source: 'manual' });
  openList(true);
}

// ---------- mô tả bằng chữ ----------
export async function describe(txt: string): Promise<boolean> {
  txt = txt.trim();
  if (!txt) return false;
  const t = tr(), local = parseText(txt), P = PROV[s.prov];
  if (autoReady() === 'ok' && !P.noText && (local.miss.length || !local.items.length)) {
    set({ busy: true });
    try {
      const res = parseJson(await runAI(t, s.prov, s.cfg[s.prov] || {}, textPrompt(s.lang, txt), null));
      const items = itemsFromAI(res);
      if (items.length) { openReview({ items, source: SRC[s.prov], note: res?.note || '' }); return true; }
    } catch {} finally { set({ busy: false }); }
  }
  if (!local.items.length) { toast(t.miss + local.miss.join(', ')); return false; }
  openReview({ items: local.items, source: 'text', note: local.miss.length ? t.miss + local.miss.join(', ') : '' });
  return true;
}

// ---------- qua ngày & nhắc sao lưu ----------
let lastToday = todayIso();
export function checkDay() {
  const h = new Date().getHours();
  if (h !== s.hour) set({ hour: h });
  const td = todayIso();
  if (td === lastToday) return;
  set(s.viewDate === lastToday ? { viewDate: td, today: td } : { today: td });
  lastToday = td;
  rescheduleWater();
  backupNag();
}
export function backupNag() {
  const d = s.data;
  if (!d.started) return;
  const first = Object.keys(d.days).sort()[0];
  if (!first) return;
  const since = d.lastBackup ? d.lastBackup.slice(0, 10) : first;
  const days = Math.floor((new Date(todayIso() + 'T12:00:00').getTime() - new Date(since + 'T12:00:00').getTime()) / 864e5);
  if (days < 7 || d.nagDay === todayIso()) return;
  commit((x) => { x.nagDay = todayIso(); });
  toast(tr().backupNag(days), () => goTab('settings'), 8000);
}

// ---------- xuất báo cáo xu hướng ra PDF ----------
export async function exportTrendPdf(): Promise<void> {
  const t = tr(), html = trendReportHtml(s.data, t, s.lang, s.range, s.viewDate);
  set({ busy: true });
  try {
    if (Platform.OS === 'web') { await Print.printAsync({ html }); return; } // web: hộp thoại in → "Lưu thành PDF"
    const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842, margins: { left: 40, right: 40, top: 40, bottom: 46 } });
    const dest = new File(Paths.cache, `calo-mon-viet-xu-huong-${s.range}-ngay-${todayIso()}.pdf`);
    if (dest.exists) dest.delete();
    await new File(uri).move(dest);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(dest.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t.reportTitle });
    else await Print.printAsync({ uri: dest.uri });
  } catch {
    toast(tr().pdfFail);
  } finally { set({ busy: false }); }
}

// ---------- nước ----------
export const waterCfgOf = (d: Data): WaterCfg => ({ ...WATER_DEFAULT, ...(d.waterCfg || {}) });
/** Ngoài render. Trong component dùng waterCfgOf(data) để luôn vẽ lại khi cài đặt đổi. */
export const waterCfg = (): WaterCfg => waterCfgOf(s.data);
export const waterOn = (d: string) => s.data.water?.[d] || 0;

/** Dựng lại lịch nhắc uống nước và tổng kết bữa ăn (gộp nhiều lần gọi liên tiếp thành một). */
export function rescheduleWater(delay = 600) {
  if (!remindersSupported) return;
  clearTimeout(waterTimer);
  waterTimer = setTimeout(() => {
    // chạy lần lượt: mỗi hàm tự huỷ lịch cũ của mình rồi mới đặt lịch mới
    scheduleWater(waterCfg(), waterOn(todayIso()), tr(), s.lang).catch(() => {})
      .then(() => scheduleMealRemind(mealRemindOf(s.data), mealTimesOf(s.data), s.data, tr(), s.lang)).catch(() => {})
      .then(() => scheduleCoffee(coffeeCfgOf(s.data), s.data, tr())).catch(() => {});
  }, delay);
}
export function addWater(ml: number) {
  const day = s.viewDate, before = waterOn(day), goal = waterCfg().goal;
  const next = Math.max(0, Math.min(20000, before + ml));
  if (next === before) return;
  commit((d) => { (d.water ||= {})[day] = next; if (!next) delete d.water[day]; });
  if (ml > 0 && before < goal && next >= goal) toast(tr().waterDone);
  if (day === todayIso()) rescheduleWater();
}
export async function setWaterCfg(p: Partial<WaterCfg>) {
  if (p.on && !(await ensurePermission())) { toast(tr().waterDenied, undefined, 6000); p = { ...p, on: false }; }
  commit((d) => { d.waterCfg = { ...WATER_DEFAULT, ...(d.waterCfg || {}), ...p }; });
  rescheduleWater(0);
}

// ---------- tổng kết bữa ăn mỗi tối ----------
export const mealRemindOf = (d: Data): MealRemindCfg => ({ ...MEAL_REMIND_DEFAULT, ...(d.mealRemind || {}) });
export async function setMealRemind(p: Partial<MealRemindCfg>) {
  if (p.on && !(await ensurePermission())) { toast(tr().waterDenied, undefined, 6000); return; }
  commit((d) => { d.mealRemind = { ...MEAL_REMIND_DEFAULT, ...(d.mealRemind || {}), ...p }; });
  if (p.on) toast(tr().mrOnToast(mealRemindOf(s.data).at));
  rescheduleWater(0);
}

// ---------- mục tiêu đạm / tinh bột / béo ----------
export function setMacros(m: { p: number; c: number; f: number } | null) {
  commit((d) => { if (m) d.macros = { p: Math.round(m.p), c: Math.round(m.c), f: Math.round(m.f) }; else delete d.macros; });
}

// ---------- hẹn giờ nhắc từng bữa ----------
export async function setMealTime(i: number, p: Partial<{ on: boolean; at: number }>) {
  if (p.on && !(await ensurePermission())) { toast(tr().waterDenied, undefined, 6000); return; }
  commit((d) => { (d.mealTimes ||= {})[i] = { ...mealTimesOf(d)[i], ...p }; });
  rescheduleWater(0);
}

// ---------- cà phê ----------
export function addCoffee(kind: CoffeeKind, delta: 1 | -1) {
  const day = s.viewDate, cur = s.data.coffee?.[day]?.[kind] || 0;
  const next = Math.max(0, Math.min(20, cur + delta));
  if (next === cur) return;
  commit((d) => {
    const c = ((d.coffee ||= {})[day] ||= {});
    if (next) c[kind] = next; else delete c[kind];
    if (!Object.keys(c).length) delete d.coffee![day];
    if (delta > 0 && day === todayIso()) d.coffeeLast = Date.now();
  });
}
export async function setCoffeeCfg(p: Partial<CoffeeCfg>) {
  if (p.on && !(await ensurePermission())) { toast(tr().waterDenied, undefined, 6000); return; }
  commit((d) => { d.coffeeCfg = { ...coffeeCfgOf(d), ...p }; });
  rescheduleWater(0);
}

// ---------- tư vấn dinh dưỡng bằng AI ----------
/** Dịch vụ dùng cho tư vấn: ưu tiên dịch vụ đang chọn, nếu không thì dịch vụ đầu tiên đã có khoá. */
export function adviceProv(st: { prov: ProvId; cfg: AiCfg } = s): ProvId | null {
  if (ADVICE_PROVS.includes(st.prov) && st.cfg[st.prov]?.key) return st.prov;
  return ADVICE_PROVS.find((p) => st.cfg[p]?.key) || null;
}
let adviceAc: AbortController | null = null;
export async function askAdvice() {
  const prov = adviceProv();
  if (!prov || s.advice.busy) return;
  const t = tr();
  adviceAc = new AbortController();
  set({ advice: { ...s.advice, busy: true, err: null } });
  try {
    const txt = (await runAI(t, prov, s.cfg[prov] || {}, advicePrompt(s.data, s.today, t, s.lang), null, adviceAc.signal, undefined, 'text'))?.trim();
    if (!txt) throw { msg: t.errNet };
    const next: Advice = { busy: false, err: null, text: txt, at: Date.now(), prov: SRC[prov] };
    store.set('advice-last', { text: next.text, at: next.at, prov: next.prov });
    set({ advice: next });
  } catch (e: any) {
    set({ advice: { ...s.advice, busy: false, err: e?.code === 'cancelled' ? null : e?.msg || t.errNet } });
  } finally { adviceAc = null; }
}
export function cancelAdvice() { adviceAc?.abort(); }

// ---------- so sánh với bạn bè qua mã QR ----------
export function setNick(n: string) { store.set('nick', n); set({ nick: n }); }
const saveFriends = (list: FriendCard[]) => { store.set('friends', list.map(encodeCard)); set({ friends: list }); };
const sameNick = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** Nhận mã của bạn bè (từ QR hoặc tin nhắn): cùng biệt danh thì thay thẻ cũ. Trả về thẻ, hoặc null nếu mã không hợp lệ. */
export function setFriendCode(text: string): FriendCard | null {
  const card = decodeCard(text);
  if (!card) return null;
  saveFriends([...s.friends.filter((f) => !sameNick(f.n, card.n)), card].slice(-MAX_FRIENDS));
  return card;
}
export function removeFriend(n: string) { saveFriends(s.friends.filter((f) => !sameNick(f.n, n))); }

// ---------- ảnh filter & hashtag từ thư viện ----------
export async function openArtFromLibrary() {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (res.canceled || !res.assets?.[0]) return;
  set({ artUri: res.assets[0].uri, sheet: 'art', artScan: { items: [], busy: false, source: null } });
}
/** Quét nhanh chỉ số cho ảnh filter: dùng AI đang chọn với ảnh; không có AI thì tra tên món trong bảng (offline). */
export async function artQuickScan(uri: string, dish: string) {
  const t = tr();
  if (s.artScan.busy) return;
  set({ artScan: { ...s.artScan, busy: true } });
  let items: EditItem[] = [], source: string | null = null;
  try {
    const ai = autoReady() === 'ok' && s.prov !== 'device' && s.prov !== 'none';
    if (ai) {
      const photo = await prepPhoto(uri);
      const res = parseJson(await runAI(t, s.prov, s.cfg[s.prov] || {}, photoPrompt(s.lang), photo, undefined, (m) => setProvField(s.prov, 'model', m)));
      items = itemsFromAI(res); source = SRC[s.prov];
    }
  } catch (e) { toast((e as AiError)?.msg || t.errNet); }
  if (!items.length && dish.trim()) { items = parseText(dish).items; source = items.length ? 'offline' : null; }
  if (!items.length) toast(t.arScanNone, undefined, 6000);
  set({ artScan: { items, busy: false, source } });
}
