import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Load .env so integration tests and app code (e.g. lib/prisma) use the same DATABASE_URL
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({
    path: path.resolve(__dirname, "../backend/.env"),
    override: false,
});
if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
        "postgresql://postgres:password@localhost:5432/archaser_test";
}

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "jsdom",
        setupFiles: ["./test/setup/vitest.integration.setup.ts"],
        globals: true,
        css: true,
        env: {
            NODE_ENV: "test",
        },
        // Include integration test files
        include: [
            "test/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
        ],
        // Exclude e2e tests and other test types
        exclude: [
            "test/e2e/**/*",
            "test/**/*.spec.ts", // Exclude Playwright spec files
            "**/node_modules/**",
            "**/dist/**",
            "**/.next/**",
        ],
    },
    esbuild: {
        target: "esnext",
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
    // Optimize for Next.js
    optimizeDeps: {
        include: ["react", "react-dom"],
    },
    // Handle CSS and static assets
    css: {
        modules: {
            localsConvention: "camelCase",
        },
    },
});
