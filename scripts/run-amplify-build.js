#!/usr/bin/env node
const { spawnSync } = require("child_process");

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
