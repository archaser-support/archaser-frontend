import {
    Box,
    Button,
    type ButtonProps,
    Link,
    Paper,
    styled,
} from "@mui/material";

// Shared styled components for auth pages
export const AuthPaper = styled(Paper)(({ theme }) => ({
    borderRadius: theme.spacing(2),
    overflow: "hidden",
    background: "transparent",
    border: "none",
    outline: "none",
    boxShadow: `0 25px 50px -12px ${theme.palette.common.black}25`,
    maxWidth: "400px",
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
    "& .MuiCardContent-root": {
        background: "rgba(255, 255, 255, 0.98)",
        WebkitBackdropFilter: "blur(20px)",
        backdropFilter: "blur(20px)",
        "@supports not (backdrop-filter: blur(20px))": {
            background: "rgba(255, 255, 255, 1)",
        },
    },
    [theme.breakpoints.down("md")]: {
        borderRadius: theme.shape.borderRadius,
    },
}));

export const AuthHeaderSection = styled(Box)(({ theme }) => ({
    width: "100%",
    boxSizing: "border-box",
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
    color: theme.palette.primary.contrastText,
    textAlign: "center",
    padding: theme.spacing(4, 3),
    position: "relative",
    overflow: "hidden",
    border: "none",
    outline: "none",
    borderTopLeftRadius: theme.spacing(2),
    borderTopRightRadius: theme.spacing(2),
    "&::before": {
        content: '""',
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background:
            "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)",
    },
    [theme.breakpoints.down("md")]: {
        padding: theme.spacing(3, 2),
        borderTopLeftRadius: theme.shape.borderRadius,
        borderTopRightRadius: theme.shape.borderRadius,
    },
}));

export const AuthIconContainer = styled(Box)(({ theme }) => ({
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: `0 auto ${theme.spacing(2)}`,
    border: "none",
    boxShadow: "none",
    [theme.breakpoints.down("md")]: {
        width: 60,
        height: 60,
    },
}));

/** Always size="small" (32px) with pill radius = height / 2 (16px). */
export const AuthButton = styled((props: ButtonProps) => (
    <Button {...props} size="small" />
))(({ theme }) => {
    const small = theme.appButton.sizeSmall;
    const pillRadiusPx = `${small.height / 2}px`;

    const compactStyles = {
        minHeight: `${small.minHeight}px`,
        height: `${small.height}px`,
        minWidth: `${small.minWidth}px`,
        padding: `${small.paddingY}px ${theme.spacing(small.paddingX)}`,
        fontSize: small.fontSize,
        lineHeight: String(small.lineHeight),
        borderRadius: pillRadiusPx,
    };

    return {
        ...compactStyles,
        // Theme sets sizeMedium to 18.5px radius — keep pill shape if size is overridden
        "&.MuiButton-sizeSmall, &.MuiButton-sizeMedium": compactStyles,
        fontWeight: theme.typography.fontWeightBold,
        textTransform: "none",
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
        boxShadow: `0 4px 12px ${theme.palette.primary.main}40`,
        transition: "all 0.3s ease",
        "&:hover": {
            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
            transform: "translateY(-2px)",
            boxShadow: `0 8px 25px ${theme.palette.primary.main}60`,
        },
        "&:active": {
            transform: "translateY(0)",
            boxShadow: `0 4px 12px ${theme.palette.primary.main}40`,
        },
        "&:disabled": {
            background: theme.palette.action.disabledBackground,
            transform: "none",
            boxShadow: "none",
        },
    };
});

export const AuthLink = styled(Link)(({ theme }) => ({
    color: theme.palette.primary.main,
    textDecoration: "none",
    fontWeight: theme.typography.fontWeightBold,
    transition: "color 0.2s ease",
    "&:hover": {
        color: theme.palette.primary.dark,
    },
}));

export const AuthContainer = styled(Box)(({ theme }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    py: theme.spacing(4),
    px: theme.spacing(2),
    [theme.breakpoints.down("md")]: {
        py: theme.spacing(2),
        px: theme.spacing(1),
    },
}));
