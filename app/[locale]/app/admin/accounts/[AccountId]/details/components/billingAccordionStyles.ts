/**
 * Shared pill-radius accordion chrome for billing integration sections.
 * Matches theme button radius; callers pass the resolved px string.
 */
export function getBillingAccordionStyles(pillRadiusPx: string) {
    const accordionSx = {
        border: "1px solid",
        borderColor: "divider",
        borderRadius: pillRadiusPx,
        overflow: "hidden",
        bgcolor: "background.paper",
        "&:before": { display: "none" },
        "&:first-of-type, &:last-of-type, &:not(:first-of-type)": {
            borderRadius: pillRadiusPx,
        },
        "&.Mui-expanded": {
            margin: 0,
        },
    };

    const summarySx = (
        expanded: boolean,
        options?: { collapseLocked?: boolean }
    ) => ({
        bgcolor: "background.paper",
        px: 2,
        py: 0.75,
        minHeight: 48,
        borderTopLeftRadius: pillRadiusPx,
        borderTopRightRadius: pillRadiusPx,
        borderBottomLeftRadius: expanded ? 0 : pillRadiusPx,
        borderBottomRightRadius: expanded ? 0 : pillRadiusPx,
        cursor: options?.collapseLocked ? ("default" as const) : undefined,
        ...(options?.collapseLocked
            ? {
                  "& .MuiAccordionSummary-expandIconWrapper": {
                      display: "none",
                  },
              }
            : {}),
        "& .MuiAccordionSummary-content": {
            my: 0,
            alignItems: "center",
            gap: 1,
            "&.Mui-expanded": { my: 0 },
        },
        "&.Mui-expanded": {
            minHeight: 48,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
        },
    });

    const detailsSx = {
        p: 0,
        bgcolor: "background.paper",
        borderBottomLeftRadius: pillRadiusPx,
        borderBottomRightRadius: pillRadiusPx,
    };

    const contentSx = {
        px: 2,
        py: 1.5,
        "&:last-child": { pb: 1.5 },
    };

    return { accordionSx, summarySx, detailsSx, contentSx };
}
