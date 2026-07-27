import React from "react";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { EmptyStateProps } from "../types";

const EmptyState: React.FC<EmptyStateProps> = React.memo(
    ({ noRowsMessage, noRowsDescription, language, height }) => {
        const { t } = useTranslation(["common"]);
        const theme = useTheme();
        const resolvedDescription =
            noRowsDescription === ""
                ? ""
                : noRowsDescription ||
                  t("messages.no_results_description", { ns: "common" });

        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    p: { xs: 2, sm: 3, md: 4 },
                    height: height,
                }}
            >
                <Typography
                    variant={language === "he" ? "hebrewTitle" : "h6"}
                    sx={{
                        mb: 0.5,
                        fontSize: {
                            xs: theme.typography.body1.fontSize,
                            sm: theme.typography.h6.fontSize,
                            md: theme.typography.h6.fontSize,
                        },
                        color: "text.primary",
                        textAlign: "center",
                        ...(language !== "he" && {
                            direction: "ltr",
                        }),
                    }}
                >
                    {noRowsMessage ||
                        t("messages.no_results", { ns: "common" })}
                </Typography>
                {resolvedDescription ? (
                    <Typography
                        variant={language === "he" ? "hebrewBodyText" : "body2"}
                        sx={{
                            color: "text.secondary",
                            textAlign: "center",
                            maxWidth: { xs: "36rem", sm: "42rem", md: "48rem" },
                            fontSize: {
                                xs: theme.typography.body2.fontSize,
                                sm: theme.typography.body1.fontSize,
                            },
                            px: { xs: 2, sm: 0 },
                        }}
                    >
                        {resolvedDescription}
                    </Typography>
                ) : null}
            </Box>
        );
    },
    (prevProps, nextProps) => {
        // Custom comparison function for memoization
        return (
            prevProps.noRowsMessage === nextProps.noRowsMessage &&
            prevProps.noRowsDescription === nextProps.noRowsDescription &&
            prevProps.language === nextProps.language &&
            JSON.stringify(prevProps.height) ===
                JSON.stringify(nextProps.height)
        );
    }
);

EmptyState.displayName = "EmptyState";

export default EmptyState;
