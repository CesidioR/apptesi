/** @type {import('tailwindcss').Config} */
// Fonte unica dei colori: colors.json (condiviso con l'app via src/theme.ts).
// Per cambiare palette, modifica SOLO colors.json.
const colors = require("./colors.json");

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors,
    },
  },
  plugins: [],
};
