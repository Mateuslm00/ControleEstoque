/** @type {import('tailwindcss').Config} */
export default {
  // Onde o Tailwind deve procurar classes usadas, para gerar só o CSS necessário.
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
