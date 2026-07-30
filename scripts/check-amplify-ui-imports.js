#!/usr/bin/env node
/**
 * The frontend is UI-only: all data comes from Nest over HTTP. Fail the build if
 * anything reintroduces a database client or a server-side data layer.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TARGET_DIRS = [
    "app",
    "components",
    "hooks",
    "lib",
    "pages",
    "shared",
    "types",
    "utils",
].map((d) => path.join(ROOT, d));
const EXT = new Set([".ts", ".tsx", ".js", ".jsx"]);

const FORBIDDEN = [
    { pattern: /from\s+["']@prisma\/client["']/, label: "@prisma/client" },
    { pattern: /from\s+["']\.prisma\/client["']/, label: ".prisma/client" },
    { pattern: /from\s+["']@\/lib\/prisma["']/, label: "@/lib/prisma" },
    { pattern: /from\s+["']@\/server(\/[^"']*)?["']/, label: "@/server" },
    { pattern: /from\s+["']mongoose["']/, label: "mongoose" },
];

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

function checkFile(filePath) {
    const source = fs.readFileSync(filePath, "utf8");
    const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (
            trimmed.startsWith("//") ||
            trimmed.startsWith("*") ||
            trimmed.startsWith("/*")
        ) {
            continue;
        }
        for (const { pattern, label } of FORBIDDEN) {
            if (pattern.test(lines[i])) {
                violations.push(`${rel}:${i + 1}: ${label} — ${trimmed}`);
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
        "[check-amplify-ui-imports] Database imports are not allowed in the frontend.\n" +
            "Call the Nest API instead; row shapes live in `@/types/db`.\n"
    );
    for (const v of violations) {
        console.error(`  ${v}`);
    }
    process.exit(1);
}

console.info("[check-amplify-ui-imports] OK");
