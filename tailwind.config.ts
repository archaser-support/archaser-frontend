/** @type {import('tailwindcss').Config} */

module.exports = {
    darkMode: "class",
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./shared/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            // Only include colors that are actually used
            colors: {
                gray: {
                    50: "#f9fafb",
                    100: "#f3f4f6",
                    200: "#e5e7eb",
                    300: "#d1d5db",
                    400: "#9ca3af",
                    500: "#6b7280",
                    600: "#4b5563",
                    700: "#374151",
                    800: "#1f2937",
                    900: "#111827",
                },
                blue: {
                    100: "#dbeafe",
                    600: "#2563eb",
                    700: "#1d4ed8",
                    800: "#1e40af",
                },
                green: {
                    100: "#dcfce7",
                    400: "#4ade80",
                    500: "#22c55e",
                    600: "#16a34a",
                    700: "#15803d",
                },
                red: {
                    500: "#ef4444",
                },
                yellow: {
                    50: "#fefce8",
                    500: "#eab308",
                    800: "#92400e",
                },
                purple: {
                    100: "#f3e8ff",
                    800: "#5b21b6",
                },
                indigo: {
                    500: "#6366f1",
                    600: "#4f46e5",
                    700: "#4338ca",
                },
            },
            // Only include spacing that's actually used
            spacing: {
                "0.5": "0.125rem",
                "1": "0.25rem",
                "2": "0.5rem",
                "3": "0.75rem",
                "4": "1rem",
                "6": "1.5rem",
                "8": "2rem",
                "12": "3rem",
                "16": "4rem",
            },
            // Only include font sizes that are actually used
            fontSize: {
                xs: "0.75rem",
                sm: "0.875rem",
                base: "1rem",
                lg: "1.125rem",
                xl: "1.25rem",
                "2xl": "1.5rem",
                "4xl": "2.25rem",
            },
            // Only include border radius that's actually used
            borderRadius: {
                lg: "0.5rem",
                full: "9999px",
            },
            // Only include shadows that are actually used
            boxShadow: {
                md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            },
            // Only include min-height that's actually used
            minHeight: {
                screen: "100vh",
                "100": "25rem",
                "120": "30rem",
                "150": "37.5rem",
            },
            // Only include max-width that's actually used
            maxWidth: {
                "2xl": "42rem",
                md: "28rem",
            },
            // Only include z-index that's actually used
            zIndex: {
                "50": "50",
            },
        },
    },
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    plugins: [require("@tailwindcss/forms")],
};
