// Thành phần giao diện dùng chung.
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View,
  type StyleProp, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useColors } from './theme';

export const MAXW = 520;

export function T({ style, muted, small, bold, h, ...p }: TextProps & { muted?: boolean; small?: boolean; bold?: boolean; h?: 1 | 2 | 3 }) {
  const c = useColors();
  const size = h === 1 ? 20 : h === 2 ? 17 : h === 3 ? 15 : small ? 13 : 16;
  return (
    <Text
      {...p}
      style={[{ color: muted ? c.muted : c.fg, fontSize: size, fontWeight: h ? (h === 1 ? '700' : '600') : bold ? '600' : '400', fontVariant: ['tabular-nums'] }, style]}
    />
  );
}

export function Card({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const c = useColors();
  return <View style={[{ backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderRadius: 16, padding: 16 }, style]}>{children}</View>;
}

export function Btn({ label, onPress, kind, small, full, disabled, style }: {
  label: string; onPress?: () => void; kind?: 'pri' | 'warn'; small?: boolean; full?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const pri = kind === 'pri';
  return (
    <Pressable
      accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={({ pressed }) => [{
        minHeight: small ? 36 : 44, paddingHorizontal: small ? 12 : 14, paddingVertical: small ? 6 : 10, borderRadius: 12, borderWidth: 1,
        borderColor: pri ? c.accent : c.line, backgroundColor: pri ? c.accent : c.surface, alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1, alignSelf: full ? 'stretch' : 'auto',
      }, style]}>
      <Text style={{ color: pri ? c.onAccent : kind === 'warn' ? c.warn : c.fg, fontWeight: '600', fontSize: small ? 14 : 16 }}>{label}</Text>
    </Pressable>
  );
}

export function Seg<V extends string | number>({ items, value, onChange, small }: { items: { v: V; label: string }[]; value: V; onChange: (v: V) => void; small?: boolean }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: c.line, borderRadius: 12, overflow: 'hidden', backgroundColor: c.bg, alignSelf: 'flex-start' }}>
      {items.map((it) => {
        const on = it.v === value;
        return (
          <Pressable key={String(it.v)} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(it.v)}
            style={{ paddingHorizontal: small ? 11 : 14, minHeight: small ? 34 : 40, justifyContent: 'center', backgroundColor: on ? c.accent : 'transparent' }}>
            <Text style={{ fontWeight: '600', color: on ? c.onAccent : c.muted, fontSize: small ? 13 : 15 }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chips({ items, onPress, selected }: { items: { v: string; label: string }[]; onPress: (v: string) => void; selected?: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {items.map((it) => {
        const on = it.v === selected;
        return (
          <Pressable key={it.v} accessibilityRole="button" onPress={() => onPress(it.v)}
            style={{ borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ fontWeight: '600', fontSize: 14, color: on ? c.onAccent : c.muted }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Note({ children, ok }: { children: ReactNode; ok?: boolean }) {
  const c = useColors();
  return (
    <View style={{ padding: 10, borderRadius: 10, backgroundColor: ok ? c.accentSoft : c.warnSoft, borderLeftWidth: 3, borderLeftColor: ok ? c.accent : c.warn }}>
      {typeof children === 'string' ? <T small>{children}</T> : children}
    </View>
  );
}

export function Row({ children, style, between }: { children: ReactNode; style?: StyleProp<ViewStyle>; between?: boolean }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, between && { justifyContent: 'space-between' }, style]}>{children}</View>;
}

export function XBtn({ onPress, label }: { onPress: () => void; label: string }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.muted, fontSize: 20, lineHeight: 22 }}>×</Text>
    </Pressable>
  );
}

/** Bảng trượt từ dưới lên. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const c = useColors();
  const ins = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.shade }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={{ maxHeight: '92%', backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 18 + ins.bottom, gap: 14, width: '100%', maxWidth: MAXW, alignSelf: 'center' }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.line, alignSelf: 'center', marginVertical: 4 }} />
            <Row between><T h={2} style={{ flex: 1 }}>{title}</T><XBtn onPress={onClose} label="Close" /></Row>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Ring({ size, r, width, frac, color, track }: { size: number; r: number; width: number; frac: number; color: string; track: string }) {
  const C = 2 * Math.PI * r, mid = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={mid} cy={mid} r={r} fill="none" stroke={track} strokeWidth={width} />
      <Circle cx={mid} cy={mid} r={r} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round"
        strokeDasharray={`${C} ${C}`} strokeDashoffset={C * (1 - Math.min(Math.max(frac, 0), 1))} transform={`rotate(-90 ${mid} ${mid})`} />
    </Svg>
  );
}

// ---- biểu tượng (vẽ lại từ SVG trong bản HTML) ----
type IconName = 'home' | 'chart' | 'gear' | 'plus' | 'camera' | 'image' | 'text' | 'search' | 'bowl' | 'flame' | 'sparkle' | 'drop';
export function Icon({ name, size = 22, color, strokeWidth = 2 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  const sp = { fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && <Path {...sp} d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />}
      {name === 'chart' && <Path {...sp} d="M3 20h18M6 20v-6M11 20V6M16 20v-9M21 20v-4" />}
      {name === 'gear' && (<><Circle {...sp} cx={12} cy={12} r={3} /><Path {...sp} d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>)}
      {name === 'plus' && <Path {...sp} d="M12 5v14M5 12h14" />}
      {name === 'camera' && (<><Path {...sp} d="M4 8h3l2-3h6l2 3h3v11H4z" /><Circle {...sp} cx={12} cy={13} r={3.5} /></>)}
      {name === 'image' && (<><Rect {...sp} x={3} y={4} width={18} height={16} rx={2} /><Circle {...sp} cx={9} cy={10} r={2} /><Path {...sp} d="M21 17l-5-5-9 8" /></>)}
      {name === 'text' && <Path {...sp} d="M4 6h16M4 12h10M4 18h7" />}
      {name === 'search' && (<><Circle {...sp} cx={11} cy={11} r={7} /><Path {...sp} d="M20 20l-3.5-3.5" /></>)}
      {name === 'bowl' && (<><Path {...sp} d="M3 11h18a9 9 0 0 1-18 0z" /><Path {...sp} d="M8 7c0-1.5 1-2 1-3M12 7c0-1.5 1-2 1-3M16 7c0-1.5 1-2 1-3" /></>)}
      {name === 'drop' && <Path fill={color} d="M12 2.5c-3.6 4.6-6.5 8.3-6.5 11.7A6.5 6.5 0 0 0 12 20.7a6.5 6.5 0 0 0 6.5-6.5c0-3.4-2.9-7.1-6.5-11.7z" />}
      {name === 'sparkle' && <Path fill={color} d="M12 2c.6 4.8 2.9 8.1 7.4 9.4.6.2.6 1 0 1.2C14.9 13.9 12.6 17.2 12 22c-.6-4.8-2.9-8.1-7.4-9.4-.6-.2-.6-1 0-1.2C9.1 10.1 11.4 6.8 12 2z" />}
      {name === 'flame' && <Path fill={color} d="M12 2c1 3.5-1.5 5-1.5 7.5 0 1.4 1 2.5 2.3 2.5 1.6 0 2.4-1.4 2.2-3.2C17.4 10.5 19 13 19 15.5 19 19.1 15.9 22 12 22s-7-2.9-7-6.5C5 10.8 9.6 8.2 12 2z" />}
    </Svg>
  );
}

/** Huy hiệu nhỏ cho biết kết quả lấy từ Gemini. compact = chỉ hiện biểu tượng. */
export function GeminiBadge({ label, compact }: { label: string; compact?: boolean }) {
  const dark = useColorScheme() === 'dark';
  const fg = dark ? '#8ab4f8' : '#1a5fd0', bg = dark ? '#1b2b45' : '#e8f0fe';
  if (compact) return <View accessibilityLabel={label}><Icon name="sparkle" size={13} color={fg} /></View>;
  return (
    <View accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: bg }}>
      <Icon name="sparkle" size={13} color={fg} />
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>Gemini</Text>
    </View>
  );
}

export const inputStyle = (c: ReturnType<typeof useColors>): TextStyle => ({
  backgroundColor: c.bg, borderColor: c.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: c.fg,
});
