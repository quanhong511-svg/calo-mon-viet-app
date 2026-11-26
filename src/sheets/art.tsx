// Ảnh món ăn để đăng mạng xã hội: filter màu, bố cục, hashtag và tên ứng dụng.
// Filter dựng bằng lớp màu / gradient SVG phủ lên ảnh nên chụp lại được bằng react-native-view-shot ở mọi nền tảng.
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { itemName } from '@/lib/backup';
import { sum } from '@/lib/core';
import { norm } from '@/lib/parse-text';
import { captureAndShare } from '@/lib/share-image';
import { toast, useApp, useT } from '@/state/store';
import { Btn, inputStyle, Note, T } from '@/ui/kit';
import { useColors } from '@/ui/theme';

type FilterId = 'none' | 'warm' | 'cool' | 'vintage' | 'sunset' | 'fade';
type LayoutId = 'clean' | 'polaroid' | 'card' | 'magazine' | 'story';
const FILTERS: FilterId[] = ['none', 'warm', 'cool', 'vintage', 'sunset', 'fade'];
const LAYOUTS: LayoutId[] = ['clean', 'polaroid', 'card', 'magazine', 'story'];
/** Kích thước vẽ (logic) và kích thước xuất (px). */
const SIZE: Record<LayoutId, { w: number; h: number; ow: number; oh: number }> = {
  clean: { w: 300, h: 375, ow: 1080, oh: 1350 }, polaroid: { w: 300, h: 375, ow: 1080, oh: 1350 }, card: { w: 300, h: 375, ow: 1080, oh: 1350 },
  magazine: { w: 300, h: 375, ow: 1080, oh: 1350 }, story: { w: 252, h: 448, ow: 1080, oh: 1920 },
};
const APP = 'Calo Món Việt';

/** Lớp phủ tạo hiệu ứng màu cho ảnh. */
function FilterOverlay({ f }: { f: FilterId }) {
  if (f === 'none') return null;
  const vignette = f === 'vintage' || f === 'fade' || f === 'sunset';
  return (
    <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" pointerEvents="none">
      <Defs>
        <LinearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ff5e7e" stopOpacity="0.32" /><Stop offset="1" stopColor="#ffb347" stopOpacity="0.22" />
        </LinearGradient>
        <RadialGradient id="vig" cx="50" cy="50" r="72" gradientUnits="userSpaceOnUse">
          <Stop offset="0.55" stopColor="#000" stopOpacity="0" /><Stop offset="1" stopColor="#000" stopOpacity={f === 'fade' ? 0.25 : 0.5} />
        </RadialGradient>
      </Defs>
      {f === 'warm' && <Rect width="100" height="100" fill="#ff9a2e" fillOpacity={0.2} />}
      {f === 'cool' && <Rect width="100" height="100" fill="#2e8bff" fillOpacity={0.17} />}
      {f === 'vintage' && <Rect width="100" height="100" fill="#8a5a24" fillOpacity={0.3} />}
      {f === 'sunset' && <Rect width="100" height="100" fill="url(#sun)" />}
      {f === 'fade' && <Rect width="100" height="100" fill="#ffffff" fillOpacity={0.22} />}
      {vignette && <Rect width="100" height="100" fill="url(#vig)" />}
    </Svg>
  );
}

/** Ảnh món ăn kèm filter, phủ kín khung cha. */
function Photo({ uri, f, style }: { uri: string; f: FilterId; style?: object }) {
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: '#222' }, style]}>
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      <FilterOverlay f={f} />
    </View>
  );
}

/** Gradient tối dần từ trên xuống, để chữ trắng dễ đọc trên ảnh. */
const Shade = ({ from = 0, to = 0.75, top }: { from?: number; to?: number; top?: boolean }) => (
  <Svg style={{ position: 'absolute', left: 0, right: 0, [top ? 'top' : 'bottom']: 0, height: '55%' }} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1 1" pointerEvents="none">
    <Defs><LinearGradient id={top ? 'sh-t' : 'sh-b'} x1="0" y1={top ? 1 : 0} x2="0" y2={top ? 0 : 1}>
      <Stop offset="0" stopColor="#000" stopOpacity={from} /><Stop offset="1" stopColor="#000" stopOpacity={to} />
    </LinearGradient></Defs>
    <Rect width="1" height="1" fill={`url(#${top ? 'sh-t' : 'sh-b'})`} />
  </Svg>
);

type Info = { title: string; kcal: string; macros: { p: number; c: number; f: number }; tags: string };

function Layout({ id, uri, f, info }: { id: LayoutId; uri: string; f: FilterId; info: Info }) {
  const { w, h } = SIZE[id];
  const t = useT();
  const white = { color: '#ffffff' };
  const shadow = { textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } };
  const brand = (color = '#ffffff') => <T style={{ color, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>{`🍜 ${APP}`}</T>;
  const macroLine = `${t.protein} ${info.macros.p}g · ${t.carb} ${info.macros.c}g · ${t.fat} ${info.macros.f}g`;
  let body: ReactNode;
  if (id === 'clean') body = (
    <>
      <Photo uri={uri} f={f} style={{ position: 'absolute', top: 0, left: 0, width: w, height: h }} />
      <Shade />
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14, gap: 3 }}>
        <T numberOfLines={2} style={[white, shadow, { fontSize: 20, fontWeight: '800' }]}>{info.title}</T>
        <T style={[white, { fontSize: 12, opacity: 0.92 }]}>{`${info.kcal} kcal · ${macroLine}`}</T>
        <T numberOfLines={2} style={{ color: '#9be7c4', fontSize: 11, fontWeight: '600' }}>{info.tags}</T>
        <View style={{ alignSelf: 'flex-end', marginTop: 2 }}>{brand()}</View>
      </View>
    </>
  );
  else if (id === 'polaroid') body = (
    <View style={{ flex: 1, backgroundColor: '#f7f3ea', padding: 18, gap: 10 }}>
      <View style={{ backgroundColor: '#ffffff', padding: 10, paddingBottom: 14, gap: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 }}>
        <Photo uri={uri} f={f} style={{ width: w - 56, height: w - 56 }} />
        <T numberOfLines={1} style={{ color: '#3b2f22', fontSize: 16, fontStyle: 'italic', fontWeight: '600', textAlign: 'center' }}>{info.title}</T>
      </View>
      <T style={{ color: '#5d4a36', fontSize: 12, textAlign: 'center' }}>{`${info.kcal} kcal · ${macroLine}`}</T>
      <T numberOfLines={2} style={{ color: '#a3561a', fontSize: 11, textAlign: 'center' }}>{info.tags}</T>
      <View style={{ alignItems: 'center' }}>{brand('#3b2f22')}</View>
    </View>
  );
  else if (id === 'card') {
    const tot = info.macros.p * 4 + info.macros.c * 4 + info.macros.f * 9 || 1;
    const bars = [[t.protein, info.macros.p, (info.macros.p * 4) / tot, '#d9654f'], [t.carb, info.macros.c, (info.macros.c * 4) / tot, '#c48a12'], [t.fat, info.macros.f, (info.macros.f * 9) / tot, '#3a6ea5']] as const;
    body = (
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <Photo uri={uri} f={f} style={{ width: w, height: h * 0.56 }} />
        <View style={{ flex: 1, padding: 14, gap: 6 }}>
          <T numberOfLines={1} style={{ color: '#16231d', fontSize: 16, fontWeight: '800' }}>{info.title}</T>
          <T style={{ color: '#0f6b4f', fontSize: 26, fontWeight: '800' }}>{info.kcal}<T style={{ fontSize: 12, color: '#5d6d65', fontWeight: '600' }}> kcal</T></T>
          {bars.map(([n, g, frac, col]) => (
            <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <T style={{ width: 52, fontSize: 10, color: '#5d6d65' }}>{n}</T>
              <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: '#e8eeea', overflow: 'hidden' }}><View style={{ width: `${Math.round(frac * 100)}%`, height: '100%', backgroundColor: col }} /></View>
              <T style={{ width: 34, fontSize: 10, color: '#16231d', textAlign: 'right', fontWeight: '700' }}>{`${g}g`}</T>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T numberOfLines={2} style={{ flex: 1, color: '#0f6b4f', fontSize: 10, fontWeight: '600' }}>{info.tags}</T>
            {brand('#0f6b4f')}
          </View>
        </View>
      </View>
    );
  } else if (id === 'magazine') body = (
    <>
      <Photo uri={uri} f={f} style={{ position: 'absolute', top: 0, left: 0, width: w, height: h }} />
      <Shade top from={0} to={0.6} />
      <Shade from={0} to={0.7} />
      <View style={{ position: 'absolute', top: 16, left: 16, right: 16, gap: 2 }}>
        <View style={{ alignSelf: 'flex-end' }}>{brand()}</View>
        <T numberOfLines={3} style={[white, shadow, { fontSize: 28, fontWeight: '900', textTransform: 'uppercase', lineHeight: 30, marginTop: 6 }]}>{info.title}</T>
      </View>
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
        <T style={[white, shadow, { fontSize: 54, fontWeight: '900', lineHeight: 58 }]}>{info.kcal}<T style={{ fontSize: 16, fontWeight: '800', color: '#ffffff' }}> KCAL</T></T>
        <T style={[white, { fontSize: 11, opacity: 0.9 }]}>{macroLine}</T>
        <T numberOfLines={2} style={{ color: '#ffd28a', fontSize: 11, fontWeight: '700', marginTop: 4 }}>{info.tags}</T>
      </View>
    </>
  );
  else body = (
    <>
      <Photo uri={uri} f={f} style={{ position: 'absolute', top: 0, left: 0, width: w, height: h }} />
      <Shade top from={0} to={0.5} />
      <T style={[white, shadow, { position: 'absolute', top: 30, left: 0, right: 0, textAlign: 'center', fontSize: 18, fontWeight: '800' }]}>{t.arStory}</T>
      <View style={{ position: 'absolute', left: 18, right: 18, bottom: 36, padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', gap: 4, alignItems: 'center' }}>
        <T numberOfLines={2} style={{ color: '#16231d', fontSize: 16, fontWeight: '800', textAlign: 'center' }}>{info.title}</T>
        <T style={{ color: '#0f6b4f', fontSize: 24, fontWeight: '900' }}>{`${info.kcal} kcal`}</T>
        <T style={{ color: '#5d6d65', fontSize: 10 }}>{macroLine}</T>
        <T numberOfLines={2} style={{ color: '#a3561a', fontSize: 10, fontWeight: '600', textAlign: 'center' }}>{info.tags}</T>
        {brand('#0f6b4f')}
      </View>
    </>
  );
  return <View style={{ width: w, height: h, overflow: 'hidden', backgroundColor: '#111' }}>{body}</View>;
}

/** Hashtag mặc định: tên app + tên món (không dấu, viết liền) + vài thẻ chung. */
function defaultTags(names: string[]) {
  const pascal = (s: string) => '#' + norm(s).split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  return ['#CaloMonViet', ...names.slice(0, 2).map(pascal), '#DemCalo', '#AnUongLanhManh'].join(' ');
}

export function ArtSheet() {
  const { rv, photo, lang } = useApp();
  const t = useT(), c = useColors();
  const items = rv?.items || [];
  const sv = Number(rv?.servings) || 1;
  const names = items.map((it) => itemName(lang, it));
  // ảnh gốc độ phân giải cao nếu đang ở lượt chụp này; bữa đã lưu chỉ còn ảnh nhỏ
  const fullUri = photo && rv?.photo && photo.thumb === rv.photo ? photo.uri : null;
  const [picked, setPicked] = useState<string | null>(null);
  const uri = picked || fullUri || rv?.photo || null;
  const [f, setF] = useState<FilterId>('warm');
  const [layout, setLayout] = useState<LayoutId>('clean');
  const [tags, setTags] = useState(() => defaultTags(names));
  const shot = useRef<ComponentRef<typeof View>>(null);
  const r0 = (n: number) => Math.round(n).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
  const info: Info = {
    title: names.join(', ') || APP, kcal: r0(sum(items, 'kcal') * sv),
    macros: { p: Math.round(sum(items, 'p') * sv), c: Math.round(sum(items, 'c') * sv), f: Math.round(sum(items, 'f') * sv) },
    tags: tags.trim(),
  };
  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled && res.assets?.[0]) setPicked(res.assets[0].uri);
  };
  const sz = SIZE[layout];
  const chip = (on: boolean) => ({ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : 'transparent' });
  if (!uri) return <Note>{t.arLowRes}</Note>;
  return (
    <>
      <View style={{ alignSelf: 'center', borderRadius: 10, overflow: 'hidden' }}>
        <View ref={shot} collapsable={false}><Layout id={layout} uri={uri} f={f} info={info} /></View>
      </View>
      <T small muted style={{ textAlign: 'center' }}>{`${t.arSize(sz.ow, sz.oh)}${!picked && !fullUri ? ' · ' + t.arLowRes : ''}`}</T>
      <T small bold>{t.arFilter}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map((id) => (
          <Pressable key={id} onPress={() => setF(id)} accessibilityRole="button" accessibilityState={{ selected: f === id }} style={{ alignItems: 'center', gap: 4 }}>
            <View style={{ width: 58, height: 58, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: f === id ? c.accent : 'transparent' }}>
              <Photo uri={uri} f={id} style={{ width: '100%', height: '100%' }} />
            </View>
            <T style={{ fontSize: 11, fontWeight: f === id ? '700' : '400', color: f === id ? c.accent : c.fg }}>{t.arFilters[id]}</T>
          </Pressable>
        ))}
      </ScrollView>
      <T small bold>{t.arLayout}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {LAYOUTS.map((id) => (
          <Pressable key={id} onPress={() => setLayout(id)} accessibilityRole="button" accessibilityState={{ selected: layout === id }} style={chip(layout === id)}>
            <T style={{ fontSize: 13, fontWeight: layout === id ? '700' : '400', color: layout === id ? c.accent : c.fg }}>{t.arLayouts[id]}</T>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 4 }}>
        <T small bold>{t.arTags}</T>
        <TextInput style={[inputStyle(c), { minHeight: 56, textAlignVertical: 'top' }]} multiline value={tags} onChangeText={setTags} maxLength={160}
          autoCapitalize="none" autoCorrect={false} accessibilityLabel={t.arTags} />
      </View>
      <Btn full label={t.arPick} onPress={pick} />
      <Btn full kind="pri" label={t.arShare} onPress={() => captureAndShare(shot, sz.ow, sz.oh, `calo-mon-viet-${layout}.png`, t.arShare).catch(() => toast(t.frImgFail))} />
    </>
  );
}
