// Các bộ nhận diện AI qua mạng (chép từ bản HTML; trên điện thoại không bị chặn CORS nên gọi thẳng được).
import { scaleItem, per100, type EditItem } from './core';
import { byId, DB } from './foods';
import type { Lang, Strings } from './i18n';

export type ProvId = 'device' | 'none' | 'gemini' | 'openrouter' | 'groq' | 'ollama';
type Prov = { label: keyof Strings; desc: keyof Strings; direct?: boolean; key?: boolean; local?: boolean; noText?: boolean; model?: string; url?: string; link?: string };
export const PROV: Record<ProvId, Prov> = {
  none: { label: 'p_none', desc: 'p_none_d' },
  device: { label: 'p_device', desc: 'p_device_d', local: true, noText: true },
  gemini: { label: 'p_gemini', desc: 'p_gemini_d', direct: true, key: true, model: 'gemini-3.1-flash-lite', link: 'https://aistudio.google.com/apikey' },
  openrouter: { label: 'p_openrouter', desc: 'p_openrouter_d', direct: true, key: true, model: 'google/gemma-3-27b-it:free', link: 'https://openrouter.ai/keys' },
  groq: { label: 'p_groq', desc: 'p_groq_d', direct: true, key: true, model: 'meta-llama/llama-4-scout-17b-16e-instruct', link: 'https://console.groq.com/keys' },
  ollama: { label: 'p_ollama', desc: 'p_ollama_d', direct: true, local: true, model: 'qwen2.5vl:7b', url: 'http://192.168.1.10:11434', link: 'https://ollama.com/download' },
};
export const SRC: Record<string, string> = { device: 'Offline', gemini: 'Gemini', openrouter: 'OpenRouter', groq: 'Groq', ollama: 'Ollama' };

export type ProvCfg = { key?: string; model?: string; url?: string };
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

async function openaiLike(t: Strings, url: string, model: string, key: string, prompt: string, img: Img | null, signal?: AbortSignal) {
  const content = img ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: img.dataUrl } }] : prompt;
  const j = await postJson(t, url, { model, temperature: 0.2, messages: [{ role: 'user', content }] }, { Authorization: 'Bearer ' + key }, signal);
  return j?.choices?.[0]?.message?.content;
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

/** Gọi bộ nhận diện đang chọn. onModel báo khi Gemini phải đổi sang model khác. */
export async function runAI(t: Strings, prov: ProvId, c: ProvCfg, prompt: string, img: Img | null, signal?: AbortSignal, onModel?: (m: string) => void): Promise<string | undefined> {
  if (prov === 'gemini') {
    const parts: any[] = [{ text: prompt }];
    if (img) parts.push({ inline_data: { mime_type: 'image/jpeg', data: img.b64 } });
    // Tắt chế độ "suy nghĩ" để trả lời nhanh; model không hỗ trợ thì gọi lại không kèm tuỳ chọn này
    let noThink = true;
    const call = async (m: string): Promise<any> => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`;
      const gen = { responseMimeType: 'application/json', temperature: 0.2, ...(noThink ? { thinkingConfig: { thinkingBudget: 0 } } : {}) };
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
  if (prov === 'openrouter') return openaiLike(t, 'https://openrouter.ai/api/v1/chat/completions', c.model || PROV.openrouter.model!, c.key || '', prompt, img, signal);
  if (prov === 'groq') return openaiLike(t, 'https://api.groq.com/openai/v1/chat/completions', c.model || PROV.groq.model!, c.key || '', prompt, img, signal);
  if (prov === 'ollama') {
    const base = (c.url || PROV.ollama.url!).replace(/\/$/, '');
    const msg: any = { role: 'user', content: prompt };
    if (img) msg.images = [img.b64];
    const j = await postJson(t, base + '/api/chat', { model: c.model || PROV.ollama.model, stream: false, format: 'json', messages: [msg], options: { temperature: 0.2 } }, {}, signal);
    return j?.message?.content;
  }
  throw { msg: 'no engine' } as AiError;
}
