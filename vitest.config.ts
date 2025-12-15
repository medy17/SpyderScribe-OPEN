/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./src/__tests__/setup.ts"],
        include: ["src/**/*.{test,spec}.{ts,tsx}"],

        silent: true,

        reporters: ["./src/__tests__/pretty-reporter.ts"],

        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            include: ["src/**/*.{ts,tsx}"],
            exclude: [
                "src/**/*.test.{ts,tsx}",
                "src/__tests__/**",
                "src/main.tsx",
                "src/App.tsx",
                "src/vite-env.d.ts",
                "src/components/ui/**",
            ],
            thresholds: {
                lines: 80,
                branches: 70,
                functions: 80,
                statements: 80,
            },
        },
    },
});