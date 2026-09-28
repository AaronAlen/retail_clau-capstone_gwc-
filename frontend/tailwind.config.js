/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["class", "[data-theme='dark']"],
  theme: {
    extend: {
      colors: {
        sandal: {
          50: "#FAF6F0",
          100: "#F5EDE0",
          200: "#EBDDC7",
          300: "#E0CCA8",
          400: "#D4B886",
          500: "#C49F60",
          600: "#A87F3D",
          700: "#866029",
          800: "#65451B",
          900: "#442D11",
        },
        sandle: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        luxury: {
          950: "#090714",
          900: "#0f0c20",
          850: "#15112c",
          800: "#1c1739",
          700: "#28214f",
          600: "#372d6b",
        },
        brand: {
          blue: "#6366f1",
          violet: "#8b5cf6",
          purple: "#7c3aed",
          orange: "#f59e0b",
          amber: "#d97706",
          pink: "#ec4899",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
