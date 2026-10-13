import { DarkTheme, type Theme } from 'expo-router';

export const colors = {
  bg: '#0B0D10',
  surface: '#15181D',
  surfaceRaised: '#1D2128',
  input: '#232831',
  border: '#2A3039',
  text: '#F2F4F7',
  textDim: '#A1AAB8',
  textFaint: '#6B7482',
  accent: '#4C8DFF',
  accentDim: '#1C3157',
  success: '#2BD67B',
  successDim: '#123A27',
  danger: '#FF5C5F',
  dangerDim: '#3D1718',
  warning: '#F5A524',
  gold: '#FFC53D',
  goldDim: '#3A2E10',
  purple: '#A78BFA',
  strava: '#FC4C02',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** Minimum size for anything tappable during a workout. */
export const TOUCH = 48;

export const font = {
  title: { fontSize: 28, fontWeight: '800' as const, color: colors.text },
  heading: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  subheading: { fontSize: 16, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  small: { fontSize: 14, color: colors.textDim },
  tiny: { fontSize: 12, color: colors.textFaint },
};

export const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
};

export const SET_TYPE_COLOR = {
  warmup: colors.warning,
  normal: colors.textDim,
  drop: colors.purple,
  failure: colors.danger,
} as const;
