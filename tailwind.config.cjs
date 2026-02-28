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
          50: '#f2f1f0',   // neutral gray sidebar
          100: '#eae9e8',
          200: '#dddcdb',
          300: '#c8c7c5',
          400: '#a3a1a0',
          500: '#787674',
          600: '#575553',
          700: '#3d3b3a',
          800: '#282726',
          850: '#201f1e',
          900: '#181716',
          950: '#0c0b0b',
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
