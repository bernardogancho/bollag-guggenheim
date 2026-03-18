module.exports = {
  content: [
    "./src/**/*.{njk,html,md,js}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#050505",
        bone: "#FAF8F6",
        smoke: "#b8b2aa"
      },
      fontFamily: {
        display: ["Bodoni 72", "Didot", "Times New Roman", "serif"],
        sans: ["Helvetica Neue", "Arial", "sans-serif"]
      },
      letterSpacing: {
        manifesto: "0.28em"
      },
      boxShadow: {
        veil: "0 24px 80px rgba(0, 0, 0, 0.45)"
      }
    }
  },
  plugins: []
};
