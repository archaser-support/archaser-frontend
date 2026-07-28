export type ReportSelectorOption = {
    id: number | string;
    name: string;
    isSystem: boolean;
    uniqueName?: string | null;
    context?: string | null;
};

/**
 * Collapse duplicate report selector rows (seeded system views / name collisions).
 * Prefers custom over system when the same logical key collides.
 */
export function dedupeReportsForSelector<T extends ReportSelectorOption>(
    reports: T[]
): T[] {
    const normalizeReportName = (name: string) =>
        String(name || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");

    const dedupeMap = new Map<string, T>();
    for (const report of reports) {
        const normalizedName = normalizeReportName(report.name);
        const keyBase = report.isSystem
            ? `system:${normalizedName}`
            : `${report.context || "global"}:${report.uniqueName || normalizedName}`;
        const key = keyBase.trim();
        if (!key) {
            dedupeMap.set(`id:${report.id}`, report);
            continue;
        }
        const existing = dedupeMap.get(key);
        if (!existing) {
            dedupeMap.set(key, report);
            continue;
        }
        if (existing.isSystem && !report.isSystem) {
            dedupeMap.set(key, report);
        }
    }
    return Array.from(dedupeMap.values());
}
