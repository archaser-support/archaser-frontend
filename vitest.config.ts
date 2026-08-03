import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "node",
        globals: true,
        setupFiles: ["../tests/frontend/setup/vitest.setup.ts"],
        // Increase timeouts for unit tests with database operations
        testTimeout: 30000, // 30 seconds for test execution
        hookTimeout: 30000, // 30 seconds for hooks (beforeEach, afterEach)
        include: ["../tests/frontend/unit/**/*.test.ts", "../tests/frontend/unit/**/*.test.tsx"],
        // Use jsdom environment for React component tests
        environmentMatchGlobs: [
            ["**/*.test.tsx", "jsdom"],
            ["**/*.test.ts", "node"],
        ],
        exclude: [
            "../tests/frontend/e2e/**/*",
            "../tests/frontend/**/*.spec.ts",
            "**/node_modules/**",
            "**/dist/**",
            "**/.next/**",
        ],
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, './'),
            "@/app": path.resolve(__dirname, './app'),
            "@/components": path.resolve(__dirname, './components'),
            "@/shared": path.resolve(__dirname, './shared'),
            "@/lib": path.resolve(__dirname, './lib'),
            "@/utils": path.resolve(__dirname, './utils'),
            "@/server": path.resolve(__dirname, './server'),
            "@/types": path.resolve(__dirname, './types'),
            "@/test": path.resolve(__dirname, "../tests/frontend"),
        },
    },
    optimizeDeps: {
        include: ["vitest"],
    },
});
