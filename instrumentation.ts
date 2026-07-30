/**
 * Next.js Instrumentation
 *
 * The frontend is UI-only, so there is nothing to bootstrap here beyond a
 * process-level guard against unhandled rejections crashing the SSR runtime.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") {
        return;
    }

    process.on("unhandledRejection", (reason) => {
        console.error("[INSTRUMENTATION] Unhandled rejection:", reason);
    });

    process.on("uncaughtException", (error) => {
        console.error("[INSTRUMENTATION] Uncaught exception:", error);
    });
}
