#!/usr/bin/env node
/**
 * Fails when app/ or components/ statically import Prisma DB client or @/server
 * runtime modules. `import type` from @/server or @prisma/client is allowed.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TARGET_DIRS = ["app", "components"].map((d) => path.join(ROOT, d));
const EXT = new Set([".ts", ".tsx", ".js", ".jsx"]);

/** @type {string[]} */
const violations = [];

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

function isTypeOnlyImport(line) {
    const trimmed = line.trim();
    if (/^import\s+type\s/.test(trimmed)) {
        return true;
    }
    if (!/^import\s*\{/.test(trimmed)) {
        return false;
    }
    const match = trimmed.match(/^import\s*\{([^}]*)\}\s*from/);
    if (!match) {
        return false;
    }
    const parts = match[1]
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
    return parts.length > 0 && parts.every((p) => /^type\s+/.test(p));
}

function checkFile(filePath) {
    const source = fs.readFileSync(filePath, "utf8");
    const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
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
        if (/from\s+["']@\/lib\/prisma["']/.test(line)) {
            violations.push(`${rel}:${i + 1}: @/lib/prisma — ${trimmed}`);
            continue;
        }
        if (/from\s+["']@\/server(\/[^"']*)?["']/.test(line)) {
            if (isTypeOnlyImport(line)) {
                continue;
            }
            violations.push(`${rel}:${i + 1}: @/server — ${trimmed}`);
        }
    }
}

for (const dir of TARGET_DIRS) {
    walk(dir);
}

if (violations.length) {
    console.error(
        "[check-amplify-ui-imports] Forbidden runtime imports in app/ or components/:\n"
    );
    for (const v of violations) {
        console.error(`  ${v}`);
    }
    process.exit(1);
}

console.info("[check-amplify-ui-imports] OK");
