import { Box, BoxProps } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

interface RTLGridLayoutProps extends Omit<BoxProps, "display"> {
    children: React.ReactNode;
    columns?: string;
    gap?: number;
    alignItems?: "start" | "center" | "end" | "stretch";
    justifyContent?:
    | "start"
    | "center"
    | "end"
    | "space-between"
    | "space-around";
}

export const RTLGridLayout: React.FC<RTLGridLayoutProps> = ({
    children,
    columns = "1fr auto auto",
    gap = 1,
    alignItems = "center",
    justifyContent = "start",
    sx,
    ...props
}) => {
    const { i18n } = useTranslation(["common"]);
    const isRTL = i18n.language === "he";

    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: isRTL
                    ? columns.split(" ").reverse().join(" ")
                    : columns,
                gap,
                alignItems,
                justifyContent,
                direction: isRTL ? "rtl" : "ltr",
                ...sx,
            }}
            {...props}
        >
            {children}
        </Box>
    );
};

interface RTLGridItemProps extends Omit<BoxProps, "display"> {
    children: React.ReactNode;
    column?: number;
    alignSelf?: "start" | "center" | "end" | "stretch";
    justifySelf?: "start" | "center" | "end" | "stretch";
}

export const RTLGridItem: React.FC<RTLGridItemProps> = ({
    children,
    column = 1,
    alignSelf = "center",
    justifySelf = "start",
    sx,
    ...props
}) => {
    const { i18n } = useTranslation(["common"]);
    const isRTL = i18n.language === "he";

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                alignSelf,
                justifySelf,
                gridColumn: isRTL ? `-${column}` : column,
                direction: isRTL ? "rtl" : "ltr",
                ...sx,
            }}
            {...props}
        >
            {children}
        </Box>
    );
};

export default RTLGridLayout;
