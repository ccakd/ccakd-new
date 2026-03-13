/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Noto Serif SC"', '"Noto Serif TC"', 'Georgia', 'serif'],
        body: ['Roboto', 'system-ui', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: '#D04830',
          hover: '#B83D28',
          bg: '#FEF2F0',
        },
        porcelain: {
          text: '#1D1D1F',
          secondary: '#6E6E73',
          tertiary: '#999999',
          border: '#E8E8ED',
          section: '#F5F5F7',
          blue: '#2D6CB4',
          'blue-light': '#EDF3FA',
        },
      },
      borderRadius: {
        pill: '30px',
      },
    },
  },
  plugins: [],
};
