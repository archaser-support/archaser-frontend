/** Light-theme design tokens for the portfolio-health Tailwind island. */
export const CPH = {
    bg: "#F7F8FA",
    card: "#FFFFFF",
    surfaceMuted: "#F1F4F8",
    border: "#E4E8F0",
    shadow: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
    ink: "#101828",
    slate: "#64748B",
    muted: "#94A3B8",
    jade: "#0F9D74",
    jadeDim: "#0B7A5A",
    jadeTint: "#E3F6EF",
    copper: "#C2703A",
    copperTint: "#FBEEE3",
    critical: "#DC2626",
    criticalTint: "#FDECEC",
    maxWidth: 1180,
} as const;

export type IslandAccent = "jade" | "copper" | "critical" | "slate";

export function accentColor(accent: IslandAccent): string {
    switch (accent) {
        case "jade":
            return CPH.jade;
        case "copper":
            return CPH.copper;
        case "critical":
            return CPH.critical;
        case "slate":
        default:
            return CPH.slate;
    }
}
