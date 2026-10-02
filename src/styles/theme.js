// src/styles/theme.js
//
// Carlos Shop design system. The visual direction is inspired by the Aurora
// MUI template (flat tinted surfaces, generous radii, Plus Jakarta Sans), but
// every value here is our own; no template code or assets are used.
import { alpha, createTheme } from '@mui/material/styles';

const ink = '#1B2124';
const muted = '#5B6670';
const line = '#E4E9F0';
const neutral = '#F5F7FA'; // tinted surface for cards, tiles, table heads
const neutralDeep = '#EBF0F5';

// One radius everywhere, taken from the Curated Picks cards: 12px for cards
// and surfaces (sx `borderRadius: 1`), 8px for controls and images inside them.
export const RADIUS = 12;
export const CONTROL_RADIUS = 8;

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2F7CF6',
      dark: '#1D5FCC',
      light: '#E7F0FE',
      contrastText: '#fff',
    },
    secondary: {
      main: '#13A26B',
      dark: '#0C7C51',
      light: '#E3F6EE',
      contrastText: '#fff',
    },
    success: { main: '#12A150', light: '#E3F6EA' },
    warning: { main: '#F27A1A', light: '#FEF0E3' },
    error: { main: '#E5484D', light: '#FDECEC' },
    info: { main: '#2F7CF6', light: '#E7F0FE' },
    text: { primary: ink, secondary: muted, disabled: '#A3ACB5' },
    divider: line,
    background: { default: '#FFFFFF', paper: '#FFFFFF', neutral, neutralDeep },
    promo: { main: '#FFF1E6', text: '#7A3C0A', accent: '#F27A1A' },
  },
  shape: { borderRadius: RADIUS },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Segoe UI", Roboto, Arial, sans-serif',
    h1: { fontWeight: 700, fontSize: '2.5rem', letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.015em' },
    h3: { fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.01em' },
    h4: { fontWeight: 700, fontSize: '1.375rem' },
    h5: { fontWeight: 700, fontSize: '1.125rem' },
    h6: { fontWeight: 700, fontSize: '1rem' },
    subtitle1: { fontWeight: 600, fontSize: '1rem' },
    subtitle2: { fontWeight: 600, fontSize: '0.875rem' },
    body1: { fontSize: '0.95rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.55 },
    caption: { fontSize: '0.75rem', color: muted },
    overline: { fontWeight: 600, letterSpacing: '0.08em', fontSize: '0.7rem' },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#FFFFFF',
          color: ink,
          fontVariantNumeric: 'tabular-nums',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        // One height per size across the shop and back office:
        // small 32px (cards, tables), medium 40px (default), large 48px
        // (the main action of a page, e.g. Checkout or Place order).
        root: {
          borderRadius: CONTROL_RADIUS,
          paddingInline: 16,
          whiteSpace: 'nowrap',
        },
        sizeSmall: { height: 32, paddingInline: 12, fontSize: '0.8125rem' },
        sizeMedium: { height: 40, fontSize: '0.875rem' },
        sizeLarge: { height: 48, paddingInline: 22, fontSize: '0.95rem' },
        outlined: { borderColor: line },
      },
    },
    // Gap-based spacing, so a Grid inside a Stack keeps its negative margins.
    MuiStack: {
      defaultProps: { useFlexGap: true },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 999 } },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        rounded: { borderRadius: RADIUS },
        outlined: { borderColor: line },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { borderRadius: RADIUS, backgroundColor: neutral },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 600 },
        sizeSmall: { height: 22, fontSize: '0.72rem' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: CONTROL_RADIUS,
          backgroundColor: '#fff',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: line },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: line },
        head: {
          backgroundColor: neutral,
          color: muted,
          fontWeight: 600,
          fontSize: '0.8rem',
        },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: RADIUS } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: ink, fontSize: '0.75rem', borderRadius: 6 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, minHeight: 44 },
      },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: CONTROL_RADIUS } },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 99, backgroundColor: alpha(ink, 0.08) },
      },
    },
  },
});

export default theme;
