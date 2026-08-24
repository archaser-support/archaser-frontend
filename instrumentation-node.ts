/**
 * Node-only process guards. Loaded from instrumentation.ts via dynamic import
 * so the Edge compiler never sees `process.on`.
 *
 * @see https://nextjs.org/docs/app/guides/instrumentation#importing-runtime-specific-code
 */
process.on("unhandledRejection", (reason) => {
    console.error("[INSTRUMENTATION] Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
    console.error("[INSTRUMENTATION] Uncaught exception:", error);
});

export {};
