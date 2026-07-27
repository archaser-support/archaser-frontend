/** Tooltip props for icon/buttons rendered in the endless-scroll toolbar */
export const getEndlessScrollToolbarTooltipProps = (isHebrew: boolean) => ({
    arrow: true,
    placement: "bottom" as const,
    PopperProps: {
        sx: {
            "& .MuiTooltip-tooltip": {
                direction: isHebrew ? "rtl" : "ltr",
            },
        },
    },
});
