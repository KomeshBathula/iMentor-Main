// tailwind.config.js
import forms from '@tailwindcss/forms';
import scrollbar from 'tailwind-scrollbar';
import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  safelist: [
    'prose',
    'prose-sm',
    'dark:prose-invert',
  ],
  theme: {
    extend: {
      colors: {
        // ── VS Code Dark Mode shell palette ─────────────────────────────────
        // Named to match VS Code source tokens — colorblind-safe (gray-only shell).
        'vs-bg':        '#1e1e1e',   // editor canvas
        'vs-sidebar':   '#252526',   // sidebar / activity bar bg
        'vs-panel':     '#2d2d2d',   // terminal / bottom panel
        'vs-surface':   '#333333',   // card / raised surface
        'vs-surface-hi':'#3a3a3a',   // hover state on cards
        'vs-border':    '#3c3c3c',   // default border
        'vs-border-hi': '#505050',   // focused / active border
        'vs-text':      '#cccccc',   // primary text
        'vs-text-lo':   '#999999',   // secondary text
        'vs-text-dim':  '#666666',   // placeholders, disabled

        // ── Legacy aliases (keep for backward compat in existing components) ─
        'primary':   { light: '#cccccc', DEFAULT: '#1e1e1e', dark: '#1e1e1e' },
        'secondary': { light: '#999999', DEFAULT: '#505050', dark: '#333333' },
        'accent': '#cccccc',

        'background-dark':  '#1e1e1e',
        'surface-dark':     '#252526',
        'border-dark':      '#3c3c3c',
        'text-dark':        '#cccccc',
        'text-muted-dark':  '#999999',

        'background-light': '#f5f5f5',
        'surface-light':    '#f0f0f0',
        'border-light':     '#d0d0d0',
        'text-light':       '#1e1e1e',
        'text-muted-light': '#555555',

        'deep-midnight': '#1e1e1e',
        black: '#000000',
        white: '#ffffff',

        // VS Code syntax tokens — used only inside code/content, not shell
        'vscode': {
          bg:        '#1e1e1e',
          sidebar:   '#252526',
          panel:     '#2d2d2d',
          selection: '#264f78',
          border:    '#3c3c3c',
          blue:      '#569cd6',
          cyan:      '#4ec9b0',
          green:     '#6a9955',
          orange:    '#ce9178',
          purple:    '#c586c0',
          yellow:    '#dcdcaa',
          red:       '#f48771',
          text:      '#cccccc',
          textMuted: '#858585',
        },
      },

      fontFamily: {
        // Inter for UI — professional, excellent legibility at all sizes
        sans: ['"Inter var"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        // JetBrains Mono for code — VS Code's editor font
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },

      fontSize: {
        // All sizes in rem — scales with --font-base on <html>
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        'xs':  ['0.75rem',   { lineHeight: '1.125rem' }],
        'sm':  ['0.8125rem', { lineHeight: '1.25rem' }],
        'base':['0.9375rem', { lineHeight: '1.5rem' }],
        'md':  ['1rem',      { lineHeight: '1.5rem' }],
        'lg':  ['1.0625rem', { lineHeight: '1.625rem' }],
        'xl':  ['1.1875rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.375rem',  { lineHeight: '2rem' }],
        '3xl': ['1.625rem',  { lineHeight: '2.25rem' }],
        '4xl': ['2rem',      { lineHeight: '2.5rem' }],
        '5xl': ['2.5rem',    { lineHeight: '3rem' }],
        '6xl': ['3rem',      { lineHeight: '3.5rem' }],
      },

      spacing: {
        // Compact token set matching VS Code's 4px grid
        'px': '1px',
        '0.5': '2px',
        '1':   '4px',
        '1.5': '6px',
        '2':   '8px',
        '2.5': '10px',
        '3':   '12px',
        '3.5': '14px',
        '4':   '16px',
        '5':   '20px',
        '6':   '24px',
        '7':   '28px',
        '8':   '32px',
        '9':   '36px',
        '10':  '40px',
        '12':  '48px',
        '14':  '56px',
        '16':  '64px',
        '20':  '80px',
        '24':  '96px',
      },

      boxShadow: {
        'vs':      '0 2px 8px rgba(0,0,0,0.4)',
        'vs-lg':   '0 4px 20px rgba(0,0,0,0.6)',
        'vs-inset':'inset 0 1px 0 rgba(255,255,255,0.04)',
        // Legacy names kept
        'main':        '0 2px 8px rgba(0,0,0,0.4)',
        'panel':       '0 4px 20px rgba(0,0,0,0.6)',
        'card-hover':  '0 2px 12px rgba(0,0,0,0.5)',
      },

      borderRadius: {
        'vs':    '3px',   // VS Code's default radius (very subtle)
        'sm':    '3px',
        'DEFAULT':'3px',
        'md':    '4px',
        'lg':    '6px',
        'xl':    '8px',
        '2xl':   '10px',
        'panel': '4px',
        'full':  '9999px',
      },

      keyframes: {
        fadeIn:         { '0%': { opacity:'0', transform:'translateY(4px)' },  '100%': { opacity:'1', transform:'translateY(0)' } },
        slideUp:        { '0%': { opacity:'0', transform:'translateY(8px)' },  '100%': { opacity:'1', transform:'translateY(0)' } },
        'motion-fade-in':     { '0%':{ opacity:'0' },                '100%':{ opacity:'1' } },
        'motion-fade-out':    { '0%':{ opacity:'1' },                '100%':{ opacity:'0' } },
        'motion-slide-up':    { '0%':{ opacity:'0', transform:'translateY(16px)' }, '100%':{ opacity:'1', transform:'translateY(0)' } },
        'motion-slide-up-sm': { '0%':{ opacity:'0', transform:'translateY(8px)'  }, '100%':{ opacity:'1', transform:'translateY(0)' } },
        'motion-slide-down':  { '0%':{ opacity:'0', transform:'translateY(-16px)' },'100%':{ opacity:'1', transform:'translateY(0)' } },
        'motion-slide-left':  { '0%':{ opacity:'0', transform:'translateX(32px)'  },'100%':{ opacity:'1', transform:'translateX(0)' } },
        'motion-slide-right': { '0%':{ opacity:'0', transform:'translateX(-32px)' },'100%':{ opacity:'1', transform:'translateX(0)' } },
        'motion-scale-in':    { '0%':{ opacity:'0', transform:'scale(0.92)' },   '100%':{ opacity:'1', transform:'scale(1)' } },
        'motion-scale-in-sm': { '0%':{ opacity:'0', transform:'scale(0.96)' },   '100%':{ opacity:'1', transform:'scale(1)' } },
        'motion-pop':         { '0%':{ opacity:'0', transform:'scale(0.6)'  },   '100%':{ opacity:'1', transform:'scale(1)' } },
        'motion-height-in':   { '0%':{ opacity:'0', maxHeight:'0' }, '100%':{ opacity:'1', maxHeight:'1000px' } },
        'motion-width-in':    { '0%':{ width:'0%' }, '100%':{ width:'100%' } },
        pulseDots:      { '0%,100%':{ opacity:'0.3', transform:'scale(0.8)' }, '50%':{ opacity:'1', transform:'scale(1)' } },
        shimmerSweep:   { '0%':{ transform:'translateX(-100%)' }, '100%':{ transform:'translateX(100%)' } },
        'caret-blink':  { '0%,70%,100%':{ opacity:'1' }, '20%,50%':{ opacity:'0' } },
      },

      animation: {
        fadeIn:                'fadeIn 0.25s ease-out forwards',
        slideUp:               'slideUp 0.3s ease-out forwards',
        'motion-fade-in':      'motion-fade-in 0.25s ease-out both',
        'motion-fade-out':     'motion-fade-out 0.2s ease-in both',
        'motion-slide-up':     'motion-slide-up 0.35s ease-out both',
        'motion-slide-up-sm':  'motion-slide-up-sm 0.25s ease-out both',
        'motion-slide-down':   'motion-slide-down 0.25s ease-out both',
        'motion-slide-left':   'motion-slide-left 0.4s ease-out both',
        'motion-slide-right':  'motion-slide-right 0.4s ease-out both',
        'motion-scale-in':     'motion-scale-in 0.25s ease-out both',
        'motion-scale-in-sm':  'motion-scale-in-sm 0.2s ease-out both',
        'motion-pop':          'motion-pop 0.25s cubic-bezier(0.175,0.885,0.32,1.275) both',
        'motion-height-in':    'motion-height-in 0.3s ease-out both',
        'motion-width-in':     'motion-width-in 0.3s ease-out both',
        pulseDot1:     'pulseDots 1.4s infinite 0s ease-in-out',
        pulseDot2:     'pulseDots 1.4s infinite 0.2s ease-in-out',
        pulseDot3:     'pulseDots 1.4s infinite 0.4s ease-in-out',
        shimmerSweep:  'shimmerSweep 1.5s linear infinite',
        'caret-blink': 'caret-blink 1.2s ease-out infinite',
      },
    },
  },
  plugins: [
    forms({ strategy: 'class' }),
    scrollbar({ nocompatible: true }),
    typography,
  ],
}
