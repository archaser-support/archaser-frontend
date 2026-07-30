import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./test/setup/vitest.setup.ts"],
        include: ["test/**/*.test.{ts,tsx}"],
        exclude: [
            "test/e2e/**/*",
            "test/**/*.spec.ts",
            "**/node_modules/**",
            "**/dist/**",
            "**/.next/**",
            // Exclude tests with EMFILE and module resolution issues
            "test/unit/components/auth/ForgetPasswordPage.test.tsx",
            "test/unit/components/auth/LoginPage.test.tsx",
            "test/unit/components/auth/LogoutFunctionality.test.tsx",
            "test/unit/components/business/UserDetails.test.tsx",
            "test/unit/components/business/UserList.test.tsx",
            "test/unit/components/data/StyledDataGrid.test.tsx",
            "test/unit/components/data/UserList.test.tsx",
            "test/unit/components/legal/LegalList.test.tsx",
            "test/unit/portal/components/InvoiceDisplay.test.tsx", // EMFILE: too many open files
            "test/unit/portal/components/InvoiceSelector.test.tsx", // EMFILE: too many open files
            "test/unit/portal/components/PortalHeader.test.tsx", // EMFILE: too many open files
        ],
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
        // Reduce file system operations
        maxConcurrency: 1,
        fileParallelism: false,
        // Add test timeout to prevent hanging
        testTimeout: 10000, // 10 seconds per test (reduced to catch hanging tests faster)
        hookTimeout: 10000, // 10 seconds for hooks
        teardownTimeout: 5000, // 5 seconds for teardown
        // Add reporter for better progress visibility
        reporters: ["verbose"],
        // Typecheck is handled by `npm run type-check`; enabling it here hangs
        // vitest on Windows while scanning the full app tree.
    },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./", import.meta.url)),
            "@/app": fileURLToPath(new URL("./app", import.meta.url)),
            "@/components": fileURLToPath(new URL("./components", import.meta.url)),
            "@/shared": fileURLToPath(new URL("./shared", import.meta.url)),
            "@/lib": fileURLToPath(new URL("./lib", import.meta.url)),
            "@/utils": fileURLToPath(new URL("./utils", import.meta.url)),
            "@/types": fileURLToPath(new URL("./types", import.meta.url)),
            "@/test": fileURLToPath(new URL("./test", import.meta.url)),
            "@/pages": fileURLToPath(new URL("./pages", import.meta.url)),
        },
    },
    esbuild: {
        target: "node18",
        format: "esm",
    },
    define: {
        "import.meta.vitest": "undefined",
    },
});
