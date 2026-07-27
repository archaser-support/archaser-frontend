import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("amplify build guards", () => {
    it("check-amplify-ui-imports exits 0 on current tree", () => {
        const result = spawnSync(
            process.execPath,
            [path.join(root, "scripts/check-amplify-ui-imports.js")],
            { encoding: "utf8" }
        );
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("OK");
    });

    it("check-no-relative-product-api exits 0 on current tree", () => {
        const result = spawnSync(
            process.execPath,
            [path.join(root, "scripts/check-no-relative-product-api.js")],
            { encoding: "utf8" }
        );
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("OK");
    });

    it("check-no-relative-product-api fails on fixture relative fetch", () => {
        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "api-guard-"));
        const appDir = path.join(tmpRoot, "app");
        fs.mkdirSync(appDir, { recursive: true });
        fs.writeFileSync(
            path.join(appDir, "bad.tsx"),
            'export const x = () => fetch("/api/entities/customers");\n'
        );
        const script = path.join(root, "scripts/check-no-relative-product-api.js");
        const source = fs.readFileSync(script, "utf8");
        const patched = source.replace(
            'const ROOT = path.resolve(__dirname, "..");',
            `const ROOT = ${JSON.stringify(tmpRoot)};`
        );
        const patchedPath = path.join(tmpRoot, "check.js");
        fs.writeFileSync(patchedPath, patched);
        const result = spawnSync(process.execPath, [patchedPath], {
            encoding: "utf8",
        });
        expect(result.status).toBe(1);
        expect(result.stderr + result.stdout).toContain(
            "Relative product /api calls found"
        );
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    it("frontend-postinstall no-ops when AMPLIFY_SSR=true", () => {
        const result = spawnSync(
            process.execPath,
            [path.join(root, "scripts/frontend-postinstall.js")],
            {
                encoding: "utf8",
                env: { ...process.env, AMPLIFY_SSR: "true" },
            }
        );
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("skipping prisma generate");
    });
});

/**
 * D9 manual smoke checklist (Amplify UI + Nest API staging):
 * - Login (credentials) → cookie bridge + Nest Bearer
 * - Forget / reset password against Nest /auth/*
 * - Main nav: customers, invoices, activities, disputes, promise-to-pay, agents
 * - Reports, settings, import, credit dashboards, control center
 * - Notification bell: list + stats + mark-read/delete (WS not required)
 * - Customer portal: details + verify gating without Amplify Prisma
 */
