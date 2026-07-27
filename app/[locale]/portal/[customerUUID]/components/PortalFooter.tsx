"use client";

import { Box, Link, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { FC } from "react";
import { useTranslation } from "react-i18next";

type PortalFooterProps = {
    className?: string;
};

const PortalFooter: FC<PortalFooterProps> = ({ className = "" }) => {
    const { t, i18n } = useTranslation(["portal", "common"]);
    const theme = useTheme();

    return (
        <Box
            sx={(theme) => ({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: theme.spacing(1),
                padding: theme.spacing(1, 2),
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                color: theme.palette.primary.contrastText,
                direction: i18n.language === "he" ? "rtl" : "ltr",
            })}
            className={className}
        >
            <Typography
                variant="body2"
                className="portal-footer-text"
                sx={(theme) => ({
                    color: theme.palette.primary.contrastText,
                    fontWeight: 500,
                    textAlign: i18n.language === "he" ? "right" : "left",
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                    textShadow: `0 1px 3px ${theme.palette.mode === "dark" ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.3)"}`,
                })}
            >
                {t("fields.general_powered_by")}
            </Typography>
            <Link
                href="https://www.archaser.com"
                target="_blank"
                rel="noopener noreferrer"
                className="portal-footer-link"
            >
                <Box
                    component="img"
                    src="/assets/images/brand-logos/logo.png"
                    alt="ARchaser"
                    sx={{
                        height: "32px",
                        width: "auto",
                        objectFit: "contain",
                        marginRight:
                            i18n.language === "he" ? 0 : theme.spacing(0.5),
                        marginLeft:
                            i18n.language === "he" ? theme.spacing(0.5) : 0,
                    }}
                />
            </Link>
        </Box>
    );
};

export default PortalFooter;
