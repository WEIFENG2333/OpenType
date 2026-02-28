/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        surface: {
          0: '#ffffff',
          50: '#faf8f5',   // warm beige sidebar
          100: '#f5f3f0',
          200: '#e8e5e1',
          300: '#d4d1cd',
          400: '#a8a5a0',
          500: '#78756f',
          600: '#57544e',
          700: '#3d3a36',
          800: '#282624',
          850: '#201e1c',
          900: '#181715',
          950: '#0c0b0a',
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        'wave-1': 'wave 0.8s ease-in-out infinite',
        'wave-2': 'wave 0.8s ease-in-out 0.1s infinite',
        'wave-3': 'wave 0.8s ease-in-out 0.2s infinite',
        'wave-4': 'wave 0.8s ease-in-out 0.3s infinite',
        'wave-5': 'wave 0.8s ease-in-out 0.4s infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.8' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        wave: {
          '0%, 100%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1.2)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
