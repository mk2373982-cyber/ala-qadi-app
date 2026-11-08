/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effcf6',
          100: '#d9f8e7',
          200: '#b1efcf',
          300: '#7de1af',
          400: '#3ccd8c',
          500: '#16b875',
          600: '#0b9c61',
          700: '#087c50',
          800: '#096341',
          900: '#084d37',
        },
      },
    },
  },
  plugins: [],
}
