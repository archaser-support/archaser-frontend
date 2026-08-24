/** @type {import('next').NextConfig} */
const fs = require("fs");
const path = require("path");

// Load env from this package (frontend/.env). Falls back to backend/.env for shared secrets during monorepo transition.
const appDir = __dirname;
const backendEnvDir = path.resolve(__dirname, "../backend");
try {
    require("dotenv").config({ path: path.join(appDir, ".env") });
    require("dotenv").config({
        path: path.join(backendEnvDir, ".env"),
        override: false,
    });
    const localEnv = path.join(appDir, ".env.local");
    if (fs.existsSync(localEnv)) {
        require("dotenv").config({ path: localEnv, override: true });
    }
} catch {
    // dotenv may be unavailable in some deploy images; process env still applies.
}

const {
    getNestApiRewriteTarget,
    getReportsNestRewriteTarget,
    isReportsNestRewriteEnabled,
    buildNestApiRewrites,
} = require("./nest-api-rewrite.cjs");

const isDev = process.env.NODE_ENV !== "production";
const isAmplifySsr =
    process.env.AMPLIFY_SSR === "true" ||
    process.env.NEXT_PUBLIC_AMPLIFY_UI === "true";

const nextConfig = {
    // Amplify Hosting SSR expects default `.next`; EC2 deploy scripts use `frontend/build`.
    ...(isAmplifySsr ? {} : { distDir: "build" }),

    modularizeImports: {
        // Icons still map 1:1 to files. Do not transform `@mui/material` —
        // ThemeProvider, useTheme, alpha, etc. live under `/styles` in MUI v7
        // and Next 16 Turbopack cannot resolve `@mui/material/{{member}}`.
        "@mui/icons-material": {
            transform: "@mui/icons-material/{{member}}",
        },
    },

    // Disable source maps in production
    productionBrowserSourceMaps: false,

    // Type safety is enforced by `npm run type-check`. Next's embedded
    // typecheck duplicates that work and OOM/crashes on smaller Windows hosts;
    // Amplify still runs the explicit type-check step in amplify.yml.
    typescript: {
        ignoreBuildErrors: isAmplifySsr,
    },

    // Disable ESLint during build to ignore ESLint-related TypeScript errors
    eslint: {
        ignoreDuringBuilds: true,
    },

    // Optimize images
    images: {
        unoptimized: true, // For static export
    },

    /**
     * D11–D15: Local opt-in proxy of /api/* → Nest (except /api/auth, /api/ws).
     * Requires USE_NEST_API_REWRITE=true and NODE_ENV=development.
     */
    async rewrites() {
        const nestRewrites = buildNestApiRewrites();
        if (nestRewrites.length > 0) {
            const reportsNote = isReportsNestRewriteEnabled()
                ? `; /api/reports → ${getReportsNestRewriteTarget()}`
                : "";
            // eslint-disable-next-line no-console
            console.info(
                `[nest-api-rewrite] Proxying /api/* → ${getNestApiRewriteTarget()} (excluding auth, ws)${reportsNote}`
            );
        }
        return {
            beforeFiles: nestRewrites,
            afterFiles: [],
            fallback: [],
        };
    },

    // Webpack optimizations
    webpack: (config, { dev, isServer }) => {
        if (!dev && !isServer) {
            // Use less aggressive chunk splitting to avoid CSS chunking issues
            // Next.js handles CSS extraction automatically, so we don't need to split CSS chunks
            config.optimization.splitChunks = {
                chunks: "async", // Only split async chunks (dynamic imports) - this prevents CSS issues
                cacheGroups: {
                    // Default vendor chunk for node_modules
                    default: {
                        minChunks: 2,
                        priority: -20,
                        reuseExistingChunk: true,
                    },
                    // Vendor chunk for node_modules (more specific)
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: "vendors",
                        chunks: "async", // Only async chunks to avoid CSS issues
                        priority: 10,
                        reuseExistingChunk: true,
                    },
                    // Common chunk for shared code
                    common: {
                        name: "common",
                        minChunks: 2,
                        chunks: "async", // Only async chunks
                        priority: 5,
                        reuseExistingChunk: true,
                    },
                },
            };
        }

        // Exclude server-only packages from client bundle
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                tls: false,
                crypto: false,
                stream: false,
                zlib: false,
            };
        }

        // Exclude unnecessary files from bundle
        config.module.rules.push({
            test: /\.(test|spec)\.(js|jsx|ts|tsx)$/,
            loader: "ignore-loader",
        });
        config.resolve.alias = {
            ...config.resolve.alias,
            "@": path.resolve(__dirname),
        };

        return config;
    },

    // distDir: Amplify uses default `.next`; EC2 uses `build` (see top of config)

    // Compiler optimizations
    compiler: {
        removeConsole: process.env.NODE_ENV === "production"
            ? { exclude: ["error", "warn"] }
            : false,
    },

    // Exclude unnecessary files
    onDemandEntries: {
        maxInactiveAge: 25 * 1000,
        pagesBufferLength: isDev ? 8 : 2,
    },

    // Note: API route body parser size limits should be configured
    // in individual API route files using: export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }
    // Request size limits are handled by utils/requestLimits.ts

    // Security headers (fallback if middleware doesn't apply)
    async headers() {
        const isProduction = process.env.NODE_ENV === "production";
        const isHttps =
            process.env.NEXT_PUBLIC_BASE_URL?.startsWith("https://") ?? false;

        const securityHeaders = [
            {
                key: "X-Frame-Options",
                value: "DENY",
            },
            {
                key: "X-Content-Type-Options",
                value: "nosniff",
            },
            {
                key: "X-XSS-Protection",
                value: "1; mode=block",
            },
            {
                key: "Referrer-Policy",
                value: "strict-origin-when-cross-origin",
            },
        ];

        // Add HSTS only in production with HTTPS
        if (isProduction && isHttps) {
            securityHeaders.push({
                key: "Strict-Transport-Security",
                value: "max-age=31536000; includeSubDomains; preload",
            });
        }

        // Basic CSP (can be customized per route if needed)
        const cspDirectives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https: wss: ws:",
            "frame-src 'none'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "upgrade-insecure-requests",
        ];

        // Nest login (NEXT_PUBLIC_USE_NEST_AUTH) calls :3002 from the browser
        if (!isProduction) {
            const nestOrigin = getNestApiRewriteTarget();
            const connectSrc = cspDirectives.find((d) =>
                d.startsWith("connect-src ")
            );
            if (connectSrc) {
                const idx = cspDirectives.indexOf(connectSrc);
                cspDirectives[idx] =
                    `${connectSrc} ${nestOrigin} http://localhost:3002 http://127.0.0.1:3002`;
            }
            // Local Nest is HTTP — drop upgrade-insecure-requests in development
            const upgradeIdx = cspDirectives.indexOf(
                "upgrade-insecure-requests"
            );
            if (upgradeIdx >= 0) {
                cspDirectives.splice(upgradeIdx, 1);
            }
        }

        if (process.env.CSP_REPORT_URI) {
            cspDirectives.push(`report-uri ${process.env.CSP_REPORT_URI}`);
        }

        securityHeaders.push({
            key: "Content-Security-Policy",
            value: cspDirectives.join("; "),
        });

        return [
            {
                source: "/:path*",
                headers: securityHeaders,
            },
        ];
    },
};

module.exports = nextConfig;
