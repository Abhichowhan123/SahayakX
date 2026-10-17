// ─── Theme ────────────────────────────────────────────────────────────────────
// Premium dark-and-lime marketplace palette per design_guidelines.json.
// Obsidian surfaces (#121316, #1A1C23) with electric lime (#84CC16) accents.
// Zero blue/purple hues.
export type ThemeName = 'light' | 'dark';

export interface ThemeColors {
  primary:        string;
  primaryDark:    string;
  primaryLight:   string;
  background:     string;
  surface:        string;
  white:          string;
  black:          string;
  textPrimary:    string;
  textSecondary:  string;
  textMuted:      string;
  border:         string;
  error:          string;
  success:        string;
  warning:        string;
  cardBg:         string;
  inputBg:        string;
  shadow:         string;
}

const lime = '#84CC16';
const limeDark = '#65A30D';

export const LIGHT_THEME: ThemeColors = {
  primary:        lime,
  primaryDark:    limeDark,
  primaryLight:   '#A3E635',
  background:     '#F4F5F7',
  surface:        '#FFFFFF',
  white:          '#FFFFFF',
  black:          '#121316',
  textPrimary:    '#121316',
  textSecondary:  '#9BA1AF',
  textMuted:      '#6B7280',
  border:         '#272A35',
  error:          '#EF4444',
  success:        '#22C55E',
  warning:        '#F59E0B',
  cardBg:         '#FFFFFF',
  inputBg:        '#1A1C23',
  shadow:         '#000000',
};

export const DARK_THEME: ThemeColors = {
  primary:        lime,
  primaryDark:    limeDark,
  primaryLight:   '#A3E635',
  background:     '#121316',
  surface:        '#1A1C23',
  white:          '#FFFFFF',
  black:          '#121316',
  textPrimary:    '#F4F5F7',
  textSecondary:  '#9BA1AF',
  textMuted:      '#6B7280',
  border:         '#272A35',
  error:          '#EF4444',
  success:        '#22C55E',
  warning:        '#F59E0B',
  cardBg:         '#1A1C23',
  inputBg:        '#252833',
  shadow:         '#000000',
};

export const THEMES: Record<ThemeName, ThemeColors> = {
  light: LIGHT_THEME,
  dark:  DARK_THEME,
};
