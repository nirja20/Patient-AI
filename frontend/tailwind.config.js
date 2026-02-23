/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Poppins", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#ecf4ff",
          100: "#dbeaff",
          200: "#bddcff",
          300: "#8ac2ff",
          400: "#529fff",
          500: "#2d7eff",
          600: "#1f60f0",
          700: "#1a4bcd",
          800: "#1c3f9f",
          900: "#1d377d",
        },
      },
      boxShadow: {
        glass: "0 16px 45px rgba(10, 19, 55, 0.35)",
      },
    },
  },
  plugins: [],
};
