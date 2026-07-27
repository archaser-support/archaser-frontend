/**
 * Next.js Instrumentation
 *
 * This file is automatically loaded by Next.js at server startup.
 * It's the ideal place to initialize global error handlers.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
    // Only run on the server
    if (process.env.NEXT_RUNTIME === "nodejs") {
        // Import and initialize global error handlers
        const { initializeGlobalErrorHandlers } = await import(
            "./server/globalErrorHandlers"
        );
        const { register: metricsRegister } = await import("./lib/metrics");
        // Metrics are automatically initialized upon import due to collectDefaultMetrics()

        initializeGlobalErrorHandlers();

        console.log("[INSTRUMENTATION] Metrics collection initialized");

        console.log("[INSTRUMENTATION] Server-side initialization complete");
    }
}
