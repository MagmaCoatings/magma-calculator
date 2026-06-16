import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand - sampled from Magma logo
        molten: {
          DEFAULT: '#F58E25',
          ink: '#C97210',
          tint: '#FEF3E2',
        },
        // Mineral neutrals
        basalt: '#211F1D',
        ink: '#3A3833',
        stone: '#6F6B64',
        ash: '#A8A39B',
        line: {
          DEFAULT: '#E4DFD7',
          soft: '#F0ECE4',
        },
        bone: '#FBFAF7',
        limestone: '#ECE8E1',
        // Semantic
        sage: {
          DEFAULT: '#5F6B57',
          tint: '#EAEFE5',
        },
        danger: {
          DEFAULT: '#A33223',
          tint: '#F6E9E6',
        },
        // Legacy (for compatibility)
        magma: {
          DEFAULT: '#F58E25',
          dark: '#C97210',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '12px',
        'control': '9px',
      },
    },
  },
  plugins: [],
} satisfies Config
