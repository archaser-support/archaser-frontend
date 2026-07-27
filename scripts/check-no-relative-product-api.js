#!/usr/bin/env node
/**
 * Fail if app/components/shared use relative product `/api` via raw fetch/axios.
 * Allowed: `/api/auth` (NextAuth). Prefer `api` / `apiFetch` (Nest base + Bearer).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TARGET_DIRS = ["app", "components", "shared"].map((d) =>
    path.join(ROOT, d)
);
const EXT = new Set([".ts", ".tsx", ".js", ".jsx"]);

/** @type {string[]} */
const violations = [];

// Only raw fetch(...) and axios.*(...). Shared `api.get("/api/...")` is OK.
const PATTERNS = [
    /(?<![\w.])fetch\s*\(\s*[`'"]\/api\/(?!auth(?:\/|"|'|`|\?))[^`'"]*[`'"]/,
    /axios\.(get|post|put|patch|delete|request)\s*\(\s*[`'"]\/api\/(?!auth(?:\/|"|'|`|\?))[^`'"]*[`'"]/,
];

function walk(dir) {
    if (!fs.existsSync(dir)) {
        return;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) {
            continue;
        }
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full);
            continue;
        }
        if (!EXT.has(path.extname(entry.name))) {
            continue;
        }
        checkFile(full);
    }
}

function checkFile(filePath) {
    const source = fs.readFileSync(filePath, "utf8");
    const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
    if (rel === "app/api.ts" || rel === "utils/apiFetch.ts") {
        return;
    }
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (
            trimmed.startsWith("//") ||
            trimmed.startsWith("*") ||
            trimmed.startsWith("/*")
        ) {
            continue;
        }
        for (const re of PATTERNS) {
            if (re.test(line)) {
                violations.push(`${rel}:${i + 1}: ${trimmed}`);
                break;
            }
        }
    }
}

for (const dir of TARGET_DIRS) {
    walk(dir);
}

if (violations.length) {
    console.error(
        "[check-no-relative-product-api] Relative product /api calls found.\n" +
            "Use `api` from `@/app/api` or `apiFetch` from `@/utils/apiFetch`.\n" +
            "Only `/api/auth` may stay relative (NextAuth).\n"
    );
    for (const v of violations) {
        console.error(`  ${v}`);
    }
    process.exit(1);
}

console.info("[check-no-relative-product-api] OK");
