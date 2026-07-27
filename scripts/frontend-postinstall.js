#!/usr/bin/env node
/**
 * Frontend postinstall: generate Prisma client when schema is present (EC2/monorepo).
 * No-op on Amplify SSR builds or when schema is missing.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const amplify =
    process.env.AMPLIFY_SSR === "true" ||
    process.env.NEXT_PUBLIC_AMPLIFY_UI === "true";

if (amplify) {
    console.info(
        "[frontend-postinstall] AMPLIFY_SSR set — skipping prisma generate"
    );
    process.exit(0);
}

const schema = path.resolve(
    __dirname,
    "../../backend/prisma/schema.prisma"
);
if (!fs.existsSync(schema)) {
    console.info(
        "[frontend-postinstall] No backend prisma schema — skipping generate"
    );
    process.exit(0);
}

const generate = spawnSync(
    "npx",
    ["prisma", "generate", `--schema=${schema}`],
    { stdio: "inherit", shell: true }
);
if (generate.status !== 0) {
    process.exit(generate.status || 1);
}

const syncScript = path.resolve(
    __dirname,
    "../../backend/scripts/sync-prisma-client.js"
);
if (fs.existsSync(syncScript)) {
    const sync = spawnSync("node", [syncScript], {
        stdio: "inherit",
        shell: true,
    });
    process.exit(sync.status || 0);
}

process.exit(0);
