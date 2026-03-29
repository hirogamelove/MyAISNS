import React, { createContext, useContext } from 'react';

// ─── アクセントカラー選択肢 ───────────────────────────────
export const ACCENT_COLORS = [
  { id: 'purple', label: 'パープル', color: '#7c5cfc' },
  { id: 'pink',   label: 'ピンク',   color: '#fc5c7d' },
  { id: 'blue',   label: 'ブルー',   color: '#38b2f9' },
  { id: 'green',  label: 'グリーン', color: '#43e97b' },
  { id: 'orange', label: 'オレンジ', color: '#ff9f43' },
  { id: 'teal',   label: 'ティール', color: '#26d0ce' },
] as const;

export type ThemeMode    = 'dark' | 'light';
export type AccentId     = typeof ACCENT_COLORS[number]['id'];

// ─── カラーパレット生成 ─────────────────────────────────
export function getColors(mode: ThemeMode, accentId: AccentId) {
  const primary = ACCENT_COLORS.find(a => a.id === accentId)?.color ?? '#7c5cfc';

  if (mode === 'dark') {
    return {
      bg          : '#0a0a0f',
      bgCard      : '#13131a',
      bgInput     : '#1e1e2a',
      primary,
      primaryLight: lighten(primary, 0.15),
      accent      : '#fc5c7d',
      accentGreen : '#43e97b',
      accentBlue  : '#38f9d7',
      text        : '#f0f0ff',
      textSub     : '#8888aa',
      textMuted   : '#555577',
      border      : '#2a2a3a',
      like        : '#fc5c7d',
      repost      : '#43e97b',
      gold        : '#ffd700',
      adBg        : '#1a1508',
      adBorder    : '#4a3a00',
      isDark      : true,
    };
  }

  // ─── ライトモード ──────────────────────────────────────
  return {
    bg          : '#f0f2f8',
    bgCard      : '#ffffff',
    bgInput     : '#f5f6fa',
    primary,
    primaryLight: lighten(primary, 0.25),
    accent      : '#e8305a',
    accentGreen : '#2db866',
    accentBlue  : '#20b2aa',
    text        : '#1a1a2e',
    textSub     : '#555577',
    textMuted   : '#9999bb',
    border      : '#dde0f0',
    like        : '#e8305a',
    repost      : '#2db866',
    gold        : '#cc9900',
    adBg        : '#fffbe6',
    adBorder    : '#ccaa00',
    isDark      : false,
  };
}

export type ThemeColors = ReturnType<typeof getColors>;

// ─── lighten ヘルパー（hex → rgba 風に明るくする） ─────
function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r   = Math.min(255, (num >> 16) + Math.round(amount * 255));
  const g   = Math.min(255, ((num >> 8) & 0xff) + Math.round(amount * 255));
  const b   = Math.min(255, (num & 0xff) + Math.round(amount * 255));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ─── React Context ──────────────────────────────────────
export const ThemeContext = createContext<ThemeColors>(
  getColors('dark', 'purple'),
);

export function useTheme(): ThemeColors {
  return useContext(ThemeContext);
}
