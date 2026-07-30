#!/usr/bin/env node
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PROD_ENV_FILE = path.join(ROOT, ".env.production");

process.env.AMPLIFY_SSR = "true";
process.env.NEXT_PUBLIC_AMPLIFY_UI = "true";
process.env.NEXT_PUBLIC_USE_NEST_AUTH =
    process.env.NEXT_PUBLIC_USE_NEST_AUTH || "true";
if (process.env.NEXT_PUBLIC_ENABLE_WS == null) {
    process.env.NEXT_PUBLIC_ENABLE_WS = "true";
}

// Without a signing secret NextAuth answers every /api/auth/session with a 500
// ("problem with the server configuration"), which is hard to diagnose from the
// browser. Fail the build instead of shipping a login page that cannot work.
if (!process.env.NEXTAUTH_SECRET && !process.env.JWT_SECRET) {
    console.error(
        "[run-amplify-build] NEXTAUTH_SECRET (or JWT_SECRET) is not set.\n" +
            "Add it to the Amplify Console environment variables; it must match\n" +
            "the secret Nest uses to sign access tokens."
    );
    process.exit(1);
}

if (!process.env.NEXT_PUBLIC_NEST_API_BASE_URL?.trim()) {
    console.warn(
        "[run-amplify-build] NEXT_PUBLIC_NEST_API_BASE_URL is not set — " +
            "auth and SSE will fall back to localhost."
    );
}

/**
 * Amplify Hosting exposes Console variables to the build but not to the Next.js
 * SSR runtime, and `.env*` is gitignored so no committed file fills the gap.
 * Server code (NextAuth, middleware) would then read `undefined` in production.
 * Persisting them here is the approach AWS documents:
 * https://docs.aws.amazon.com/amplify/latest/userguide/ssr-environment-variables.html
 */
const RUNTIME_ENV_KEYS = [
    "AMPLIFY_SSR",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "JWT_SECRET",
    "SERVICE_NAME",
];

function readExistingKeys() {
    if (!fs.existsSync(PROD_ENV_FILE)) {
        return new Set();
    }
    const keys = new Set();
    for (const line of fs.readFileSync(PROD_ENV_FILE, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
        if (match) {
            keys.add(match[1]);
        }
    }
    return keys;
}

function writeRuntimeEnvFile() {
    // A developer's local .env.production is authoritative — only fill in keys
    // it does not already define, since dotenv keeps the first occurrence.
    const existing = readExistingKeys();
    const keys = [
        ...RUNTIME_ENV_KEYS,
        ...Object.keys(process.env).filter((key) =>
            key.startsWith("NEXT_PUBLIC_")
        ),
    ];

    const added = [];
    for (const key of new Set(keys)) {
        const value = process.env[key];
        if (existing.has(key) || value == null || value === "") {
            continue;
        }
        added.push(`${key}=${value}`);
        existing.add(key);
    }

    if (added.length === 0) {
        return;
    }
    const prefix = fs.existsSync(PROD_ENV_FILE) ? "\n" : "";
    fs.appendFileSync(
        PROD_ENV_FILE,
        `${prefix}# Written by scripts/run-amplify-build.js for the SSR runtime.\n${added.join("\n")}\n`
    );
    console.info(
        `[run-amplify-build] wrote ${added.length} runtime variable(s) to .env.production: ` +
            added.map((entry) => entry.split("=")[0]).join(", ")
    );
}

writeRuntimeEnvFile();

const result = spawnSync(
    process.execPath,
    [
        "--max-old-space-size=4096",
        require.resolve("next/dist/bin/next"),
        "build",
    ],
    { stdio: "inherit", env: process.env }
);

process.exit(result.status == null ? 1 : result.status);
