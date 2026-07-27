import type { CardProps } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";

import {
    PORTAL_CARD_CLASS,
    getPortalCardSx,
} from "@/app/theme/portalCard";

export { PORTAL_CARD_CLASS, getPortalCardSx };

export function getPortalCardProps(
    theme: Theme,
    sx?: SystemStyleObject<Theme>
): Pick<CardProps, "className" | "elevation" | "sx"> {
    return {
        className: PORTAL_CARD_CLASS,
        elevation: theme.portalCard.elevation,
        sx: {
            ...getPortalCardSx(theme),
            ...sx,
        },
    };
}
