"use client";

import {
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon,
} from "@mui/icons-material";
import {
    Box,
    Typography,
    Card,
    CardContent,
    alpha,
    useTheme,
    Chip,
} from "@mui/material";
import React from "react";

export default function StatusChipsPage() {
    const theme = useTheme();

    const chipDesigns = [
        {
            id: 1,
            name: "Theme Variant Active",
            description: "Uses theme data-status variant for active state",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                        label="Active"
                        size="small"
                        data-status="active"
                    />
                    <Chip
                        label="Inactive"
                        size="small"
                        data-status="inactive"
                    />
                </Box>
            ),
        },
        {
            id: 2,
            name: "Success/Default Colors",
            description: "Success color for active, default for inactive",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                        label="Active"
                        size="small"
                        color="success"
                        variant="outlined"
                    />
                    <Chip
                        label="Inactive"
                        size="small"
                        color="default"
                        variant="outlined"
                    />
                </Box>
            ),
        },
        {
            id: 3,
            name: "Filled Variants",
            description: "Filled chips with success and error colors",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                        label="Active"
                        size="small"
                        color="success"
                    />
                    <Chip
                        label="Inactive"
                        size="small"
                        color="default"
                    />
                </Box>
            ),
        },
        {
            id: 4,
            name: "With Icons",
            description: "Status chips with check and cancel icons",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                        icon={<CheckCircleIcon />}
                        label="Active"
                        size="small"
                        color="success"
                        variant="outlined"
                    />
                    <Chip
                        icon={<CancelIcon />}
                        label="Inactive"
                        size="small"
                        color="default"
                        variant="outlined"
                    />
                </Box>
            ),
        },
        {
            id: 5,
            name: "Custom Colors",
            description: "Custom green for active, grey for inactive",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                        label="Active"
                        size="small"
                        sx={{
                            backgroundColor: "#10B981",
                            color: "white",
                            fontWeight: 500,
                        }}
                    />
                    <Chip
                        label="Inactive"
                        size="small"
                        sx={{
                            backgroundColor: theme.palette.grey[300],
                            color: theme.palette.text.secondary,
                            fontWeight: 500,
                        }}
                    />
                </Box>
            ),
        },
        {
            id: 6,
            name: "Soft Backgrounds",
            description: "Light backgrounds with colored text",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                        label="Active"
                        size="small"
                        sx={{
                            backgroundColor: alpha(theme.palette.success.main, 0.1),
                            color: theme.palette.success.main,
                            fontWeight: 500,
                        }}
                    />
                    <Chip
                        label="Inactive"
                        size="small"
                        sx={{
                            backgroundColor: alpha(theme.palette.grey[500], 0.1),
                            color: theme.palette.text.secondary,
                            fontWeight: 500,
                        }}
                    />
                </Box>
            ),
        },
        {
            id: 7,
            name: "Thick Borders",
            description: "Outlined with thick borders",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                        label="Active"
                        size="small"
                        variant="outlined"
                        color="success"
                        sx={{
                            borderWidth: 2,
                            fontWeight: 500,
                        }}
                    />
                    <Chip
                        label="Inactive"
                        size="small"
                        variant="outlined"
                        sx={{
                            borderWidth: 2,
                            borderColor: theme.palette.grey[400],
                            color: theme.palette.text.secondary,
                            fontWeight: 500,
                        }}
                    />
                </Box>
            ),
        },
        {
            id: 8,
            name: "Rounded Style",
            description: "Fully rounded corners",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                        label="Active"
                        size="small"
                        color="success"
                        sx={{
                            borderRadius: "16px",
                            fontWeight: 500,
                        }}
                    />
                    <Chip
                        label="Inactive"
                        size="small"
                        sx={{
                            borderRadius: "16px",
                            backgroundColor: theme.palette.grey[300],
                            color: theme.palette.text.secondary,
                            fontWeight: 500,
                        }}
                    />
                </Box>
            ),
        },
        {
            id: 9,
            name: "Small Size",
            description: "Compact size for tight spaces",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                        label="Active"
                        size="small"
                        data-status="active"
                    />
                    <Chip
                        label="Inactive"
                        size="small"
                        data-status="inactive"
                    />
                </Box>
            ),
        },
        {
            id: 10,
            name: "Large Size",
            description: "Larger chips with more padding",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                        label="Active"
                        color="success"
                        sx={{
                            height: 32,
                            fontSize: "0.875rem",
                            fontWeight: 500,
                        }}
                    />
                    <Chip
                        label="Inactive"
                        sx={{
                            height: 32,
                            fontSize: "0.875rem",
                            backgroundColor: theme.palette.grey[300],
                            color: theme.palette.text.secondary,
                            fontWeight: 500,
                        }}
                    />
                </Box>
            ),
        },
        {
            id: 11,
            name: "Dashed Borders",
            description: "Dashed outline style",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                        label="Active"
                        size="small"
                        sx={{
                            border: `2px dashed ${theme.palette.success.main}`,
                            backgroundColor: "transparent",
                            color: theme.palette.success.main,
                            fontWeight: 500,
                        }}
                    />
                    <Chip
                        label="Inactive"
                        size="small"
                        sx={{
                            border: `2px dashed ${theme.palette.grey[400]}`,
                            backgroundColor: "transparent",
                            color: theme.palette.text.secondary,
                            fontWeight: 500,
                        }}
                    />
                </Box>
            ),
        },
        {
            id: 12,
            name: "Primary/Secondary",
            description: "Primary color for active, secondary for inactive",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                        label="Active"
                        size="small"
                        color="primary"
                    />
                    <Chip
                        label="Inactive"
                        size="small"
                        color="secondary"
                    />
                </Box>
            ),
        },
        {
            id: 13,
            name: "With Dot Indicators",
            description: "Custom chips with dot indicators",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Box
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                            px: 1.5,
                            py: 0.5,
                            borderRadius: "16px",
                            backgroundColor: alpha(theme.palette.success.main, 0.1),
                            color: theme.palette.success.main,
                            fontWeight: 500,
                            fontSize: "0.75rem",
                        }}
                    >
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                backgroundColor: theme.palette.success.main,
                            }}
                        />
                        Active
                    </Box>
                    <Box
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                            px: 1.5,
                            py: 0.5,
                            borderRadius: "16px",
                            backgroundColor: alpha(theme.palette.grey[500], 0.1),
                            color: theme.palette.text.secondary,
                            fontWeight: 500,
                            fontSize: "0.75rem",
                        }}
                    >
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                backgroundColor: theme.palette.grey[500],
                            }}
                        />
                        Inactive
                    </Box>
                </Box>
            ),
        },
        {
            id: 14,
            name: "Minimal Text",
            description: "Simple text style with colored backgrounds",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Box
                        sx={{
                            px: 1.5,
                            py: 0.25,
                            borderRadius: 1,
                            backgroundColor: theme.palette.success.main,
                            color: "white",
                            fontWeight: 500,
                            fontSize: "0.75rem",
                        }}
                    >
                        Active
                    </Box>
                    <Box
                        sx={{
                            px: 1.5,
                            py: 0.25,
                            borderRadius: 1,
                            backgroundColor: theme.palette.grey[400],
                            color: "white",
                            fontWeight: 500,
                            fontSize: "0.75rem",
                        }}
                    >
                        Inactive
                    </Box>
                </Box>
            ),
        },
        {
            id: 15,
            name: "Icon Only Variants",
            description: "Icons with status indicators",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                        icon={<CheckCircleIcon />}
                        label="Active"
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{
                            "& .MuiChip-icon": {
                                color: theme.palette.success.main,
                            },
                        }}
                    />
                    <Chip
                        icon={<RadioButtonUncheckedIcon />}
                        label="Inactive"
                        size="small"
                        variant="outlined"
                        sx={{
                            borderColor: theme.palette.grey[400],
                            color: theme.palette.text.secondary,
                            "& .MuiChip-icon": {
                                color: theme.palette.text.secondary,
                            },
                        }}
                    />
                </Box>
            ),
        },
        {
            id: 16,
            name: "Gradient Backgrounds",
            description: "Modern gradient effects",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                        label="Active"
                        size="small"
                        sx={{
                            background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                            color: "white",
                            fontWeight: 500,
                            boxShadow: `0 2px 8px ${alpha("#10B981", 0.3)}`,
                        }}
                    />
                    <Chip
                        label="Inactive"
                        size="small"
                        sx={{
                            background: "linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)",
                            color: "white",
                            fontWeight: 500,
                            boxShadow: `0 2px 8px ${alpha("#9CA3AF", 0.3)}`,
                        }}
                    />
                </Box>
            ),
        },
        {
            id: 17,
            name: "Elevated Cards",
            description: "Card-like appearance with shadows",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Box
                        sx={{
                            px: 1.5,
                            py: 0.75,
                            borderRadius: 2,
                            backgroundColor: theme.palette.success.main,
                            color: "white",
                            fontWeight: 500,
                            fontSize: "0.75rem",
                            boxShadow: `0 4px 12px ${alpha(theme.palette.success.main, 0.4)}`,
                        }}
                    >
                        Active
                    </Box>
                    <Box
                        sx={{
                            px: 1.5,
                            py: 0.75,
                            borderRadius: 2,
                            backgroundColor: theme.palette.grey[400],
                            color: "white",
                            fontWeight: 500,
                            fontSize: "0.75rem",
                            boxShadow: `0 4px 12px ${alpha(theme.palette.grey[400], 0.4)}`,
                        }}
                    >
                        Inactive
                    </Box>
                </Box>
            ),
        },
        {
            id: 18,
            name: "Left Border Accent",
            description: "Colored left border accent",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 1,
                            backgroundColor: "white",
                            borderLeft: `4px solid ${theme.palette.success.main}`,
                            color: theme.palette.text.primary,
                            fontWeight: 500,
                            fontSize: "0.75rem",
                            boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.1)}`,
                        }}
                    >
                        Active
                    </Box>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 1,
                            backgroundColor: "white",
                            borderLeft: `4px solid ${theme.palette.grey[400]}`,
                            color: theme.palette.text.secondary,
                            fontWeight: 500,
                            fontSize: "0.75rem",
                            boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.1)}`,
                        }}
                    >
                        Inactive
                    </Box>
                </Box>
            ),
        },
        {
            id: 19,
            name: "Pill Shape",
            description: "Extra rounded pill-shaped chips",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                        label="Active"
                        size="small"
                        color="success"
                        sx={{
                            borderRadius: "20px",
                            height: 28,
                            fontWeight: 500,
                        }}
                    />
                    <Chip
                        label="Inactive"
                        size="small"
                        sx={{
                            borderRadius: "20px",
                            height: 28,
                            backgroundColor: theme.palette.grey[300],
                            color: theme.palette.text.secondary,
                            fontWeight: 500,
                        }}
                    />
                </Box>
            ),
        },
        {
            id: 20,
            name: "Glow Effect",
            description: "Neon glow effect on hover",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                        label="Active"
                        size="small"
                        sx={{
                            backgroundColor: theme.palette.success.main,
                            color: "white",
                            fontWeight: 500,
                            boxShadow: `0 0 10px ${alpha(theme.palette.success.main, 0.5)}`,
                            "&:hover": {
                                boxShadow: `0 0 20px ${alpha(theme.palette.success.main, 0.8)}`,
                            },
                        }}
                    />
                    <Chip
                        label="Inactive"
                        size="small"
                        sx={{
                            backgroundColor: theme.palette.grey[400],
                            color: "white",
                            fontWeight: 500,
                            boxShadow: `0 0 10px ${alpha(theme.palette.grey[400], 0.3)}`,
                        }}
                    />
                </Box>
            ),
        },
        {
            id: 21,
            name: "Split Color Design",
            description: "Two-tone color split",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Box
                        sx={{
                            display: "flex",
                            overflow: "hidden",
                            borderRadius: 1,
                            boxShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.1)}`,
                        }}
                    >
                        <Box
                            sx={{
                                px: 1,
                                py: 0.5,
                                backgroundColor: theme.palette.success.main,
                                color: "white",
                                fontWeight: 600,
                                fontSize: "0.7rem",
                            }}
                        >
                            ●
                        </Box>
                        <Box
                            sx={{
                                px: 1.5,
                                py: 0.5,
                                backgroundColor: alpha(theme.palette.success.main, 0.1),
                                color: theme.palette.success.main,
                                fontWeight: 500,
                                fontSize: "0.75rem",
                            }}
                        >
                            Active
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            display: "flex",
                            overflow: "hidden",
                            borderRadius: 1,
                            boxShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.1)}`,
                        }}
                    >
                        <Box
                            sx={{
                                px: 1,
                                py: 0.5,
                                backgroundColor: theme.palette.grey[400],
                                color: "white",
                                fontWeight: 600,
                                fontSize: "0.7rem",
                            }}
                        >
                            ○
                        </Box>
                        <Box
                            sx={{
                                px: 1.5,
                                py: 0.5,
                                backgroundColor: alpha(theme.palette.grey[400], 0.1),
                                color: theme.palette.text.secondary,
                                fontWeight: 500,
                                fontSize: "0.75rem",
                            }}
                        >
                            Inactive
                        </Box>
                    </Box>
                </Box>
            ),
        },
        {
            id: 22,
            name: "Bold Typography",
            description: "Extra bold text with minimal styling",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Typography
                        variant="body2"
                        sx={{
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 1,
                            backgroundColor: alpha(theme.palette.success.main, 0.15),
                            color: theme.palette.success.main,
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            letterSpacing: "0.5px",
                        }}
                    >
                        ACTIVE
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 1,
                            backgroundColor: alpha(theme.palette.grey[500], 0.15),
                            color: theme.palette.text.secondary,
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            letterSpacing: "0.5px",
                        }}
                    >
                        INACTIVE
                    </Typography>
                </Box>
            ),
        },
        {
            id: 23,
            name: "Status Bar Style",
            description: "Horizontal bar indicator style",
            component: (
                <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        <Box
                            sx={{
                                width: 60,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: theme.palette.success.main,
                            }}
                        />
                        <Typography
                            variant="caption"
                            sx={{
                                color: theme.palette.success.main,
                                fontWeight: 500,
                                fontSize: "0.7rem",
                            }}
                        >
                            Active
                        </Typography>
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        <Box
                            sx={{
                                width: 60,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: theme.palette.grey[400],
                            }}
                        />
                        <Typography
                            variant="caption"
                            sx={{
                                color: theme.palette.text.secondary,
                                fontWeight: 500,
                                fontSize: "0.7rem",
                            }}
                        >
                            Inactive
                        </Typography>
                    </Box>
                </Box>
            ),
        },
        {
            id: 24,
            name: "3D Effect",
            description: "Three-dimensional appearance",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Box
                        sx={{
                            px: 1.5,
                            py: 0.75,
                            borderRadius: 1,
                            background: `linear-gradient(145deg, ${theme.palette.success.dark} 0%, ${theme.palette.success.main} 100%)`,
                            color: "white",
                            fontWeight: 500,
                            fontSize: "0.75rem",
                            boxShadow: `inset 0 2px 4px ${alpha("#fff", 0.2)}, 0 4px 8px ${alpha(theme.palette.success.main, 0.3)}`,
                        }}
                    >
                        Active
                    </Box>
                    <Box
                        sx={{
                            px: 1.5,
                            py: 0.75,
                            borderRadius: 1,
                            background: `linear-gradient(145deg, ${theme.palette.grey[500]} 0%, ${theme.palette.grey[400]} 100%)`,
                            color: "white",
                            fontWeight: 500,
                            fontSize: "0.75rem",
                            boxShadow: `inset 0 2px 4px ${alpha("#fff", 0.1)}, 0 4px 8px ${alpha(theme.palette.grey[400], 0.2)}`,
                        }}
                    >
                        Inactive
                    </Box>
                </Box>
            ),
        },
        {
            id: 25,
            name: "Minimalist Outline",
            description: "Ultra-minimal with thin borders",
            component: (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Box
                        sx={{
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 0.5,
                            border: `1px solid ${theme.palette.success.main}`,
                            backgroundColor: "transparent",
                            color: theme.palette.success.main,
                            fontWeight: 400,
                            fontSize: "0.75rem",
                        }}
                    >
                        Active
                    </Box>
                    <Box
                        sx={{
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 0.5,
                            border: `1px solid ${theme.palette.grey[300]}`,
                            backgroundColor: "transparent",
                            color: theme.palette.text.secondary,
                            fontWeight: 400,
                            fontSize: "0.75rem",
                        }}
                    >
                        Inactive
                    </Box>
                </Box>
            ),
        },
    ];

    return (
        <Box
            sx={{
                p: { xs: 2, sm: 3, md: 4 },
                maxWidth: "1400px",
                mx: "auto",
            }}
        >
            <Box sx={{ mb: 4 }}>
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: 600,
                        mb: 1,
                        color: theme.palette.text.primary,
                    }}
                >
                    Status Chip Designs
                </Typography>
                <Typography
                    variant="body1"
                    sx={{
                        color: theme.palette.text.secondary,
                        mb: 2,
                    }}
                >
                    Explore different designs for displaying active and inactive status. Each design shows both states.
                </Typography>
            </Box>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, 1fr)",
                        md: "repeat(3, 1fr)",
                    },
                    gap: 3,
                }}
            >
                {chipDesigns.map((design) => (
                    <Card
                        key={design.id}
                        sx={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.1)}`,
                            transition: "all 0.3s ease",
                            "&:hover": {
                                boxShadow: `0 4px 16px ${alpha(theme.palette.common.black, 0.15)}`,
                                transform: "translateY(-2px)",
                            },
                        }}
                    >
                        <CardContent
                            sx={{
                                flexGrow: 1,
                                display: "flex",
                                flexDirection: "column",
                                p: 3,
                            }}
                        >
                            <Typography
                                variant="h6"
                                sx={{
                                    fontWeight: 600,
                                    mb: 1,
                                    color: theme.palette.text.primary,
                                }}
                            >
                                {design.name}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: theme.palette.text.secondary,
                                    mb: 3,
                                    flexGrow: 1,
                                }}
                            >
                                {design.description}
                            </Typography>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    minHeight: "60px",
                                    border: `1px dashed ${theme.palette.divider}`,
                                    borderRadius: 1,
                                    p: 2,
                                    backgroundColor: alpha(
                                        theme.palette.background.paper,
                                        0.5
                                    ),
                                }}
                            >
                                {design.component}
                            </Box>
                        </CardContent>
                    </Card>
                ))}
            </Box>

            <Box
                sx={{
                    mt: 4,
                    p: 3,
                    backgroundColor: alpha(theme.palette.primary.main, 0.05),
                    borderRadius: 2,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                }}
            >
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 600,
                        mb: 1,
                        color: theme.palette.text.primary,
                    }}
                >
                    Usage Notes
                </Typography>
                <Typography
                    variant="body2"
                    sx={{
                        color: theme.palette.text.secondary,
                        mb: 2,
                    }}
                >
                    • Use status chips to clearly indicate active and inactive states
                </Typography>
                <Typography
                    variant="body2"
                    sx={{
                        color: theme.palette.text.secondary,
                        mb: 2,
                    }}
                >
                    • Theme variants with data-status prop provide consistent styling across the application
                </Typography>
                <Typography
                    variant="body2"
                    sx={{
                        color: theme.palette.text.secondary,
                        mb: 2,
                    }}
                >
                    • Choose colors that provide good contrast and are accessible (green for active, grey for inactive)
                </Typography>
                <Typography
                    variant="body2"
                    sx={{
                        color: theme.palette.text.secondary,
                    }}
                >
                    • Consider using icons to enhance visual recognition of status states
                </Typography>
            </Box>
        </Box>
    );
}

