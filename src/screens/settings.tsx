import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Linking, Platform, Pressable, TextInput, View } from 'react-native';

import { PROV, type ProvCfg, type ProvId } from '@/lib/ai';
import { backup, fmtDate, mergeBackup, toCsv, toText, validTarget } from '@/lib/backup';
import { setTarget, todayIso, pad } from '@/lib/core';
import { getFoodNet } from '@/lib/photo';
import { commit, get, mealRemindOf, saveCfg, set, setLang, setMealRemind, setProv, setWaterCfg, toast, useApp, useT, waterCfg, waterCfgOf } from '@/state/store';
import { remindersSupported, slots } from '@/lib/water';
import { Btn, Card, Icon, inputStyle, Note, Row, Seg, T } from '@/ui/kit';
import { useColors } from '@/ui/theme';

/** Tạo file rồi mở bảng chia sẻ (lưu vào Tệp, Drive, Zalo…). Web: tải file xuống. */
async function shareFile(name: string, content: string, mime: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    return true;
  }
  if (!(await Sharing.isAvailableAsync())) return false;
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  await f.write(content);
  await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: name });
  return true;
}

async function readPicked(uri: string): Promise<string> {
  if (Platform.OS === 'web') return (await fetch(uri)).text();
  return new File(uri).text();
}

export default function Settings() {
  const { data, lang, prov, cfg, netMeta, viewDate } = useApp();
  const t = useT(), c = useColors();
  const [scope, setScope] = useState<'day' | 'all'>('day');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const P = PROV[prov], pc = cfg[prov] || {};
  // key/model/url chỉ được lưu khi bấm "Lưu"; đổi bộ nhận diện thì nạp lại bản đang lưu
  const [draft, setDraft] = useState<ProvCfg>(pc);
  const [draftProv, setDraftProv] = useState(prov);
  if (draftProv !== prov) { setDraftProv(prov); setDraft(pc); }
  const FIELDS = ['key', 'model', 'url'] as const;
  const dirty = FIELDS.some((k) => draft[k] !== undefined && draft[k] !== (pc[k] ?? ''));
  const saveAi = () => {
    const next: ProvCfg = { ...pc };
    for (const k of FIELDS) if (draft[k] !== undefined) next[k] = draft[k]!.trim();
    saveCfg({ ...cfg, [prov]: next });
    setDraft(next);
    Keyboard.dismiss();
    toast(t.aiSaved);
  };
  useEffect(() => { if (prov === 'device' && !netMeta) getFoodNet().then((n) => set({ netMeta: n })).catch(() => {}); }, [prov, netMeta]);

  const applyTarget = (txt: string) => {
    const v = validTarget(txt);
    if (v && v !== get().data.target) commit((d) => setTarget(d, v));
  };
  const stamp = () => { const n = new Date(); return `${todayIso()}-${pad(n.getHours())}${pad(n.getMinutes())}`; };
  const run = async (fn: () => Promise<boolean>, mark?: boolean) => {
    try {
      const ok = await fn();
      setMsg({ text: ok ? t.dlOk : t.dlFail, ok });
      if (ok && mark) commit((d) => { d.lastBackup = new Date().toISOString(); });
    } catch { setMsg({ text: t.dlFail, ok: false }); }
  };
  const doImport = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return;
    let j: any;
    try { j = JSON.parse(await readPicked(r.assets[0].uri)); } catch { setMsg({ text: t.badFile, ok: false }); return; }
    const wasStarted = get().data.started;
    let res: [number, number] = [0, 0];
    try {
      commit((d) => {
        res = mergeBackup(d, j);
        if (!wasStarted && validTarget(j.target)) d.target = validTarget(j.target)!; // không đè mục tiêu người dùng đang dùng
      });
    } catch { setMsg({ text: t.badFile, ok: false }); return; }
    setMsg({ text: t.imported(res[0], res[1]), ok: true });
  };
  const field = (k: 'key' | 'model' | 'url', label: string, def?: string, secret?: boolean) => (
    <View style={{ gap: 4 }}>
      <T small>{label}</T>
      <TextInput style={inputStyle(c)} value={draft[k] ?? def ?? ''} onChangeText={(v) => setDraft((d) => ({ ...d, [k]: v }))}
        secureTextEntry={secret} autoCapitalize="none" autoCorrect={false} placeholderTextColor={c.muted}
        returnKeyType="done" onSubmitEditing={() => dirty && saveAi()} accessibilityLabel={label} />
    </View>
  );

  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 12 }}>
        <T h={2}>{t.setGoal}</T>
        <Row between><T style={{ flex: 1 }}>{t.target}</T>
          <NumInput value={data.target} onCommit={applyTarget} label={t.target} />
        </Row>
        <Row between><T>{t.language}</T>
          <Seg items={[{ v: 'vi', label: 'Tiếng Việt' }, { v: 'en', label: 'English' }]} value={lang} onChange={setLang} />
        </Row>
        <T small muted>{t.split}</T>
      </Card>

      <WaterSettings />
      <MealRemindSettings />

      <Card style={{ gap: 12 }}>
        <T h={2}>{t.aiTitle}</T>
        <T small>{t.aiEngine}</T>
        <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, overflow: 'hidden' }}>
          {(Object.keys(PROV) as ProvId[]).map((k, i) => (
            <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: k === prov }} onPress={() => setProv(k)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: i ? 1 : 0, borderColor: c.line, backgroundColor: k === prov ? c.accentSoft : 'transparent' }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: k === prov ? c.accent : c.muted, alignItems: 'center', justifyContent: 'center' }}>
                {k === prov && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }} />}
              </View>
              <T style={{ flex: 1 }}>{t[PROV[k].label] as string}</T>
            </Pressable>
          ))}
        </View>
        <View style={{ gap: 10, padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 12, backgroundColor: c.bg }}>
          <T small muted>{t[P.desc] as string}</T>
          {prov === 'device' && netMeta?.acc && <T small muted>{t.p_device_acc(Math.round(netMeta.acc.top1 * 100), Math.round(netMeta.acc.top5 * 100))}</T>}
          {prov === 'device' && netMeta?.acc && netMeta.acc.top1 < 0.3 && <Note>{t.p_device_weak}</Note>}
          {P.direct && (
            <>
              {P.key && field('key', t.key, '', true)}
              {P.local && field('url', t.url, P.url)}
              {field('model', t.model, P.model)}
              <Btn label={dirty ? t.aiSave : t.aiSavedBtn} kind="pri" full disabled={!dirty} onPress={saveAi} />
              <Row>
                <Pressable onPress={() => Linking.openURL(P.link!)}><T small style={{ color: c.accent }}>{P.local ? 'ollama.com ↗' : t.getKey}</T></Pressable>
                {P.key && <T small muted>{t.keyNote}</T>}
              </Row>
            </>
          )}
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <T h={2}>{t.saveTitle}</T>
        <T small muted>{t.exportNote}</T>
        <Row>
          <Btn kind="pri" label={t.backupBtn} onPress={() => run(() => shareFile(`calo-mon-viet-${stamp()}.json`, JSON.stringify(backup(data, lang), null, 1), 'application/json'), true)} />
          <Btn label=".csv" onPress={() => run(() => shareFile(`calo-mon-viet-${todayIso()}.csv`, toCsv(data, t, lang), 'text/csv'))} />
          <Btn label=".txt" onPress={() => run(() => shareFile(`calo-mon-viet-${todayIso()}.txt`, toText(data, t, lang, 'all', viewDate), 'text/plain'))} />
          <Btn label={t.importBtn} onPress={doImport} />
        </Row>
        <Row>
          <Seg small items={[{ v: 'day' as const, label: t.scopeDay }, { v: 'all' as const, label: t.scopeAll }]} value={scope} onChange={setScope} />
          <Btn small label={t.copy} onPress={async () => { await Clipboard.setStringAsync(toText(data, t, lang, scope, viewDate)); setMsg({ text: t.copied, ok: true }); }} />
        </Row>
        <T small muted>{t.storeInfo(Object.keys(data.days).length) + ' ' + (data.lastBackup ? t.lastBackup(fmtDate(lang, data.lastBackup.slice(0, 10))) : t.noBackupYet)}</T>
        {msg && <Note ok={msg.ok}>{msg.text}</Note>}
      </Card>

      <View style={{ gap: 6 }}>
        <T small muted>© 2026 Tran Hong Quan · Calo Món Việt</T>
        <T small muted>{t.footer}</T>
      </View>
    </View>
  );
}

/** Ô nhập số: áp dụng khi rời ô, bấm Xong, hoặc khi màn hình đóng (chuyển tab lúc bàn phím còn mở). Số không hợp lệ thì hiện lại giá trị cũ. */
function NumInput({ value, onCommit, label }: { value: number; onCommit: (txt: string) => void; label: string }) {
  const c = useColors();
  const [txt, setTxt] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  const commitRef = useRef(onCommit);
  useEffect(() => { commitRef.current = onCommit; });
  useEffect(() => () => { if (pending.current != null) commitRef.current(pending.current); }, []);
  const done = () => { if (pending.current != null) onCommit(pending.current); pending.current = null; setTxt(null); };
  return (
    <TextInput style={[inputStyle(c), { width: 110 }]} value={txt ?? String(value)} maxLength={5}
      onChangeText={(v) => { pending.current = v; setTxt(v); }} onEndEditing={done} onBlur={done}
      keyboardType="number-pad" returnKeyType="done" accessibilityLabel={label} />
  );
}

function Stepper({ value, label, onChange, min, max }: { value: number; label: string; onChange: (v: number) => void; min: number; max: number }) {
  const c = useColors();
  const b = { width: 38, height: 36, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: c.bg };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.line, borderRadius: 10, overflow: 'hidden' }}>
      <Pressable accessibilityLabel={`${label} −`} disabled={value <= min} onPress={() => onChange(value - 1)} style={[b, { opacity: value <= min ? 0.4 : 1 }]}><T>−</T></Pressable>
      <T style={{ width: 58, textAlign: 'center' }}>{`${value}:00`}</T>
      <Pressable accessibilityLabel={`${label} +`} disabled={value >= max} onPress={() => onChange(value + 1)} style={[b, { opacity: value >= max ? 0.4 : 1 }]}><T>+</T></Pressable>
    </View>
  );
}

function MealRemindSettings() {
  const { data } = useApp();
  const t = useT(), c = useColors(), m = mealRemindOf(data);
  return (
    <Card style={{ gap: 12 }}>
      <Row style={{ gap: 6 }}><Icon name="chart" size={20} color={c.accent} /><T h={2}>{t.mrHead}</T></Row>
      <Row between><T>{t.mrSetting}</T>
        <Seg items={[{ v: 'off', label: t.waterOff }, { v: 'on', label: t.waterOn }]} value={m.on ? 'on' : 'off'} onChange={(v) => setMealRemind({ on: v === 'on' })} />
      </Row>
      {!remindersSupported && <Note>{t.waterWeb}</Note>}
      {m.on && (
        <>
          <Row between><T>{t.mrAt}</T><Stepper value={m.at} label={t.mrAt} min={17} max={23} onChange={(v) => setMealRemind({ at: v })} /></Row>
          <T small muted>{t.mrNote}</T>
        </>
      )}
    </Card>
  );
}

function WaterSettings() {
  const { lang, data } = useApp();
  const t = useT(), c = useColors(), w = waterCfgOf(data);
  const applyGoal = (txt: string) => {
    const v = Math.round(Number(txt) / 50) * 50;
    if (v >= 500 && v <= 6000 && v !== waterCfg().goal) setWaterCfg({ goal: v });
  };
  return (
    <Card style={{ gap: 12 }}>
      <Row style={{ gap: 6 }}><Icon name="drop" size={20} color={c.water} /><T h={2}>{t.water}</T></Row>
      <Row between><T style={{ flex: 1 }}>{t.waterGoal}</T>
        <NumInput value={w.goal} onCommit={applyGoal} label={t.waterGoal} />
      </Row>
      <Row between><T>{t.waterRemind}</T>
        <Seg items={[{ v: 'off', label: t.waterOff }, { v: 'on', label: t.waterOn }]} value={w.on ? 'on' : 'off'} onChange={(v) => setWaterCfg({ on: v === 'on' })} />
      </Row>
      {!remindersSupported && <Note>{t.waterWeb}</Note>}
      {w.on && (
        <>
          <Row between><T>{t.waterEvery}</T>
            <Seg small items={[60, 90, 120, 180].map((v) => ({ v, label: `${(v / 60).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')} ${t.hours}` }))} value={w.every} onChange={(v) => setWaterCfg({ every: v })} />
          </Row>
          <Row between><T>{t.waterHours}</T>
            <Row>
              <Stepper value={w.from} label={t.waterFrom} min={5} max={w.to - 1} onChange={(v) => setWaterCfg({ from: v })} />
              <T muted>–</T>
              <Stepper value={w.to} label={t.waterTo} min={w.from + 1} max={23} onChange={(v) => setWaterCfg({ to: v })} />
            </Row>
          </Row>
          <T small muted>{t.waterNote(slots(w).length)}</T>
        </>
      )}
    </Card>
  );
}
