// Các bảng trượt: thêm bữa, mô tả, tìm món, nhận diện ảnh, kiểm tra/sửa bữa.
import { useState } from 'react';
import { Image, Linking, Pressable, TextInput, View } from 'react-native';

import { itemName } from '@/lib/backup';
import { mk, scaleItem, sum } from '@/lib/core';
import { byId, DB } from '@/lib/foods';
import { norm } from '@/lib/parse-text';
import {
  addFromList, aiManual, deleteReview, describe, dismissSheet, finishLocal, gemQuick, openList, openSheet, pasteFromClipboard,
  pickPhoto, readPasted, recopyPrompt, saveReview, set, startGpt, tr, updateReview, useApp,
} from '@/state/store';
import { Btn, Chips, GeminiBadge, Icon, inputStyle, Note, Row, Seg, Sheet, T, XBtn } from '@/ui/kit';
import { useColors } from '@/ui/theme';

export default function Sheets() {
  const { sheet, rv } = useApp();
  const t = tr();
  const title = sheet === 'add' ? t.addTitle : sheet === 'text' ? t.optText : sheet === 'list' ? t.optList : sheet === 'ai' ? t.aiHow : rv?.mealId ? t.rvEdit : t.rvNew;
  return (
    <Sheet visible={!!sheet} onClose={dismissSheet} title={title}>
      {sheet === 'add' && <AddSheet />}
      {sheet === 'text' && <TextSheet />}
      {sheet === 'list' && <ListSheet />}
      {sheet === 'ai' && <AiSheet />}
      {sheet === 'review' && <ReviewSheet />}
    </Sheet>
  );
}

function Opt({ icon, title, desc, onPress }: { icon: 'camera' | 'image' | 'text' | 'search'; title: string; desc: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({
      flexBasis: '47%', flexGrow: 1, gap: 6, padding: 14, borderWidth: 1, borderColor: c.line, borderRadius: 14, backgroundColor: c.bg, opacity: pressed ? 0.75 : 1,
    })}>
      <Icon name={icon} size={26} color={c.accent} />
      <T bold style={{ fontSize: 15 }}>{title}</T>
      <T muted style={{ fontSize: 12 }}>{desc}</T>
    </Pressable>
  );
}

function AddSheet() {
  const t = tr();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      <Opt icon="camera" title={t.optCam} desc={t.optCamD} onPress={() => pickPhoto('camera')} />
      <Opt icon="image" title={t.optGal} desc={t.optGalD} onPress={() => pickPhoto('library')} />
      <Opt icon="text" title={t.optText} desc={t.optTextD} onPress={() => openSheet('text')} />
      <Opt icon="search" title={t.optList} desc={t.optListD} onPress={() => openList(false)} />
    </View>
  );
}

function TextSheet() {
  const { busy } = useApp();
  const t = tr(), c = useColors();
  const [txt, setTxt] = useState('');
  return (
    <>
      <TextInput style={[inputStyle(c), { minHeight: 90, textAlignVertical: 'top' }]} multiline autoFocus value={txt} onChangeText={setTxt}
        placeholder={t.descPh} placeholderTextColor={c.muted} accessibilityLabel={t.optText} />
      <Btn kind="pri" full disabled={busy || !txt.trim()} label={busy ? t.analyzing : t.descGo} onPress={async () => { if (await describe(txt)) setTxt(''); }} />
      <T small muted>{t.descNote}</T>
    </>
  );
}

function ListSheet() {
  const { lang } = useApp();
  const t = tr(), c = useColors();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'all' | 'main' | 'snack'>('all');
  const nq = norm(q);
  const rows = DB.filter((d) => (cat === 'all' || d.cat === cat) && (!nq || norm(d.vi + ' ' + d.en).includes(nq)));
  return (
    <>
      <TextInput style={inputStyle(c)} value={q} onChangeText={setQ} placeholder={t.searchPh} placeholderTextColor={c.muted}
        autoCorrect={false} accessibilityLabel={t.optList} clearButtonMode="while-editing" />
      <Chips selected={cat} onPress={(v) => setCat(v as typeof cat)} items={[{ v: 'all', label: t.catAll }, { v: 'main', label: t.catMain }, { v: 'snack', label: t.catSnack }]} />
      <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, overflow: 'hidden' }}>
        {rows.map((d, i) => (
          <Pressable key={d.id} accessibilityRole="button" onPress={() => addFromList(d.id)}
            style={({ pressed }) => ({ flexDirection: 'row', justifyContent: 'space-between', gap: 10, padding: 12, borderTopWidth: i ? 1 : 0, borderColor: c.line, backgroundColor: pressed ? c.accentSoft : 'transparent' })}>
            <T style={{ flex: 1 }}>{lang === 'en' ? d.en : d.vi}</T>
            <T small muted>{d.kcal} kcal</T>
          </Pressable>
        ))}
        {!rows.length && <T muted style={{ padding: 20, textAlign: 'center' }}>—</T>}
      </View>
    </>
  );
}

function AiSheet() {
  const { photo, local, gptOpen, aiMsg, lang } = useApp();
  const t = tr(), c = useColors();
  const [key, setKey] = useState('');
  const [paste, setPaste] = useState('');
  const box = { gap: 10, padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 12, backgroundColor: c.bg } as const;
  return (
    <>
      {photo && <Image source={{ uri: photo.thumb }} style={{ width: '100%', height: 200, borderRadius: 14 }} resizeMode="cover" />}
      {local && (
        <View style={box}>
          <T bold>{t.localTitle}</T>
          <Chips items={local.map((x) => ({ v: x.id, label: `${lang === 'en' ? byId[x.id].en : byId[x.id].vi} · ${Math.round(x.p * 100)}%` }))} onPress={(id) => finishLocal(local, id)} />
          <T small muted>{t.localNote}</T>
        </View>
      )}
      <Pressable accessibilityRole="button" onPress={startGpt} style={({ pressed }) => [box, { opacity: pressed ? 0.75 : 1 }]}>
        <T bold>{t.useGpt}</T><T small muted>{t.useGptD}</T>
      </Pressable>
      {gptOpen && (
        <View style={box}>
          {[t.gpt1, t.gpt2, t.gpt3].map((s, i) => <T key={i} small>{`${i + 1}. ${s}`}</T>)}
          <Row><Btn small kind="pri" label={t.pasteBtn} onPress={pasteFromClipboard} /><Btn small label={t.recopy} onPress={recopyPrompt} /></Row>
          <TextInput style={[inputStyle(c), { minHeight: 70, textAlignVertical: 'top' }]} multiline value={paste} placeholder={t.pasteHere} placeholderTextColor={c.muted}
            onChangeText={(v) => { setPaste(v); if (readPasted(v)) setPaste(''); else if (v.includes('}')) set({ aiMsg: t.badJson }); }} />
        </View>
      )}
      <View style={box}>
        <T bold>{t.gemQuick}</T>
        <T small muted>{t.gemQuickD}</T>
        <Row style={{ flexWrap: 'nowrap' }}>
          <TextInput style={[inputStyle(c), { flex: 1 }]} value={key} onChangeText={setKey} placeholder="API key" placeholderTextColor={c.muted}
            secureTextEntry autoCapitalize="none" autoCorrect={false} />
          <Btn small kind="pri" label={t.gemGo} onPress={() => gemQuick(key)} />
        </Row>
        <Pressable onPress={() => Linking.openURL('https://aistudio.google.com/apikey')}><T small style={{ color: c.accent }}>{t.getKey}</T></Pressable>
      </View>
      <Btn full label={t.aiManual} onPress={aiManual} />
      {aiMsg && <Note>{aiMsg}</Note>}
    </>
  );
}

function ReviewSheet() {
  const { rv, lang } = useApp();
  const t = tr(), c = useColors();
  const [ask, setAsk] = useState(false);
  if (!rv) return null;
  const r0 = (n: number) => Math.round(n).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
  const sv = Number(rv.servings) || 1;
  const tot = { k: sum(rv.items, 'kcal') * sv, p: sum(rv.items, 'p') * sv, c: sum(rv.items, 'c') * sv, f: sum(rv.items, 'f') * sv };
  const alts = (rv.alts || []).filter((x) => x.id !== rv.altSel);
  const showAlts = alts.length > 0 && rv.items.some((it) => it.id === rv.altSel);
  const setGrams = (i: number, v: number) => {
    const items = rv.items.slice();
    items[i] = scaleItem({ ...items[i], grams: Math.max(1, Math.round(Number(v) || 1)) });
    updateReview({ items });
  };
  const stepOf = (g: number) => Math.max(5, Math.round((g * 0.1) / 5) * 5);

  return (
    <>
      {rv.photo && <Image source={{ uri: rv.photo }} style={{ width: '100%', height: 200, borderRadius: 14 }} resizeMode="cover" />}
      {rv.source === 'Gemini' && <GeminiBadge label={t.fromGemini} />}
      <Row between>
        <T><T style={{ fontSize: 32, fontWeight: '700' }}>{r0(tot.k)}</T> kcal</T>
        <Row style={{ gap: 14 }}>
          <T small muted>{t.protein} <T small bold>{r0(tot.p)}g</T></T>
          <T small muted>{t.carb} <T small bold>{r0(tot.c)}g</T></T>
          <T small muted>{t.fat} <T small bold>{r0(tot.f)}g</T></T>
        </Row>
      </Row>
      <Chips selected={String(rv.meal)} onPress={(v) => updateReview({ meal: Number(v) })} items={t.meals.map((m, i) => ({ v: String(i), label: m }))} />
      <Row between><T small muted>{t.servings}</T>
        <Seg items={[{ v: 0.5, label: '½' }, { v: 1, label: '1' }, { v: 1.5, label: '1½' }, { v: 2, label: '2' }]} value={sv} onChange={(v) => updateReview({ servings: v })} />
      </Row>
      {!!rv.note && <Note>{rv.note}</Note>}
      {showAlts && (
        <View style={{ gap: 8, padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 12, backgroundColor: c.bg }}>
          <T small muted>{t.altsTitle}</T>
          <Chips items={alts.map((x) => ({ v: x.id, label: `${lang === 'en' ? byId[x.id].en : byId[x.id].vi} · ${Math.round(x.p * 100)}%` }))}
            onPress={(id) => {
              const i = rv.items.findIndex((it) => it.id === rv.altSel);
              if (i < 0) return;
              const it = mk(id); it.conf = rv.alts!.find((x) => x.id === id)?.p ?? null;
              const items = rv.items.slice(); items[i] = it;
              updateReview({ items, altSel: id });
            }} />
        </View>
      )}
      <View style={{ gap: 8 }}>
        {rv.items.map((it, i) => (
          <View key={i} style={{ gap: 8, padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 12 }}>
            <Row between style={{ flexWrap: 'nowrap' }}>
              <T bold style={{ flex: 1 }}>{itemName(lang, it)}{!it.id && <T muted style={{ fontSize: 11 }}>{'  ' + t.outside.toUpperCase()}</T>}</T>
              {it.conf != null && (
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: it.conf < 0.6 ? c.warnSoft : c.accentSoft }}>
                  <T style={{ fontSize: 11, fontWeight: '600', color: it.conf < 0.6 ? c.warn : c.accent }}>{it.conf < 0.6 ? t.check : t.sure}</T>
                </View>
              )}
              <XBtn label={t.delete} onPress={() => updateReview({ items: rv.items.filter((_, j) => j !== i) })} />
            </Row>
            <Row between>
              <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: c.line, borderRadius: 10, overflow: 'hidden' }}>
                <Pressable accessibilityLabel="-" onPress={() => setGrams(i, it.grams - stepOf(it.grams))} style={{ width: 40, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}><T style={{ fontSize: 18 }}>−</T></Pressable>
                <GramInput value={it.grams} onDone={(v) => setGrams(i, v)} />
                <Pressable accessibilityLabel="+" onPress={() => setGrams(i, it.grams + stepOf(it.grams))} style={{ width: 40, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}><T style={{ fontSize: 18 }}>+</T></Pressable>
              </View>
              <T small muted>{`${r0(it.kcal)} kcal`}</T>
            </Row>
          </View>
        ))}
      </View>
      <Btn full label={t.addItem} onPress={() => openList(true)} />
      <Btn full kind="pri" label={t.saveMeal} disabled={!rv.items.length} onPress={saveReview} />
      {!!rv.mealId && !ask && <Btn full kind="warn" label={t.delMeal} onPress={() => setAsk(true)} />}
      {ask && (
        <Note>
          <T small>{t.delAsk}</T>
          <Row style={{ marginTop: 8 }}><Btn small kind="warn" label={t.delete} onPress={deleteReview} /><Btn small label={t.cancel} onPress={() => setAsk(false)} /></Row>
        </Note>
      )}
    </>
  );
}

function GramInput({ value, onDone }: { value: number; onDone: (v: number) => void }) {
  const c = useColors();
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <TextInput
      style={{ width: 64, textAlign: 'center', fontSize: 16, color: c.fg, backgroundColor: c.surface, paddingVertical: 6 }}
      keyboardType="number-pad" returnKeyType="done" accessibilityLabel="gram"
      value={txt ?? String(Math.round(value))} onChangeText={setTxt}
      onEndEditing={() => { if (txt != null) onDone(Number(txt)); setTxt(null); }}
      onBlur={() => { if (txt != null) onDone(Number(txt)); setTxt(null); }}
    />
  );
}

