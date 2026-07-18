/**
 * DBLABS — Tailwind preset
 *
 * Usage:
 *   // tailwind.config.js
 *   module.exports = {
 *     presets: [require('./dblabs-brand-kit/tailwind.config.js')],
 *     content: ['./src/**\/*.{html,js,jsx,ts,tsx}'],
 *   };
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        'db-bg':       '#FAF4DC',
        'db-bg-alt':   '#F2EAC9',
        'db-ink':      '#0E0E0E',
        'db-ink-soft': '#2A2A2A',
        'db-mute':     '#6B6757',
        'db-line':     '#0E0E0E',
        'db-lime':     '#C7F23E',
        'db-coral':    '#E8675F',
        'db-honey':    '#F2B829',
        'db-cobalt':   '#2444FF',
        'db-forest':   '#1F6B45',
        'app-villain': '#E8675F',
        'app-scout':   '#1F6B45',
        'app-debt':    '#F2B829',
        'app-arena':   '#2444FF',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Archivo', 'system-ui', 'sans-serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'db-xs':  '12px',
        'db-sm':  '14px',
        'db-md':  '16px',
        'db-lg':  '20px',
        'db-xl':  '28px',
        'db-2xl': '40px',
        'db-3xl': '56px',
        'db-4xl': '76px',
      },
      borderRadius: {
        'db-xs':   '6px',
        'db-sm':   '10px',
        'db-md':   '16px',
        'db-lg':   '24px',
      },
      borderWidth: {
        'db': '2.5px',
      },
      boxShadow: {
        'soft':  '3px 3px 0 #0E0E0E',
        'hard':  '5px 5px 0 #0E0E0E',
        'press': '2px 2px 0 #0E0E0E',
      },
      letterSpacing: {
        'db-tight': '-0.02em',
        'db-mono':  '0.08em',
      },
      transitionTimingFunction: {
        'db': 'cubic-bezier(0.2, 0.7, 0.1, 1)',
      },
    },
  },
  plugins: [],
};
