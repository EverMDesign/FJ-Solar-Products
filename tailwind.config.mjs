/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0b1220',
          800: '#101a2e',
          700: '#182643',
        },
        solar: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        fj: {
          navy: '#060E1A',
          'navy-deep': '#172636',
          green: '#54876C',
          'green-deep': '#546A61',
          cream: '#F3EBDD',
          sand: '#E7DBC3',
          gold: '#EBAF16',
        },
        banner: {
          blue: '#2563EB',
          amber: '#F5A623',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Montserrat', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
