/**
 * Next.js Instrumentation
 *
 * The frontend is UI-only, so there is nothing to bootstrap here beyond a
 * process-level guard against unhandled rejections crashing the SSR runtime.
 *
 * Node APIs live in `instrumentation-node.ts` and are loaded only when
 * NEXT_RUNTIME is nodejs. Turbopack still compiles this file for Edge, so
 * `process.on` must not appear here.
 *
 * @see https://nextjs.org/docs/app/guides/instrumentation#importing-runtime-specific-code
 */

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        await import("./instrumentation-node");
    }
}
