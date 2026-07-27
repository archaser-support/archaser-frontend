"use client";

import {
    Box,
    Paper,
    Typography,
    Button,
    Popper,
    Portal,
    ClickAwayListener,
    useTheme,
    alpha,
    Fade,
} from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useGuidedTooltip } from "./GuidedTooltipProvider";

export function GuidedTooltipManager() {
    const {
        activeTooltip,
        sessionCount,
        next,
        previous,
        close,
        enabled,
        hasHistory,
    } = useGuidedTooltip();
    const { t } = useTranslation(["common"]);
    const theme = useTheme();
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [open, setOpen] = useState(false);
    const [computedPlacement, setComputedPlacement] = useState<
        "top" | "bottom" | "left" | "right"
    >("top");
    const popperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!activeTooltip || !enabled) {
            setOpen(false);
            setAnchorEl(null);
            return;
        }

        // For dashboard welcome, don't need anchor element
        if (activeTooltip.id === "dashboard-welcome") {
            setOpen(true);
            setComputedPlacement(activeTooltip.placement || "bottom");

            const handleEscape = (e: KeyboardEvent) => {
                if (e.key === "Escape") {
                    close();
                }
            };

            document.addEventListener("keydown", handleEscape);
            return () => {
                document.removeEventListener("keydown", handleEscape);
            };
        }

        const element = document.querySelector(
            `[data-tooltip-id="${activeTooltip.id}"]`
        ) as HTMLElement;

        // For profile-menu tooltip, wait for the menu to open and anchor to it
        if (activeTooltip.id === "profile-menu") {
            const findProfileMenu = () => {
                return document.querySelector(
                    '[data-profile-menu="true"]'
                ) as HTMLElement;
            };

            // Don't show tooltip until menu is open
            if (!element) {
                return;
            }

            // Set placement but don't open yet
            setComputedPlacement(activeTooltip.placement || "bottom");

            // Poll for the profile menu to appear (it opens with a delay)
            const checkInterval = setInterval(() => {
                const profileMenu = findProfileMenu();
                if (profileMenu) {
                    // Only set anchor and open after menu is found
                    setAnchorEl(profileMenu);
                    setOpen(true);
                    clearInterval(checkInterval);
                }
            }, 50); // Check every 50ms

            // Stop polling after 2 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
            }, 2000);

            const handleEscape = (e: KeyboardEvent) => {
                if (e.key === "Escape") {
                    close();
                }
            };

            document.addEventListener("keydown", handleEscape);
            return () => {
                document.removeEventListener("keydown", handleEscape);
                clearInterval(checkInterval);
            };
        }

        if (element) {
            setAnchorEl(element);
            setOpen(true);
            // Initialize placement
            setComputedPlacement(activeTooltip.placement || "bottom");

            // Check element again after a short delay (in case DOM changes)
            setTimeout(() => {
                const elementAfterDelay = document.querySelector(
                    `[data-tooltip-id="${activeTooltip.id}"]`
                ) as HTMLElement;
                // Element checked after delay
            }, 500);

            const handleEscape = (e: KeyboardEvent) => {
                if (e.key === "Escape") {
                    close();
                }
            };

            document.addEventListener("keydown", handleEscape);
            return () => {
                document.removeEventListener("keydown", handleEscape);
            };
        }
    }, [activeTooltip, enabled, close]);

    const isDashboardWelcome = activeTooltip?.id === "dashboard-welcome";

    if (!activeTooltip || !open) {
        return null;
    }

    // For dashboard welcome, don't require anchorEl
    if (!isDashboardWelcome && !anchorEl) {
        return null;
    }

    const getPlacement = (): "top" | "bottom" | "left" | "right" => {
        return computedPlacement;
    };

    const handlePlacementChange = (placement: string) => {
        // Map Popper placement to our simple placement
        if (placement.startsWith("top")) {
            setComputedPlacement("top");
        } else if (placement.startsWith("bottom")) {
            setComputedPlacement("bottom");
        } else if (placement.startsWith("left")) {
            setComputedPlacement("left");
        } else if (placement.startsWith("right")) {
            setComputedPlacement("right");
        }
    };

    const message = t(activeTooltip.messageKey, {
        defaultValue: activeTooltip.messageKey,
    });

    // For dashboard welcome, render centered on page
    if (isDashboardWelcome) {
        return (
            <Portal>
                <Box
                    sx={{
                        position: "fixed",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: theme.zIndex.tooltip + 1,
                        pointerEvents: "none",
                    }}
                >
                    <ClickAwayListener onClickAway={() => {}}>
                        <Fade in={open} timeout={600}>
                            <Paper
                                elevation={0}
                                sx={{
                                    backgroundColor: "rgb(196, 181, 253)",
                                    color:
                                        theme.palette.primary.contrastText ||
                                        "rgba(255, 255, 255, 0.87)",
                                    fontSize: "0.75rem",
                                    padding: theme.spacing(1, 1.5),
                                    borderRadius: theme.shape.borderRadius,
                                    boxShadow: theme.shadows[4],
                                    maxWidth: 320,
                                    minWidth: 200,
                                    position: "relative",
                                    pointerEvents: "auto",
                                }}
                                ref={popperRef}
                                role="tooltip"
                                aria-labelledby="tooltip-title"
                                aria-describedby="tooltip-message"
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        mb: 1,
                                        gap: 1,
                                    }}
                                >
                                    <Typography
                                        id="tooltip-message"
                                        variant="body2"
                                        sx={{
                                            fontSize: "0.75rem",
                                            lineHeight: 1.5,
                                            color: "inherit",
                                            flex: 1,
                                        }}
                                    >
                                        {message}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontSize: "0.7rem",
                                            opacity: 0.9,
                                            whiteSpace: "nowrap",
                                            ml: 1,
                                        }}
                                    >
                                        {t("tooltips.guided_tooltip_counter", {
                                            current: sessionCount + 1,
                                            limit: 3,
                                            defaultValue: `${sessionCount + 1}/3`,
                                        })}
                                    </Typography>
                                </Box>

                                <Box
                                    sx={{
                                        display: "flex",
                                        gap: 0.75,
                                        justifyContent: "space-between",
                                        flexWrap: "wrap",
                                        mt: 1,
                                    }}
                                >
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={close}
                                        sx={{
                                            minWidth: 60,
                                            fontSize: "0.7rem",
                                            py: 0.25,
                                            px: 1,
                                            borderColor: alpha(
                                                theme.palette.common.white,
                                                0.5
                                            ),
                                            backgroundColor: alpha(
                                                theme.palette.common.white,
                                                0.1
                                            ),
                                            color:
                                                theme.palette.primary
                                                    .contrastText ||
                                                "rgba(255, 255, 255, 0.87)",
                                            fontWeight: 500,
                                            "&:hover": {
                                                borderColor: alpha(
                                                    theme.palette.common.white,
                                                    0.8
                                                ),
                                                backgroundColor: alpha(
                                                    theme.palette.common.white,
                                                    0.2
                                                ),
                                                color:
                                                    theme.palette.primary
                                                        .contrastText ||
                                                    "rgba(255, 255, 255, 1)",
                                            },
                                        }}
                                    >
                                        {t(
                                            "tooltips.guided_tooltip_close",
                                            "Close"
                                        )}
                                    </Button>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            gap: 0.75,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        {hasHistory && (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={previous}
                                                sx={{
                                                    minWidth: 60,
                                                    fontSize: "0.7rem",
                                                    py: 0.25,
                                                    px: 1,
                                                    borderColor: alpha(
                                                        theme.palette.common
                                                            .white,
                                                        0.5
                                                    ),
                                                    color:
                                                        theme.palette.primary
                                                            .contrastText ||
                                                        "rgba(255, 255, 255, 0.87)",
                                                    fontWeight: 500,
                                                    "&:hover": {
                                                        borderColor: alpha(
                                                            theme.palette.common
                                                                .white,
                                                            0.8
                                                        ),
                                                        backgroundColor: alpha(
                                                            theme.palette.common
                                                                .white,
                                                            0.15
                                                        ),
                                                        color:
                                                            theme.palette
                                                                .primary
                                                                .contrastText ||
                                                            "rgba(255, 255, 255, 1)",
                                                    },
                                                }}
                                            >
                                                {t(
                                                    "tooltips.guided_tooltip_back",
                                                    "Back"
                                                )}
                                            </Button>
                                        )}
                                        <Button
                                            size="small"
                                            variant="contained"
                                            onClick={next}
                                            sx={{
                                                minWidth: 60,
                                                fontSize: "0.7rem",
                                                py: 0.25,
                                                px: 1,
                                                backgroundColor: alpha(
                                                    theme.palette.common.white,
                                                    0.2
                                                ),
                                                color: "inherit",
                                                "&:hover": {
                                                    backgroundColor: alpha(
                                                        theme.palette.common
                                                            .white,
                                                        0.3
                                                    ),
                                                },
                                            }}
                                        >
                                            {t(
                                                "tooltips.guided_tooltip_next",
                                                "Next"
                                            )}
                                        </Button>
                                    </Box>
                                </Box>
                            </Paper>
                        </Fade>
                    </ClickAwayListener>
                </Box>
            </Portal>
        );
    }

    return (
        <Portal>
            <Popper
                open={open}
                anchorEl={anchorEl}
                placement={activeTooltip.placement || "bottom"}
                modifiers={[
                    {
                        name: "offset",
                        options: {
                            offset: [
                                activeTooltip.offset?.x || 0,
                                activeTooltip.offset?.y || 8,
                            ],
                        },
                    },
                    {
                        name: "flip",
                        enabled: false, // Disable auto-flip to prevent Popper from changing placement
                    },
                    {
                        name: "preventOverflow",
                        options: {
                            altAxis: true,
                            altBoundary: true,
                            tether: false,
                            rootBoundary: "viewport",
                            padding: 8,
                        },
                    },
                ]}
                style={{ zIndex: theme.zIndex.tooltip + 1 }}
            >
                <ClickAwayListener onClickAway={() => {}}>
                    <Fade in={open} timeout={300}>
                        <Paper
                            elevation={0}
                            sx={{
                                backgroundColor: "rgb(196, 181, 253)",
                                color:
                                    theme.palette.primary.contrastText ||
                                    "rgba(255, 255, 255, 0.87)",
                                fontSize: "0.75rem",
                                padding: theme.spacing(1, 1.5),
                                borderRadius: theme.shape.borderRadius,
                                boxShadow: theme.shadows[4],
                                maxWidth: 320,
                                minWidth: 200,
                                position: "relative",
                                "&::after": {
                                    content: '""',
                                    position: "absolute",
                                    width: 0,
                                    height: 0,
                                    borderStyle: "solid",
                                    zIndex: 1,
                                    pointerEvents: "none",
                                    ...(getPlacement() === "top" && {
                                        // Tooltip is above, arrow points down
                                        bottom: "-8px",
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        borderWidth: "8px 8px 0 8px",
                                        borderColor: `rgb(196, 181, 253) transparent transparent transparent`,
                                    }),
                                    ...(getPlacement() === "bottom" && {
                                        // Tooltip is below, arrow points up
                                        top: "-8px",
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        borderWidth: "0 8px 8px 8px",
                                        borderColor: `transparent transparent rgb(196, 181, 253) transparent`,
                                    }),
                                    ...(getPlacement() === "left" && {
                                        // Tooltip is on left, arrow on right side pointing left
                                        right: "-8px",
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        borderWidth: "8px 0 8px 8px",
                                        borderColor: `transparent transparent transparent rgb(196, 181, 253)`,
                                    }),
                                    ...(getPlacement() === "right" && {
                                        // Tooltip is on right, arrow points left
                                        left: "-8px",
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        borderWidth: "8px 8px 8px 0",
                                        borderColor: `transparent rgb(196, 181, 253) transparent transparent`,
                                    }),
                                },
                            }}
                            ref={popperRef}
                            role="tooltip"
                            aria-labelledby="tooltip-title"
                            aria-describedby="tooltip-message"
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    mb: 1,
                                    gap: 1,
                                }}
                            >
                                <Typography
                                    id="tooltip-message"
                                    variant="body2"
                                    sx={{
                                        fontSize: "0.75rem",
                                        lineHeight: 1.5,
                                        color: "inherit",
                                        flex: 1,
                                    }}
                                >
                                    {message}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontSize: "0.7rem",
                                        opacity: 0.9,
                                        whiteSpace: "nowrap",
                                        ml: 1,
                                    }}
                                >
                                    {t("tooltips.guided_tooltip_counter", {
                                        current: sessionCount + 1,
                                        limit: 3,
                                        defaultValue: `${sessionCount + 1}/3`,
                                    })}
                                </Typography>
                            </Box>

                            <Box
                                sx={{
                                    display: "flex",
                                    gap: 0.75,
                                    justifyContent: "space-between",
                                    flexWrap: "wrap",
                                    mt: 1,
                                }}
                            >
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={close}
                                    sx={{
                                        minWidth: 60,
                                        fontSize: "0.7rem",
                                        py: 0.25,
                                        px: 1,
                                        borderColor: alpha(
                                            theme.palette.common.white,
                                            0.5
                                        ),
                                        backgroundColor: alpha(
                                            theme.palette.common.white,
                                            0.1
                                        ),
                                        color:
                                            theme.palette.primary
                                                .contrastText ||
                                            "rgba(255, 255, 255, 0.87)",
                                        fontWeight: 500,
                                        "&:hover": {
                                            borderColor: alpha(
                                                theme.palette.common.white,
                                                0.8
                                            ),
                                            backgroundColor: alpha(
                                                theme.palette.common.white,
                                                0.2
                                            ),
                                            color:
                                                theme.palette.primary
                                                    .contrastText ||
                                                "rgba(255, 255, 255, 1)",
                                        },
                                    }}
                                >
                                    {t(
                                        "tooltips.guided_tooltip_close",
                                        "Close"
                                    )}
                                </Button>
                                <Box
                                    sx={{
                                        display: "flex",
                                        gap: 0.75,
                                        flexWrap: "wrap",
                                    }}
                                >
                                    {hasHistory && (
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={previous}
                                            sx={{
                                                minWidth: 60,
                                                fontSize: "0.7rem",
                                                py: 0.25,
                                                px: 1,
                                                borderColor: alpha(
                                                    theme.palette.common.white,
                                                    0.5
                                                ),
                                                color:
                                                    theme.palette.primary
                                                        .contrastText ||
                                                    "rgba(255, 255, 255, 0.87)",
                                                fontWeight: 500,
                                                "&:hover": {
                                                    borderColor: alpha(
                                                        theme.palette.common
                                                            .white,
                                                        0.8
                                                    ),
                                                    backgroundColor: alpha(
                                                        theme.palette.common
                                                            .white,
                                                        0.15
                                                    ),
                                                    color:
                                                        theme.palette.primary
                                                            .contrastText ||
                                                        "rgba(255, 255, 255, 1)",
                                                },
                                            }}
                                        >
                                            {t(
                                                "tooltips.guided_tooltip_back",
                                                "Back"
                                            )}
                                        </Button>
                                    )}
                                    <Button
                                        size="small"
                                        variant="contained"
                                        onClick={next}
                                        sx={{
                                            minWidth: 60,
                                            fontSize: "0.7rem",
                                            py: 0.25,
                                            px: 1,
                                            backgroundColor: alpha(
                                                theme.palette.common.white,
                                                0.2
                                            ),
                                            color: "inherit",
                                            "&:hover": {
                                                backgroundColor: alpha(
                                                    theme.palette.common.white,
                                                    0.3
                                                ),
                                            },
                                        }}
                                    >
                                        {t(
                                            "tooltips.guided_tooltip_next",
                                            "Next"
                                        )}
                                    </Button>
                                </Box>
                            </Box>
                        </Paper>
                    </Fade>
                </ClickAwayListener>
            </Popper>
        </Portal>
    );
}
