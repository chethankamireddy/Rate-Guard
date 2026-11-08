/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#090A0F',
        card: '#11131A',
        'card-border': '#1F2430',
        primary: {
          DEFAULT: '#6366F1', // Indigo
          hover: '#4F46E5',
          light: '#818CF8',
        },
        accent: {
          cyan: '#06B6D4',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#F43F5E',
          purple: '#8B5CF6',
        },
      },
    },
  },
  plugins: [],
}
