const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET_DIRS = ["app", "shared", "components", "utils"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const BARE_AMOUNT_PATTERN =
    /\bformatAmountWithoutSymbol(?:Whole)?\s*\(/;

/** Paths allowed to call bare amount helpers (building blocks only). */
const ALLOWLIST_PATHS = new Set([
    path.join("utils", "stringFormatters.ts"),
]);

function shouldSkipDir(dirName) {
    return (
        dirName === "node_modules" ||
        dirName === ".next" ||
        dirName === ".git" ||
        dirName === "dist"
    );
}

function walk(dir, files = []) {
    if (!fs.existsSync(dir)) return files;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        if (shouldSkipDir(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath, files);
            continue;
        }

        const ext = path.extname(entry.name);
        if (EXTENSIONS.has(ext)) {
            files.push(fullPath);
        }
    }

    return files;
}

function findViolations(filePath) {
    const rel = path.relative(ROOT, filePath);
    if (ALLOWLIST_PATHS.has(rel)) return [];

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    const violations = [];

    lines.forEach((line, idx) => {
        // Skip import lines — importing the helper is fine; calling it is not.
        if (/^\s*import\b/.test(line)) return;
        if (BARE_AMOUNT_PATTERN.test(line)) {
            violations.push(`${rel}:${idx + 1}: ${line.trim()}`);
        }
    });

    return violations;
}

function main() {
    const files = TARGET_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
    const violations = files.flatMap(findViolations);

    if (violations.length > 0) {
        console.error(
            [
                "Bare amount formatting detected. Use formatMoney / formatMoneyDual / formatCurrencyWithRTLSupport instead.",
                "Allowlisted: utils/stringFormatters.ts (internal building blocks only).",
                "",
                ...violations,
            ].join("\n")
        );
        process.exit(1);
    }

    console.log("Bare amount display guard passed.");
}

main();
