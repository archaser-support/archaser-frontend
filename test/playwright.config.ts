// playwright.config.ts — lives under frontend/test/
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

const frontendRoot = path.resolve(__dirname, "..");
const backendRoot = path.resolve(__dirname, "../../backend");
const repoRoot = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(frontendRoot, ".env") });
dotenv.config({ path: path.join(backendRoot, ".env"), override: false });
dotenv.config({ path: path.join(frontendRoot, ".env.e2e") });
dotenv.config({ path: path.join(frontendRoot, ".env.test") });
dotenv.config({ path: path.join(repoRoot, ".env.e2e") });
dotenv.config({ path: path.join(repoRoot, ".env.test") });

const baseURL = process.env.BASE_URL || "http://localhost:3000";
const skipWebServer = process.env.SKIP_WEBSERVER === "true" || process.env.SKIP_WEBSERVER === "1";

/**
 * Playwright configuration for e2e testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: "./e2e",

    timeout: 60_000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [["html"], ["list"], process.env.CI ? ["github"] : ["line"]],

    use: {
        baseURL,
        trace: "on-first-retry",
        video: "retain-on-failure",
        screenshot: "only-on-failure",
        viewport: { width: 1280, height: 720 },
        timezoneId: "UTC",
        locale: "en-US",
    },

    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
        },
        {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
        },
    ],

    ...(skipWebServer
        ? {}
        : {
              webServer: {
                  command: "npm run dev -w @archaser/web",
                  cwd: repoRoot,
                  url: baseURL,
                  reuseExistingServer: !process.env.CI,
                  timeout: 120 * 1000,
                  stdout: "ignore",
                  stderr: "pipe",
              },
          }),
});
