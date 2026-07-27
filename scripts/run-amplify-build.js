#!/usr/bin/env node
const { spawnSync } = require("child_process");

process.env.AMPLIFY_SSR = "true";
process.env.NEXT_PUBLIC_AMPLIFY_UI = "true";
process.env.NEXT_PUBLIC_USE_NEST_AUTH =
    process.env.NEXT_PUBLIC_USE_NEST_AUTH || "true";
if (process.env.NEXT_PUBLIC_ENABLE_WS == null) {
    process.env.NEXT_PUBLIC_ENABLE_WS = "true";
}

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
