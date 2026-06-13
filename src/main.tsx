import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from '@emotion/react'
import { createTheme } from '@mui/material'

// ── WYRDWYRKS palette ──────────────────────────────────────
const palette = {
  bg:        '#060504',
  bgPanel:   '#0e0b08',
  bgCard:    '#12100d',
  border:    '#2a2218',
  amber:     '#ff6a00',
  amberDim:  '#b84a00',
  amberGlow: 'rgba(255, 106, 0, 0.18)',
  cyan:      '#00e5ff',
  cyanDim:   '#0099b8',
  cyanGlow:  'rgba(0, 229, 255, 0.12)',
  red:       '#ff2d2d',
  text:      '#e8dcc8',
  textDim:   '#7a6e5f',
  textMuted: '#3d342a',
};

const fontMono = "'Share Tech Mono', monospace";
const fontHead = "'Barlow Condensed', sans-serif";
const fontBody = "'Rajdhani', sans-serif";

// Chamfered (cut-corner) clip used on the landing-page buttons.
const chamfer =
  'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))';

const headingBase = {
  fontFamily: fontHead,
  fontWeight: 900,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  lineHeight: 1.1,
  color: palette.text,
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary:   { main: palette.amber, dark: palette.amberDim, contrastText: palette.bg },
    secondary: { main: palette.cyan,  dark: palette.cyanDim,  contrastText: palette.bg },
    error:     { main: palette.red },
    background: { default: palette.bg, paper: palette.bgCard },
    divider: palette.border,
    text: { primary: palette.text, secondary: palette.textDim, disabled: palette.textMuted },
  },
  shape: { borderRadius: 0 },
  typography: {
    fontFamily: fontBody,
    fontSize: 16,
    h1: { ...headingBase, fontSize: 'clamp(2.8rem, 8vw, 6rem)' },
    h2: { ...headingBase, fontSize: 'clamp(1.8rem, 4vw, 3rem)' },
    h3: { ...headingBase, fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)' },
    h4: { ...headingBase },
    h5: { ...headingBase },
    h6: { ...headingBase, fontWeight: 700 },
    button: { fontFamily: fontHead, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' },
    caption: { fontFamily: fontMono, letterSpacing: '0.1em' },
    overline: { fontFamily: fontMono, letterSpacing: '0.15em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: palette.bg,
          color: palette.text,
          fontFamily: fontBody,
          // Scanline overlay
          '&::before': {
            content: '""',
            position: 'fixed',
            inset: 0,
            background:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px)',
            pointerEvents: 'none',
            zIndex: 9999,
          },
          // Subtle film-grain noise
          '&::after': {
            content: '""',
            position: 'fixed',
            inset: 0,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
            pointerEvents: 'none',
            zIndex: 9998,
            opacity: 0.4,
          },
        },
        '::selection': { background: palette.amber, color: palette.bg },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          fontFamily: fontHead,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          padding: '0.6em 1.8em',
          transition: 'all 0.2s',
        },
        contained: {
          clipPath: chamfer,
          '&:hover': { boxShadow: `0 0 30px ${palette.amberGlow}`, transform: 'translateY(-1px)' },
        },
        containedPrimary: { '&:hover': { backgroundColor: '#ff8c33' } },
        outlined: {
          clipPath: chamfer,
          borderColor: palette.cyanDim,
          color: palette.cyan,
          '&:hover': {
            borderColor: palette.cyan,
            backgroundColor: palette.cyanGlow,
            boxShadow: `0 0 20px ${palette.cyanGlow}`,
          },
        },
        text: { '&:hover': { backgroundColor: palette.amberGlow } },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: palette.bgCard,
          backgroundImage: 'none',
          border: `1px solid ${palette.border}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: palette.bgCard,
          border: `1px solid ${palette.border}`,
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '2px',
            background: `linear-gradient(90deg, ${palette.amber}, ${palette.cyan}, transparent)`,
          },
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        title: { ...headingBase, fontSize: '1.8rem' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: fontMono,
          letterSpacing: '0.05em',
          borderRadius: 0,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { backgroundColor: palette.amber, height: '2px' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: fontMono,
          fontSize: '0.78rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: palette.textDim,
          '&.Mui-selected': { color: palette.amber },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          fontFamily: fontMono,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: palette.border },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: palette.amberDim },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: palette.amber },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontFamily: fontMono,
          letterSpacing: '0.08em',
          '&.Mui-focused': { color: palette.amber },
        },
      },
    },
    MuiStepLabel: {
      styleOverrides: {
        label: {
          fontFamily: fontHead,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        },
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: {
          color: palette.border,
          '&.Mui-active': { color: palette.amber },
          '&.Mui-completed': { color: palette.cyan },
        },
      },
    },
    MuiStepConnector: {
      styleOverrides: {
        line: { borderColor: palette.border },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: palette.border } },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: { '&.Mui-checked': { color: palette.amber } },
        track: { '.Mui-checked.Mui-checked + &': { backgroundColor: palette.amberDim } },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: { color: palette.textDim, '&.Mui-checked': { color: palette.amber } },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: palette.border },
        bar: { backgroundColor: palette.amber },
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        root: { transition: 'none' },
        circle: { color: palette.amber },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontFamily: fontMono,
          backgroundColor: palette.bgPanel,
          border: `1px solid ${palette.border}`,
          color: palette.text,
          letterSpacing: '0.05em',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { fontFamily: fontMono, borderRadius: 0 },
      },
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
