// ─── Design tokens (ServeEase — light + dark palettes) ─────────────────────────
// Obsidian surfaces + electric lime accent. Zero blue/purple.

export const COLORS = {
  // Dark theme
  bg:              '#121317',
  surface:         '#1B1C22',
  surfaceBorder:   '#2A2B33',
  accent:          '#95C93D',
  accentDarkText:  '#101114',
  accentLabel:     '#3F5A14',
  accentTile:      '#232B14',
  textPrimary:     '#FFFFFF',
  textSecondary:   '#9A9CA8',
  iconInactive:    '#A0A2AE',
  tileNeutral:     '#262830',
  danger:          '#E5484D',
  // Service icon colors (always on accent-tile background)
  iconCleaning:    '#95C93D',
  iconAcRepair:    '#4FB3F5',
  iconPlumbing:    '#F0A23C',
  iconGarden:      '#5FBF6A',
  starIcon:        '#9A9CA8',
  // Light theme (cream)
  lightBg:         '#F5F3EE',
  lightSurface:    '#FFFFFF',
  lightSurfaceBorder: '#E5E7EB',
  lightTextPrimary: '#1A1A1A',
  lightTextSecondary: '#6B7280',
  lightIconInactive: '#9CA3AF',
  lightTileNeutral: '#F3F4F6',
};

export const FONT_SIZE = {
  screenTitle:   34,
  sectionTitle:  24,
  eyebrow:       14,
  labelLimeCard: 14,
  bigAmount:     44,
  cardTitle:     17,
  body:          14,
  sectionHelper: 15,
  bottomNavLabel: 13,
  statusPill:    16,
  phone:         16,
  verifiedText:  14,
} as const;

export const FONT_WEIGHT = {
  screenTitle:   '800',
  sectionTitle:  '800',
  eyebrow:       '800',
  labelLimeCard: '800',
  bigAmount:     '900',
  cardTitle:     '700',
  body:          '400',
  sectionHelper: '400',
  bottomNavLabel:'700',
  statusPill:    '700',
  verifiedText:  '700',
} as const;

export const RADIUS = {
  bigCard:    32,
  normalCard: 24,
  searchBar:  20,
  iconTile:   18,
  iconTileBig: 22,
  button:     20,
  statusPill: 9999,
  pill:       9999,
  bottomNav:  28,
  avatar:     30,
};

export const SPACING = {
  screenH:  18,
  blockGap: 18,
};

export const FONT_FAMILY = 'System';

// ─── Theme palettes ───────────────────────────────────────────────────────────
export type ThemeName = 'light' | 'dark';

export interface ThemeColors {
  primary:        string;
  primaryDark:    string;
  primaryLight:   string;
  accentTile:     string;
  background:     string;
  surface:        string;
  surfaceSecondary: string;
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

const DARK: ThemeColors = {
  primary:        COLORS.accent,
  primaryDark:    '#6B8A2E',
  primaryLight:   '#B8D96E',
  accentTile:     COLORS.accentTile,
  background:     COLORS.bg,
  surface:        COLORS.surface,
  surfaceSecondary: COLORS.surface,
  white:          COLORS.textPrimary,
  black:          COLORS.accentDarkText,
  textPrimary:    COLORS.textPrimary,
  textSecondary:  COLORS.textSecondary,
  textMuted:      COLORS.iconInactive,
  border:         COLORS.surfaceBorder,
  error:          COLORS.danger,
  success:        COLORS.accent,
  warning:        COLORS.iconPlumbing,
  cardBg:         COLORS.surface,
  inputBg:        COLORS.surface,
  shadow:         'transparent',
};

const LIGHT: ThemeColors = {
  primary:        COLORS.accent,
  primaryDark:    '#6B8A2E',
  primaryLight:   '#B8D96E',
  accentTile:     COLORS.accentTile,
  background:     COLORS.lightBg,
  surface:        COLORS.lightSurface,
  surfaceSecondary: COLORS.lightSurface,
  white:          COLORS.lightTextPrimary,
  black:          COLORS.accentDarkText,
  textPrimary:    COLORS.lightTextPrimary,
  textSecondary:  COLORS.lightTextSecondary,
  textMuted:      COLORS.lightIconInactive,
  border:         COLORS.lightSurfaceBorder,
  error:          COLORS.danger,
  success:        COLORS.accent,
  warning:        COLORS.iconPlumbing,
  cardBg:         COLORS.lightSurface,
  inputBg:        COLORS.lightTileNeutral,
  shadow:         '#000000',
};

export const THEMES: Record<ThemeName, ThemeColors> = {
  light: LIGHT,
  dark:  DARK,
};

// Module-level stylesheet default (dark). Dynamic per-component styling uses
// `themeColors` from useTheme() which follows the light/dark toggle.
export const colors = DARK;
