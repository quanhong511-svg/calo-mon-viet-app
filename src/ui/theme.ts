// Bảng màu sáng / tối (giống bản HTML).
import { useColorScheme } from 'react-native';

const light = {
  bg: '#f3f6f4', surface: '#ffffff', line: '#d9e2dd', fg: '#16231d', muted: '#5d6d65',
  accent: '#0f6b4f', accentSoft: '#e1f0ea', onAccent: '#ffffff',
  protein: '#b4432f', carb: '#c48a12', fat: '#3a6ea5',
  warn: '#a3561a', warnSoft: '#fbeee1', shade: 'rgba(10,20,15,0.45)',
};
const dark: typeof light = {
  bg: '#0f1613', surface: '#17211c', line: '#2a3832', fg: '#e4ede8', muted: '#97a89f',
  accent: '#4cc394', accentSoft: '#1c3a2e', onAccent: '#08140f',
  protein: '#dd6650', carb: '#b98516', fat: '#4f8ad8',
  warn: '#f0a868', warnSoft: '#3a2a1c', shade: 'rgba(0,0,0,0.6)',
};
export type Colors = typeof light;
export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
