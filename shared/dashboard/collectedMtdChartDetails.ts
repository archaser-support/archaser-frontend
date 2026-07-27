/** Chart-details / API type for the Total Collected (MTD) drill-down (payments only). */
export const COLLECTED_MTD_CHART_TYPE = "collected-mtd";

/** Legacy URL param; redirected to {@link COLLECTED_MTD_CHART_TYPE} in the UI. */
export const COLLECTED_MTD_CHART_TYPE_LEGACY = "collected-vs-promise";

const COLLECTED_MTD_TYPES: ReadonlySet<string> = new Set([
    COLLECTED_MTD_CHART_TYPE,
    COLLECTED_MTD_CHART_TYPE_LEGACY,
]);

export function isCollectedMtdChartType(
    type: string | null | undefined
): type is typeof COLLECTED_MTD_CHART_TYPE | typeof COLLECTED_MTD_CHART_TYPE_LEGACY {
    return type != null && COLLECTED_MTD_TYPES.has(type);
}
