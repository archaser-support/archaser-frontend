import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        include: ["test/unit/scheduling/**/*.test.{ts,tsx}"],
        setupFiles: [],
        pool: "forks",
        testTimeout: 10000, // 10 second timeout
        hookTimeout: 10000, // 10 second timeout for hooks
    },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL('./', import.meta.url)),
        },
    },
});
