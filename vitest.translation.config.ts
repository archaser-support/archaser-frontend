import path from "path";

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        include: ["../tests/frontend/unit/translation/**/*.test.ts"],
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
        },
    },
});
