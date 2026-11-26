// Các dịch vụ AI qua mạng: Google Gemini, Anthropic Claude, OpenAI ChatGPT (người dùng tự nhập khoá API).
import { scaleItem, per100, type EditItem } from './core';
import { byId, DB } from './foods';
import type { Lang, Strings } from './i18n';

export type ProvId = 'device' | 'none' | 'gemini' | 'claude' | 'openai';
type Prov = { label: keyof Strings; desc: keyof Strings; direct?: boolean; key?: boolean; local?: boolean; noText?: boolean; model?: string; link?: string };
export const PROV: Record<ProvId, Prov> = {
  none: { label: 'p_none', desc: 'p_none_d' },
  device: { label: 'p_device', desc: 'p_device_d', local: true, noText: true },
  gemini: { label: 'p_gemini', desc: 'p_gemini_d', direct: true, key: true, model: 'gemini-3.1-flash-lite', link: 'https://aistudio.google.com/apikey' },
  claude: { label: 'p_claude', desc: 'p_claude_d', direct: true, key: true, model: 'claude-opus-5-5', link: 'https://platform.claude.com/settings/keys' },
  openai: { label: 'p_openai', desc: 'p_openai_d', direct: true, key: true, model: 'gpt-5-mini', link: 'https://platform.openai.com/api-keys' },
};
export const SRC: Record<string, string> = { device: 'Offline', gemini: 'Gemini', claude: 'Claude', openai: 'ChatGPT' };
/** Các dịch vụ dùng được cho tư vấn dinh dưỡng (cần khoá API). */
export const ADVICE_PROVS: ProvId[] = ['gemini', 'claude', 'openai'];

export type ProvCfg = { key?: string; model?: string };
export type AiCfg = { prov?: ProvId } & Partial<Record<ProvId, ProvCfg>>;
export type Img = { dataUrl: string; b64: string };
export type AiError = { msg?: string; code?: 'cancelled' };

const menuText = () => DB.map((d) => `${d.id} | ${d.vi} | ${d.en} | ${d.g} g`).join('\n');
const JSON_SHAPE = `{"items":[{"id":"pho-bo","name":"Phở bò","grams":520,"confidence":0.85,"kcal_100g":null,"protein_100g":null,"carb_100g":null,"fat_100g":null,"note":"large bowl"}],"note":"short remark"}`;

export function photoPrompt(lang: Lang) {
  return `You are a nutrition expert familiar with Vietnamese food. The attached photo shows a meal.
List each dish/component you can see and estimate the weight in grams actually present. Use bowls, plates, chopsticks and spoons for scale.
Match each item to an id from the table when possible. If nothing matches, set id to null, give a name and estimate nutrition per 100 g.
If the photo is not food, return an empty items array and explain in note. Write "name" and "note" in ${lang === 'en' ? 'English' : 'Vietnamese'}.

Table (id | Vietnamese | English | standard serving):
${menuText()}

Reply with ONLY this JSON, no other text:
${JSON_SHAPE}`;
}
export function textPrompt(lang: Lang, txt: string) {
  return `You are a nutrition expert familiar with Vietnamese food. The user describes what they ate: """${txt.slice(0, 600)}"""
List each dish with its weight in grams (use typical Vietnamese street-food portions when no size is given; respect quantities like "2 cái", "1 tô lớn").
Match each item to an id from the table when possible; otherwise set id null and estimate nutrition per 100 g. Write "name" and "note" in ${lang === 'en' ? 'English' : 'Vietnamese'}.

Table (id | Vietnamese | English | standard serving):
${menuText()}

Reply with ONLY this JSON, no other text:
${JSON_SHAPE}`;
}

export function parseJson(x: unknown): any {
  if (x && typeof x === 'object') return x;
  const s = String(x || '');
  try { return JSON.parse(s); } catch {}
  const f = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (f) { try { return JSON.parse(f[1]); } catch {} }
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch {} }
  return null;
}

export function itemsFromAI(res: any): EditItem[] {
  const out: EditItem[] = [];
  for (const r of Array.isArray(res?.items) ? res.items : []) {
    const g = Math.max(0, Number(r.grams) || 0);
    if (!g) continue;
    const d = r.id && byId[r.id];
    let it: EditItem;
    if (d) it = { id: d.id, name: d.vi, grams: g, per100: per100(d), conf: null, kcal: 0, p: 0, c: 0, f: 0 };
    else {
      const k = Number(r.kcal_100g);
      if (!isFinite(k) || k <= 0) continue;
      it = { id: null, name: String(r.name || '?').slice(0, 60), grams: g, conf: null, kcal: 0, p: 0, c: 0, f: 0,
        per100: { kcal: k, p: Number(r.protein_100g) || 0, c: Number(r.carb_100g) || 0, f: Number(r.fat_100g) || 0 } };
    }
    it.conf = Math.min(1, Math.max(0, Number(r.confidence) || 0.5));
    it.note = r.note ? String(r.note).slice(0, 120) : '';
    out.push(scaleItem(it));
  }
  return out;
}

async function postJson(t: Strings, url: string, body: unknown, headers: Record<string, string>, signal?: AbortSignal) {
  let r: Response;
  try {
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw { code: 'cancelled' } as AiError;
    throw { msg: t.errNet } as AiError;
  }
  const j = await r.json().catch(() => null);
  if (!r.ok) throw { msg: t.errHttp(r.status, j?.error?.message || (typeof j?.error === 'string' ? j.error : '')) } as AiError;
  return j;
}

async function openai(t: Strings, model: string, key: string, prompt: string, img: Img | null, mode: Mode, signal?: AbortSignal) {
  const content = img ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: img.dataUrl } }] : prompt;
  // không gửi temperature: các model GPT-5 chỉ nhận giá trị mặc định
  const body = { model, messages: [{ role: 'user', content }], ...(mode === 'json' ? { response_format: { type: 'json_object' } } : {}) };
  const j = await postJson(t, 'https://api.openai.com/v1/chat/completions', body, { Authorization: 'Bearer ' + key }, signal);
  return j?.choices?.[0]?.message?.content;
}

async function claude(t: Strings, model: string, key: string, prompt: string, img: Img | null, mode: Mode, signal?: AbortSignal) {
  // Gọi thẳng Messages API (SDK @anthropic-ai/sdk lỗi khởi tạo vòng import khi đóng gói bằng Metro).
  const content: any[] = [];
  if (img) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img.b64 } });
  content.push({ type: 'text', text: prompt });
  const body = {
    model, max_tokens: 16000,
    // bị từ chối vì chính sách thì máy chủ tự chạy lại trên model dự phòng
    fallbacks: 'default',
    output_config: { effort: mode === 'json' ? 'low' : 'medium' },
    messages: [{ role: 'user', content }],
  };
  const j = await postJson(t, 'https://api.anthropic.com/v1/messages', body, {
    'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01',
    // khoá của chính người dùng, lưu trên máy họ; cần cho bản web gọi thẳng từ trình duyệt
    'anthropic-dangerous-direct-browser-access': 'true',
  }, signal);
  if (j?.stop_reason === 'refusal') throw { msg: t.errRefusal } as AiError;
  return (j?.content || []).map((b: any) => (b.type === 'text' ? b.text : '')).join('');
}

const verOf = (n: string) => {
  const m = n.match(/gemini-(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) - (/lite/.test(n) ? 0.01 : 0) - (/preview|exp/.test(n) ? 0.005 : 0) : 0;
};
async function listGemini(key: string, signal?: AbortSignal): Promise<string[]> {
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key }, signal });
    const j = await r.json();
    return (j.models || [])
      .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent') && /flash/.test(m.name) && !/(tts|image|live|audio|embed|thinking)/.test(m.name))
      .map((m: any) => m.name.replace(/^models\//, ''))
      .sort((a: string, b: string) => verOf(b) - verOf(a));
  } catch { return []; }
}

type Mode = 'json' | 'text';
/** Gọi dịch vụ AI đang chọn. mode 'json' cho nhận diện món, 'text' cho tư vấn. onModel báo khi Gemini phải đổi sang model khác. */
export async function runAI(t: Strings, prov: ProvId, c: ProvCfg, prompt: string, img: Img | null, signal?: AbortSignal, onModel?: (m: string) => void, mode: Mode = 'json'): Promise<string | undefined> {
  if (prov === 'gemini') {
    const parts: any[] = [{ text: prompt }];
    if (img) parts.push({ inline_data: { mime_type: 'image/jpeg', data: img.b64 } });
    // Tắt chế độ "suy nghĩ" để trả lời nhanh; model không hỗ trợ thì gọi lại không kèm tuỳ chọn này
    let noThink = true;
    const call = async (m: string): Promise<any> => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`;
      const gen = { ...(mode === 'json' ? { responseMimeType: 'application/json', temperature: 0.2 } : { temperature: 0.6 }), ...(noThink ? { thinkingConfig: { thinkingBudget: 0 } } : {}) };
      try { return await postJson(t, url, { contents: [{ parts }], generationConfig: gen }, { 'x-goog-api-key': c.key || '' }, signal); }
      catch (e: any) {
        if (noThink && /\(400\)/.test(e?.msg || '') && /think/i.test(e?.msg || '')) { noThink = false; return call(m); }
        throw e;
      }
    };
    const modelErr = (e: AiError) => /\((404|400)\)/.test(e?.msg || '') && /model/i.test(e?.msg || '');
    // Quá tải / hết lượt của riêng model đó: thử model khác nhưng không đổi model đã lưu
    const busyErr = (e: AiError) => /\((429|500|503)\)/.test(e?.msg || '');
    const first = c.model || PROV.gemini.model!;
    let j: any;
    try { j = await call(first); } catch (e: any) {
      if (!modelErr(e) && !busyErr(e)) throw e;
      const persist = modelErr(e);
      // Thử model Google gợi ý, các model nhanh quen thuộc, rồi model "flash" mới nhất mà key dùng được
      const sug = ((e.msg as string).match(/models\/(gemini-[\w.\-]+)/g) || []).map((x) => x.slice(7));
      const fast = ['gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest'];
      const cands = [...sug, ...fast, ...(await listGemini(c.key || '', signal))].filter((x, i, a) => x !== first && a.indexOf(x) === i);
      let ok = false;
      for (const m2 of cands.slice(0, 6)) {
        try { j = await call(m2); if (persist) onModel?.(m2); ok = true; break; } catch (e2: any) { if (!modelErr(e2) && !busyErr(e2)) throw e2; }
      }
      if (!ok) throw e;
    }
    return j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('');
  }
  if (prov === 'claude') return claude(t, c.model || PROV.claude.model!, c.key || '', prompt, img, mode, signal);
  if (prov === 'openai') return openai(t, c.model || PROV.openai.model!, c.key || '', prompt, img, mode, signal);
  throw { msg: 'no engine' } as AiError;
}
