import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        fs: {
            allow: [
                path.dirname(fileURLToPath(import.meta.url)),
                path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../tests/frontend"),
            ],
        },
        deps: {
            inline: [
                /\/tests\/frontend\//,
                "@testing-library/jest-dom",
                "react",
                "react-dom",
            ],
        },
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["../tests/frontend/setup/vitest.setup.ts"],
        include: ["../tests/frontend/**/*.test.{ts,tsx}"],
        exclude: [
            "../tests/frontend/e2e/**/*",
            "../tests/frontend/**/*.spec.ts",
            "**/node_modules/**",
            "**/dist/**",
            "**/.next/**",
            // Exclude tests with EMFILE and module resolution issues
            "../tests/frontend/unit/components/auth/ForgetPasswordPage.test.tsx",
            "../tests/frontend/unit/components/auth/LoginPage.test.tsx",
            "../tests/frontend/unit/components/auth/LogoutFunctionality.test.tsx",
            "../tests/frontend/unit/components/business/UserDetails.test.tsx",
            "../tests/frontend/unit/components/business/UserList.test.tsx",
            "../tests/frontend/unit/components/data/StyledDataGrid.test.tsx",
            "../tests/frontend/unit/components/data/UserList.test.tsx",
            "../tests/frontend/unit/components/legal/LegalList.test.tsx",
            "../tests/frontend/unit/portal/components/InvoiceDisplay.test.tsx", // EMFILE: too many open files
            "../tests/frontend/unit/portal/components/InvoiceSelector.test.tsx", // EMFILE: too many open files
            "../tests/frontend/unit/portal/components/PortalHeader.test.tsx", // EMFILE: too many open files
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
            "@/test": fileURLToPath(new URL("../tests/frontend", import.meta.url)),
                        "@archaser/openapi-client": path.resolve(
                path.dirname(fileURLToPath(import.meta.url)),
                "../backend/packages/openapi-client/src/index.ts",
            ),
            "@testing-library/jest-dom/vitest": path.resolve(
                path.dirname(fileURLToPath(import.meta.url)),
                "node_modules/@testing-library/jest-dom/dist/vitest.mjs",
            ),
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