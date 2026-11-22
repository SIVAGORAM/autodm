import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import nextPlugin from "@next/eslint-plugin-next";

// Flat config built on the packages actually installed
// (@typescript-eslint/parser + /eslint-plugin), avoiding the
// `typescript-eslint` umbrella package which conflicts with them.
// The Next.js plugin's recommended + core-web-vitals rules are layered
// on top so `next build` detects the plugin and Next-specific lint
// coverage is in force.
export default [
  { ignores: [".next/**", ".next-dev/**", "node_modules/**", "next-env.d.ts", "public/**"] },
  // Keep the Next plugin visible in the flat-config baseline so both the
  // Next build integration and standalone ESLint detect it consistently.
  { plugins: { "@next/next": nextPlugin } },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "no-undef": "off", // TypeScript handles symbol resolution
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];
