"use client";

import {
    AccountCircle,
    Close as CloseIcon,
    Search as SearchIcon,
} from "@mui/icons-material";
import {
    Menu,
    Box,
    Typography,
    Divider,
    IconButton,
    Avatar,
    ListItemIcon,
    ListItemText,
    MenuItem,
    CircularProgress,
    TextField,
    InputAdornment,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { getPastelColorForUser } from "@/utils/avatarUtils";

type TransitionAny = React.ComponentType<any>;

interface ViewAsMenuProps {
    anchorEl: HTMLElement | null;
    open: boolean;
    onClose: () => void;
    isHebrewUser: boolean;
    isViewAsActive: boolean;
    collectionAgents: Array<any>;
    loading: boolean;
    onSelectUser: (userId: string) => void;
    TransitionComponent?: TransitionAny;
    headerRef?: React.RefObject<HTMLDivElement>;
}

const ViewAsMenu: React.FC<ViewAsMenuProps> = ({
    anchorEl,
    open,
    onClose,
    isHebrewUser,
    isViewAsActive,
    collectionAgents,
    loading,
    onSelectUser,
    TransitionComponent,
    headerRef,
}) => {
    const { t } = useTranslation(["common", "activities"]);
    const headerSpacing = { gap: 0.5, px: 1, py: 0.25 } as const;
    const [searchTerm, setSearchTerm] = useState("");

    // Filter collection agents based on search term
    const filteredAgents = useMemo(() => {
        if (!searchTerm.trim()) {
            return collectionAgents;
        }

        const searchLower = searchTerm.toLowerCase().trim();
        return collectionAgents.filter((agent: any) => {
            // Construct name from first_name + last_name if name is not available
            const agentName =
                agent.name ||
                (agent.first_name && agent.last_name
                    ? `${agent.first_name} ${agent.last_name}`.trim()
                    : agent.first_name ||
                      agent.last_name ||
                      agent.email ||
                      `Agent ${agent.id}`);

            const businessUnitName = (
                agent.businessUnitName ||
                agent.BusinessUnit?.name ||
                ""
            ).toLowerCase();
            const email = (agent.email || "").toLowerCase();
            const name = agentName.toLowerCase();

            return (
                name.includes(searchLower) ||
                email.includes(searchLower) ||
                businessUnitName.includes(searchLower)
            );
        });
    }, [collectionAgents, searchTerm]);

    // Reset search when menu closes
    React.useEffect(() => {
        if (!open) {
            setSearchTerm("");
        }
    }, [open]);

    return (
        <Menu
            sx={{ zIndex: (theme) => theme.zIndex.drawer - 2 }}
            anchorEl={anchorEl}
            open={open}
            onClose={onClose}
            TransitionComponent={TransitionComponent as any}
            anchorOrigin={{
                vertical: "bottom",
                horizontal: isHebrewUser ? "left" : "right",
            }}
            transformOrigin={{
                vertical: "top",
                horizontal: isHebrewUser ? "left" : "right",
            }}
            MenuListProps={{
                sx: {
                    padding: 0,
                },
            }}
            PaperProps={{
                sx: {
                    zIndex: (theme) => theme.zIndex.drawer - 2,
                    mt: 1.5,
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    backdropFilter: "blur(20px)",
                    border: "none",
                    // sx multiplies bare numbers by theme.shape.borderRadius (4) — use px
                    borderRadius: (theme) =>
                        `${theme.appButton.sizeMedium.borderRadius}px`,
                    overflow: "hidden",
                    "& .MuiList-root": {
                        padding: 0,
                    },
                    maxHeight: 400,
                    minWidth: 350,
                    maxWidth: 450,
                    direction: isHebrewUser ? "rtl" : "ltr",
                    transform: isHebrewUser ? undefined : "translateX(1px)",
                    boxShadow:
                        "0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08)",
                    "& .MuiMenuItem-root": {
                        color: (theme) => theme.palette.text.primary,
                        "&:hover": {
                            backgroundColor: (theme) =>
                                alpha(theme.palette.primary.main, 0.1),
                        },
                    },
                },
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    boxSizing: "border-box",
                    ...headerSpacing,
                    background: (theme) =>
                        isViewAsActive
                            ? theme.palette.error.main
                            : theme.palette.primary.main,
                    color: (theme) => theme.palette.common.white,
                    direction: isHebrewUser ? "rtl" : "ltr",
                }}
                ref={headerRef}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: headerSpacing.gap,
                        flex: 1,
                        minWidth: 0,
                        direction: isHebrewUser ? "rtl" : "ltr",
                    }}
                >
                    <AccountCircle sx={{ flexShrink: 0 }} />
                    <Typography
                        variant={isHebrewUser ? "hebrewSubtitle" : "subtitle1"}
                        component="span"
                        sx={{
                            fontWeight: 700,
                            color: "white",
                            flex: 1,
                            minWidth: 0,
                            display: "block",
                            ...(isHebrewUser
                                ? {
                                      textAlign: "right",
                                      direction: "rtl",
                                  }
                                : {
                                      textAlign: "left",
                                  }),
                        }}
                    >
                        {t("actions.select_user_to_view_as")}
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    sx={{
                        color: (theme) => theme.palette.common.white,
                        p: 0.5,
                    }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>
            <Divider />
            {/* Search Field */}
            <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder={t("actions.search", {
                        ns: "common",
                        defaultValue: "Search...",
                    })}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    dir={isHebrewUser ? "rtl" : "ltr"}
                    sx={{
                        "& .MuiOutlinedInput-root": {
                            backgroundColor: "rgba(255, 255, 255, 0.8)",
                            "&:hover": {
                                backgroundColor: "rgba(255, 255, 255, 0.9)",
                            },
                            "&.Mui-focused": {
                                backgroundColor: "rgba(255, 255, 255, 1)",
                            },
                        },
                    }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment
                                position="start"
                                sx={{
                                    ...(isHebrewUser && {
                                        marginRight: 0,
                                        marginLeft: 1,
                                    }),
                                }}
                            >
                                <SearchIcon
                                    fontSize="small"
                                    sx={{ color: "text.secondary" }}
                                />
                            </InputAdornment>
                        ),
                    }}
                    inputProps={{
                        dir: isHebrewUser ? "rtl" : "ltr",
                        style: {
                            textAlign: isHebrewUser ? "right" : "left",
                            direction: isHebrewUser ? "rtl" : "ltr",
                        },
                    }}
                />
            </Box>
            <Divider />
            <Box
                sx={{
                    maxHeight: 300,
                    overflowY: "auto",
                    overflowX: "hidden",
                }}
            >
                {loading ? (
                    <Box
                        sx={{ p: 2, display: "flex", justifyContent: "center" }}
                    >
                        <CircularProgress size={24} />
                    </Box>
                ) : filteredAgents.length === 0 ? (
                    <MenuItem disabled>
                        <ListItemText
                            primary={
                                searchTerm.trim()
                                    ? t("messages.no_results_found", {
                                          ns: "common",
                                          defaultValue: "No results found",
                                      })
                                    : t(
                                          "messages.no_collection_agents_available",
                                          { ns: "users" }
                                      ) || "No collection agents available"
                            }
                            primaryTypographyProps={{
                                color: "text.secondary",
                                variant: "body2",
                                ...(isHebrewUser && {
                                    textAlign: "right",
                                    direction: "rtl",
                                }),
                            }}
                        />
                    </MenuItem>
                ) : (
                    filteredAgents.map((agent: any) => {
                        // Construct name from first_name + last_name if name is not available
                        const agentName =
                            agent.name ||
                            (agent.first_name && agent.last_name
                                ? `${agent.first_name} ${agent.last_name}`.trim()
                                : agent.first_name ||
                                  agent.last_name ||
                                  agent.email ||
                                  `Agent ${agent.id}`);

                        // Construct secondary text with business unit name only
                        const businessUnitName =
                            agent.businessUnitName || agent.BusinessUnit?.name;
                        const secondaryText = businessUnitName || "";

                        return (
                            <MenuItem
                                key={agent.id}
                                onClick={() => {
                                    onSelectUser(agent.id);
                                    onClose();
                                }}
                                disabled={loading}
                            >
                                <ListItemIcon
                                    sx={{
                                        minWidth: isHebrewUser ? "auto" : 40,
                                        marginRight: isHebrewUser ? 0 : 1,
                                        marginLeft: isHebrewUser ? 1 : 0,
                                    }}
                                >
                                    <Avatar
                                        src={agent.image || undefined}
                                        sx={{
                                            width: 24,
                                            height: 24,
                                            fontSize: "0.7rem",
                                            bgcolor: getPastelColorForUser(
                                                agent.id
                                            ),
                                            color: "#333",
                                        }}
                                    >
                                        {agentName[0]?.toUpperCase() || "?"}
                                    </Avatar>
                                </ListItemIcon>
                                <ListItemText
                                    primary={agentName}
                                    secondary={secondaryText}
                                    primaryTypographyProps={{
                                        color: "text.primary",
                                        ...(isHebrewUser && {
                                            variant: "hebrewBodyText",
                                            textAlign: "right",
                                            direction: "rtl",
                                        }),
                                    }}
                                    secondaryTypographyProps={{
                                        color: "text.secondary",
                                        ...(isHebrewUser && {
                                            textAlign: "right",
                                            direction: "rtl",
                                        }),
                                    }}
                                />
                            </MenuItem>
                        );
                    })
                )}
            </Box>
        </Menu>
    );
};

export default ViewAsMenu;
