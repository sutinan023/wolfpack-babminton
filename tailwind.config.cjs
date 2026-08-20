/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html','./assets/js/**/*.js'],
  theme: {
    extend: {
      colors: { club: { 50:'#edf7f1', 100:'#d9eee1', 700:'#1b6b42', 800:'#165c38', 900:'#10472c' } },
      fontFamily: { sans:['Segoe UI','Noto Sans Thai','Leelawadee UI','Tahoma','sans-serif'] }
    }
  },
  plugins: []
};
