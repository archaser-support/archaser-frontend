"use client";

import { DragHandle } from "@mui/icons-material";
import {
    Box,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    useTheme,
} from "@mui/material";
import type { DialogProps } from "@mui/material/Dialog";
import Fade from "@mui/material/Fade";
import Slide from "@mui/material/Slide";
import { alpha } from "@mui/material/styles";
import React from "react";

import {
    useAppDialog,
    type UseAppDialogResizeOptions,
} from "@/shared/hooks/useAppDialog";


export interface AppDialogProps
    extends Omit<
        DialogProps,
        "title" | "PaperProps" | "TransitionComponent" | "TransitionProps"
    > {
    open: boolean;
    onClose: () => void;
    /** Draggable by title; shows DragHandle and grab cursor. Default true. */
    drag?: boolean;
    /** Edge alignment (right/left/bottom). Default true. */
    align?: boolean;
    /** Slide transition from edge; when false uses Fade (centered). Default true. */
    slide?: boolean;
    /** Resizable with width + height handles. Default false. */
    resize?: boolean;
    isRTL?: boolean;
    /** When resize is true. */
    resizeOptions?: UseAppDialogResizeOptions;
    /** Fixed width when not resize (e.g. "380px"). */
    paperWidth?: string;
    /** Max height when not resize (e.g. "90vh"). */
    paperMaxHeight?: string;
    title: React.ReactNode;
    titleIcon?: React.ReactNode;
    /** DialogContent id for aria-describedby. */
    ariaDescribedBy?: string;
    /** DialogTitle id for aria-labelledby. */
    ariaLabelledBy?: string;
    /** Id of the inner scroll container (e.g. ModalScrollBox); when set, enables scroll prevention for that container. */
    scrollContainerId?: string;
    /** Merged into Paper sx when align. */
    paperSx?: DialogProps["PaperProps"];

    children: React.ReactNode;
    actions?: React.ReactNode;
}

const AppDialog: React.FC<AppDialogProps> = ({
    open,
    onClose,
    drag = true,
    align = true,
    slide = true,
    resize = false,
    isRTL = false,
    resizeOptions,
    paperWidth,
    paperMaxHeight = "90vh",
    title,
    titleIcon,
    ariaDescribedBy,
    ariaLabelledBy,
    scrollContainerId,
    paperSx,

    children,
    actions,
    ...dialogProps
}) => {
    const theme = useTheme();

    const hook = useAppDialog({
        drag,
        align,
        slide,
        resize,
        isRTL,
        isOpen: open,
        resizeOptions,
    });

    const {
        dialogRef,
        handleDragStart,
        resetOnExited,
        slideDirection,
        getPaperPositionSx,
        handleResizeWidthStart,
        handleResizeHeightBottomStart,
        handleResizeHeightTopStart,
        isDragging,
    } = hook;

    const TransitionComponent = slide ? Slide : Fade;
    const transitionProps = slide
        ? { direction: slideDirection, onExited: resetOnExited }
        : { onExited: resetOnExited };

    const positionSx =
        align &&
        getPaperPositionSx(
            theme,
            resize
                ? {
                    width: hook.width,
                    height: hook.height,
                    topPosition: hook.topPosition,
                }
                : {
                    fixedWidth: paperWidth,
                    maxHeight: paperMaxHeight,
                }
        );

    const mergedPaperSx = {
        ...(typeof positionSx === "object" && positionSx !== null
            ? positionSx
            : {}),
        ...(paperSx?.sx && typeof paperSx.sx === "object"
            ? (paperSx.sx as Record<string, unknown>)
            : {}),
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            closeAfterTransition={false}
            TransitionComponent={TransitionComponent as any}
            TransitionProps={transitionProps as any}
            transitionDuration={{ enter: 300, exit: 200 }}
            PaperProps={{
                elevation: 0,
                role: "dialog",
                "aria-modal": "true",
                ref: dialogRef,
                dir: isRTL ? "rtl" : "ltr",
                ...paperSx,
                sx: mergedPaperSx,
            }}
            sx={{
                "& .MuiBackdrop-root": { zIndex: 99998 },
            }}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            {...dialogProps}
        >
            <DialogTitle
                id={ariaLabelledBy}
                component="h2"
                onMouseDown={drag ? handleDragStart : undefined}
                aria-label={typeof title === "string" ? title : undefined}
                sx={{
                    background: drag
                        ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`
                        : undefined,
                    color: "white",
                    fontSize: { xs: "1rem", sm: "1.25rem" },
                    fontWeight: 400,
                    textAlign: isRTL ? "right" : "left",
                    direction: isRTL ? "rtl" : "ltr",
                    cursor: drag ? (isDragging ? "grabbing" : "grab") : undefined,
                    userSelect: drag ? "none" : undefined,
                    position: "relative",
                    borderBottom: "none",
                    "& > .MuiDialogTitle-root": { paddingBottom: "0 !important" },
                    "& .MuiSvgIcon-root": {
                        fontSize: { xs: "1.5rem", sm: "1.75rem" },
                        color: "white",
                        transition: "transform 0.3s ease",
                    },
                    "&:hover .MuiSvgIcon-root": drag
                        ? { transform: "scale(1.1)" }
                        : undefined,
                }}
            >
                {drag && (
                    <DragHandle
                        sx={{
                            position: "absolute",
                            left: isRTL ? "auto" : 4,
                            right: isRTL ? 4 : "auto",
                            top: 4,
                            fontSize: "1.5rem",
                            opacity: 0.7,
                            cursor: isDragging ? "grabbing" : "grab",
                            "&:hover": { opacity: 1 },
                        }}
                    />
                )}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: theme.spacing(1),
                        flex: 1,
                        pb: "10px",
                    }}
                >
                    {titleIcon}
                    {title}
                </Box>
            </DialogTitle>
            <DialogContent
                id={ariaDescribedBy}
                aria-labelledby={ariaLabelledBy}
                aria-describedby={ariaDescribedBy}
                sx={{
                    "&:first-of-type": { paddingTop: theme.spacing(2) },
                    px: "40px",
                    direction: isRTL ? "rtl" : "ltr",
                }}
            >
                {children}
            </DialogContent>
            {actions != null && (
                <DialogActions
                    sx={{
                        direction: isRTL ? "rtl" : "ltr",
                        gap: theme.spacing(1),
                        px: theme.spacing(3),
                        pb: theme.spacing(2),
                        borderTop: "none",
                    }}
                >
                    {actions}
                </DialogActions>
            )}

            {/* Resize handles (8–48px skip on top so drag still works) */}
            {resize && (
                <>
                    <Box
                        onMouseDown={handleResizeWidthStart}
                        sx={{
                            position: "absolute",
                            [isRTL ? "right" : "left"]: 0,
                            top: 0,
                            bottom: 0,
                            width: "8px",
                            cursor: "col-resize",
                            backgroundColor: "transparent",
                            zIndex: 100000,
                            pointerEvents: "auto",
                            touchAction: "none",
                            userSelect: "none",
                            "&:hover": {
                                backgroundColor: alpha(
                                    theme.palette.primary.main,
                                    0.2
                                ),
                                [isRTL ? "borderRight" : "borderLeft"]: `2px solid ${theme.palette.primary.main}`,
                            },
                            "&:active": {
                                backgroundColor: alpha(
                                    theme.palette.primary.main,
                                    0.4
                                ),
                                [isRTL ? "borderRight" : "borderLeft"]: `2px solid ${theme.palette.primary.dark}`,
                            },
                        }}
                    />
                    <Box
                        onMouseDown={handleResizeHeightBottomStart}
                        sx={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: "8px",
                            cursor: "row-resize",
                            backgroundColor: "transparent",
                            zIndex: 100000,
                            pointerEvents: "auto",
                            touchAction: "none",
                            userSelect: "none",
                            "&:hover": {
                                backgroundColor: alpha(
                                    theme.palette.primary.main,
                                    0.2
                                ),
                                borderTop: `2px solid ${theme.palette.primary.main}`,
                            },
                            "&:active": {
                                backgroundColor: alpha(
                                    theme.palette.primary.main,
                                    0.4
                                ),
                                borderTop: `2px solid ${theme.palette.primary.dark}`,
                            },
                        }}
                    />
                    <Box
                        onMouseDown={(e: React.MouseEvent) => {
                            const rect =
                                dialogRef.current?.getBoundingClientRect();
                            if (rect) {
                                const yFromTop = e.clientY - rect.top;
                                if (yFromTop >= 8 && yFromTop < 48) {
                                    e.stopPropagation();
                                    return;
                                }
                            }
                            handleResizeHeightTopStart(e);
                        }}
                        sx={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: 0,
                            height: "8px",
                            cursor: "row-resize",
                            backgroundColor: "transparent",
                            zIndex: 99999,
                            pointerEvents: "auto",
                            touchAction: "none",
                            userSelect: "none",
                            "&:hover": {
                                backgroundColor: alpha(
                                    theme.palette.primary.main,
                                    0.2
                                ),
                                borderBottom: `2px solid ${theme.palette.primary.main}`,
                            },
                            "&:active": {
                                backgroundColor: alpha(
                                    theme.palette.primary.main,
                                    0.4
                                ),
                                borderBottom: `2px solid ${theme.palette.primary.dark}`,
                            },
                        }}
                    />
                </>
            )}
        </Dialog>
    );
};

export default AppDialog;
