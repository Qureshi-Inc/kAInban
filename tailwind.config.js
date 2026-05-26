/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
    './index.html'
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))'
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))'
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))'
        }
      },
      /*
       * v3 radius scale. The previous default ('--radius') was 0.75rem (12px),
       * which got applied via Tailwind utilities like 'rounded-lg' and
       * 'rounded-xl' everywhere — too bubbly per DESIGN.md. v3 caps at 12px
       * for modals, 8px for containers, 6px default, 4px for chips.
       */
      borderRadius: {
        none: '0',
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '12px',
        '3xl': '14px',
        full: '9999px'
      },
      /*
       * v3 font stack. The primary sans is Inter Variable; the editorial
       * accent serif is Instrument Serif (used only on AI-output surfaces);
       * mono is JetBrains Mono. Apply globally via Tailwind's `font-sans`,
       * `font-serif`, `font-mono` utilities. Components that want the
       * editorial moment use `font-serif` explicitly per DESIGN.md.
       */
      fontFamily: {
        sans: [
          'Inter Variable',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif'
        ],
        serif: [
          '"Instrument Serif"',
          '"Iowan Old Style"',
          'Palatino',
          'Georgia',
          'serif'
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          '"SF Mono"',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace'
        ]
      },
      /*
       * v3 type scale. Tighter than Tailwind defaults — productivity tools
       * live dense per DESIGN.md. The pairs are [size, { lineHeight, letterSpacing }].
       *   xs:    11px → captions, meta
       *   sm:    12px → UI labels, buttons
       *   base:  14px → body
       *   lg:    16px → emphasized body
       *   xl:    18px → small headings
       *   2xl:   22px → section headings
       *   3xl:   28px → page headings
       *   4xl:   36px → display
       *   5xl:   48px → hero
       */
      fontSize: {
        xs: ['11px', { lineHeight: '1.4', letterSpacing: '0.02em' }],
        sm: ['12px', { lineHeight: '1.45' }],
        base: ['14px', { lineHeight: '1.55' }],
        lg: ['16px', { lineHeight: '1.5' }],
        xl: ['18px', { lineHeight: '1.4', letterSpacing: '-0.01em' }],
        '2xl': ['22px', { lineHeight: '1.3', letterSpacing: '-0.015em' }],
        '3xl': ['28px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        '4xl': ['36px', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
        '5xl': ['48px', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        '6xl': ['60px', { lineHeight: '1', letterSpacing: '-0.03em' }],
        '7xl': ['72px', { lineHeight: '1', letterSpacing: '-0.035em' }]
      },
      /*
       * v3 font weight. font-bold (700) is too heavy with Inter Variable +
       * the cv01/ss03 features; we want the engineered feel of weight 510
       * (Linear's signature). Remap font-bold and font-semibold downward.
       * Components that explicitly want the heavy weight can use font-black.
       */
      fontWeight: {
        thin: '100',
        extralight: '200',
        light: '300',
        normal: '400',
        medium: '510',
        semibold: '510',
        bold: '600',
        extrabold: '700',
        black: '800'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' }
        },
        'slide-in': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' }
        },
        'ai-border-pulse': {
          '0%, 100%': { borderColor: 'var(--accent-border)' },
          '50%': { borderColor: 'var(--accent-color)' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'ai-border-pulse':
          'ai-border-pulse 1.6s cubic-bezier(0.16, 1, 0.3, 1) infinite'
      },
      transitionTimingFunction: {
        v3: 'cubic-bezier(0.16, 1, 0.3, 1)'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
