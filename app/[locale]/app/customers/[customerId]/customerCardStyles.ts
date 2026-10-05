/** Shared customer-details section card header — one source for all tabs. */
export const customerSectionHeaderSx = {
    px: { xs: 1, sm: 1.25 },
    pt: 0,
    pb: 0,
    mb: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
} as const;

export const customerSectionCardContentSx = {
    px: { xs: 1.5, sm: 2 },
    pt: 0,
    pb: { xs: 1.5, sm: 2 },
} as const;

/** IDENTITY & CONTACT / ASSIGNMENT & ORGANIZATION style bars inside a section card. */
export const customerSubsectionHeaderSx = {
    mt: 0,
    mb: 0.5,
    py: 0,
    px: 0,
} as const;
