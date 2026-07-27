import type { SxProps, Theme } from "@mui/material/styles";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAppDialogResizeOptions {
    initialWidth?: number;
    initialHeight?: number;
    /** Fraction of window height (e.g. 0.6); used when initialHeight not set */
    heightFraction?: number;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
}

export interface UseAppDialogOptions {
    drag?: boolean;
    align?: boolean;
    slide?: boolean;
    resize?: boolean;
    isRTL?: boolean;
    /** When true, (re)initializes resize height from resizeOptions; pass from dialog open state */
    isOpen?: boolean;
    resizeOptions?: UseAppDialogResizeOptions;
}

const defaultResizeOptions: Required<UseAppDialogResizeOptions> = {
    initialWidth: 440,
    initialHeight: 0,
    heightFraction: 0.6,
    minWidth: 360,
    maxWidth: 900,
    minHeight: 300,
    maxHeight: 0.95,
};

function getInitialHeight(
    opts: UseAppDialogResizeOptions,
    win: Window | undefined
): number {
    if (typeof win === "undefined") return 400;
    if (opts.initialHeight && opts.initialHeight > 0) return opts.initialHeight;
    const fraction = opts.heightFraction ?? defaultResizeOptions.heightFraction;
    return Math.floor(win.innerHeight * fraction);
}

export interface UseAppDialogReturn {
    position: { x: number; y: number };
    setPosition: (p: { x: number; y: number }) => void;
    isDragging: boolean;
    dialogRef: React.RefObject<HTMLDivElement | null>;
    handleDragStart: (e: React.MouseEvent) => void;
    resetPosition: () => void;
    /** Call on transition onExited to reset resize state; no-op when resize is false */
    resetOnExited: () => void;
    /** When slide + isRTL: "right" | "left" for Slide direction */
    slideDirection: "left" | "right";
    /** Paper sx for position/size when align (and optional resize). Call with theme. */
    getPaperPositionSx: (
        theme: Theme,
        opts?: {
            width?: number;
            height?: number;
            topPosition?: number | null;
            fixedWidth?: string;
            maxHeight?: string;
        }
    ) => SxProps<Theme>;
    // Resize (only when resize: true)
    width: number;
    height: number;
    topPosition: number | null;
    resizeType: "width" | "height-bottom" | "height-top" | null;
    isExiting: boolean;
    handleResizeWidthStart: (e: React.MouseEvent) => void;
    handleResizeHeightBottomStart: (e: React.MouseEvent) => void;
    handleResizeHeightTopStart: (e: React.MouseEvent) => void;
}

export function useAppDialog(
    options: UseAppDialogOptions = {}
): UseAppDialogReturn {
    const {
        drag = true,
        align = true,
        slide = true,
        resize = false,
        isRTL = false,
        isOpen,
        resizeOptions: resizeOpts = {},
    } = options;

    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const dialogRef = useRef<HTMLDivElement | null>(null);

    const opts = { ...defaultResizeOptions, ...resizeOpts };
    const maxHeightPx =
        typeof window !== "undefined"
            ? window.innerHeight * (opts.maxHeight || 0.95)
            : 1000;

    const [width, setWidth] = useState(opts.initialWidth);
    const [height, setHeight] = useState(() =>
        getInitialHeight(resizeOpts, typeof window !== "undefined" ? window : undefined)
    );
    const [topPosition, setTopPosition] = useState<number | null>(null);
    const [resizeType, setResizeType] = useState<
        "width" | "height-bottom" | "height-top" | null
    >(null);
    const [isExiting, setIsExiting] = useState(false);
    const resizeStartXRef = useRef(0);
    const resizeStartYRef = useRef(0);
    const resizeStartWidthRef = useRef(opts.initialWidth);
    const resizeStartHeightRef = useRef(
        getInitialHeight(resizeOpts, typeof window !== "undefined" ? window : undefined)
    );
    const resizeStartTopRef = useRef(0);
    const resizeStartLeftRef = useRef(0);

    const handleDragStart = useCallback(
        (e: React.MouseEvent) => {
            if (!drag || !dialogRef.current) return;
            e.preventDefault();
            setIsDragging(true);
            const rect = dialogRef.current.getBoundingClientRect();
            dragStartPos.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        },
        [drag]
    );

    const handleDragMove = useCallback(
        (e: MouseEvent) => {
            if (isDragging && dialogRef.current) {
                const rect = dialogRef.current.getBoundingClientRect();
                const newX = e.clientX - dragStartPos.current.x;
                const newY = e.clientY - dragStartPos.current.y;
                const maxX = window.innerWidth - rect.width;
                const maxY = window.innerHeight - rect.height;
                setPosition({
                    x: Math.max(0, Math.min(newX, maxX)),
                    y: Math.max(0, Math.min(newY, maxY)),
                });
            }
        },
        [isDragging]
    );

    const handleDragEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (!drag) return;
        if (isDragging) {
            document.addEventListener("mousemove", handleDragMove);
            document.addEventListener("mouseup", handleDragEnd);
            return () => {
                document.removeEventListener("mousemove", handleDragMove);
                document.removeEventListener("mouseup", handleDragEnd);
            };
        }
    }, [drag, isDragging, handleDragMove, handleDragEnd]);

    const resetPosition = useCallback(() => {
        setPosition({ x: 0, y: 0 });
        setIsDragging(false);
        if (resize) {
            setTopPosition(null);
            setWidth(opts.initialWidth);
            setHeight(
                getInitialHeight(
                    resizeOpts,
                    typeof window !== "undefined" ? window : undefined
                )
            );
        }
    }, [resize, opts.initialWidth, resizeOpts]);

    const resetOnExited = useCallback(() => {
        resetPosition();
        setIsExiting(false);
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement?.blur) {
            activeElement.blur();
        }
    }, [resetPosition]);

    const slideDirection: "left" | "right" = isRTL ? "right" : "left";

    useEffect(() => {
        if (resize && isOpen && typeof window !== "undefined") {
            const initialHeight = getInitialHeight(resizeOpts, window);
            setHeight(initialHeight);
            resizeStartHeightRef.current = initialHeight;
            setWidth(opts.initialWidth);
        }
    }, [resize, isOpen, resizeOpts.initialHeight, resizeOpts.heightFraction, resizeOpts.initialWidth, opts.initialWidth]);

    const handleResizeWidthStart = useCallback(
        (e: React.MouseEvent) => {
            if (!resize || !dialogRef.current) return;
            e.preventDefault();
            e.stopPropagation();
            setResizeType("width");
            resizeStartXRef.current = e.clientX;
            resizeStartWidthRef.current = width;
            const rect = dialogRef.current.getBoundingClientRect();
            if (isRTL) {
                resizeStartLeftRef.current = rect.left;
            } else {
                resizeStartLeftRef.current = rect.left + rect.width;
            }
        },
        [resize, width, isRTL]
    );

    const handleResizeHeightBottomStart = useCallback(
        (e: React.MouseEvent) => {
            if (!resize) return;
            e.preventDefault();
            e.stopPropagation();
            setResizeType("height-bottom");
            resizeStartYRef.current = e.clientY;
            resizeStartHeightRef.current = height;
        },
        [resize, height]
    );

    const handleResizeHeightTopStart = useCallback(
        (e: React.MouseEvent) => {
            if (!resize || !dialogRef.current) return;
            e.preventDefault();
            e.stopPropagation();
            setResizeType("height-top");
            resizeStartYRef.current = e.clientY;
            resizeStartHeightRef.current = height;
            const rect = dialogRef.current.getBoundingClientRect();
            const currentTop =
                topPosition !== null
                    ? topPosition
                    : position.y === 0
                      ? rect.top
                      : position.y;
            resizeStartTopRef.current = currentTop;
        },
        [resize, height, position.y, topPosition]
    );

    useEffect(() => {
        if (!resize || !resizeType) return;
        const handleMouseMove = (e: MouseEvent) => {
            if (resizeType === "width") {
                const deltaX = isRTL
                    ? e.clientX - resizeStartXRef.current
                    : resizeStartXRef.current - e.clientX;
                const newWidth = Math.max(
                    opts.minWidth,
                    Math.min(opts.maxWidth, resizeStartWidthRef.current + deltaX)
                );
                setWidth(newWidth);
                if (dialogRef.current) {
                    if (isRTL) {
                        const leftEdge = resizeStartLeftRef.current;
                        const newRight = leftEdge + newWidth;
                        if (newRight > window.innerWidth) {
                            const maxW = window.innerWidth - leftEdge;
                            if (maxW >= opts.minWidth) {
                                setWidth(maxW);
                            } else {
                                setWidth(opts.minWidth);
                                setPosition({
                                    x: leftEdge + opts.minWidth - window.innerWidth,
                                    y: position.y,
                                });
                            }
                        }
                    } else {
                        const rightEdge = resizeStartLeftRef.current;
                        const newLeft = rightEdge - newWidth;
                        const expectedLeftAtRight = window.innerWidth - newWidth;
                        const isAtRightEdge =
                            Math.abs(newLeft - expectedLeftAtRight) < 1;
                        if (newLeft < 0) {
                            const maxW = rightEdge;
                            if (maxW >= opts.minWidth) {
                                setWidth(maxW);
                                setPosition({ x: 0, y: position.y });
                            } else {
                                setWidth(opts.minWidth);
                                setPosition({
                                    x: rightEdge - opts.minWidth,
                                    y: position.y,
                                });
                            }
                        } else if (newLeft + newWidth > window.innerWidth) {
                            setPosition({
                                x: window.innerWidth - newWidth,
                                y: position.y,
                            });
                        } else if (isAtRightEdge) {
                            setPosition({ x: 0, y: position.y });
                        } else {
                            setPosition({ x: newLeft, y: position.y });
                        }
                    }
                }
            } else if (resizeType === "height-bottom") {
                const deltaY = e.clientY - resizeStartYRef.current;
                const newHeight = Math.max(
                    opts.minHeight,
                    Math.min(
                        maxHeightPx,
                        resizeStartHeightRef.current + deltaY
                    )
                );
                setHeight(newHeight);
            } else if (resizeType === "height-top") {
                const deltaY = resizeStartYRef.current - e.clientY;
                const newHeight = Math.max(
                    opts.minHeight,
                    Math.min(
                        maxHeightPx,
                        resizeStartHeightRef.current + deltaY
                    )
                );
                setHeight(newHeight);
                const heightDelta = newHeight - resizeStartHeightRef.current;
                const newTop = resizeStartTopRef.current - heightDelta;
                if (
                    newTop >= 0 &&
                    newTop + newHeight <= window.innerHeight
                ) {
                    setTopPosition(newTop);
                }
            }
        };
        const handleMouseUp = () => setResizeType(null);
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [
        resize,
        resizeType,
        isRTL,
        position.y,
        opts.minWidth,
        opts.maxWidth,
        opts.minHeight,
        maxHeightPx,
    ]);

    const getPaperPositionSx = useCallback(
        (
            theme: Theme,
            paperOpts?: {
                width?: number;
                height?: number;
                topPosition?: number | null;
                fixedWidth?: string;
                maxHeight?: string;
            }
        ): SxProps<Theme> => {
            if (!align) return {};
            const w = paperOpts?.width ?? width;
            const h = paperOpts?.height ?? height;
            const top = paperOpts?.topPosition ?? topPosition;
            const fixedW = paperOpts?.fixedWidth;
            const maxH = paperOpts?.maxHeight;
            const borderRadius =
                typeof theme.shape.borderRadius === "number"
                    ? theme.shape.borderRadius
                    : 4;
            const base: SxProps<Theme> = {
                position: "fixed",
                right: position.x === 0 ? (isRTL ? "auto" : 0) : "auto",
                left:
                    position.x === 0
                        ? isRTL
                            ? 0
                            : "auto"
                        : `${position.x}px`,
                top:
                    top !== undefined && top !== null
                        ? `${top}px`
                        : position.y === 0
                          ? "auto"
                          : `${position.y}px`,
                bottom:
                    top !== undefined && top !== null
                        ? "auto"
                        : position.y === 0
                          ? 0
                          : "auto",
                margin: 0,
                borderRadius,
                border: "none",
                outline: "none",
                zIndex: 99999,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                direction: isRTL ? "rtl" : "ltr",
                transition:
                    isDragging || resizeType || isExiting
                        ? "none"
                        : "left 0.1s ease-out, top 0.1s ease-out",
                "& > .MuiDialogTitle-root": { flexShrink: 0 },
                "& > .MuiDialogContent-root": {
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflow: "auto",
                },
                "& > .MuiDialogActions-root": { flexShrink: 0 },
            };
            if (resize) {
                (base as Record<string, unknown>).maxWidth = `${w}px !important`;
                (base as Record<string, unknown>).width = `${w}px !important`;
                (base as Record<string, unknown>).minWidth = `${opts.minWidth}px`;
                (base as Record<string, unknown>).maxHeight =
                    maxH ??
                    (typeof window !== "undefined"
                        ? `${window.innerHeight * (opts.maxHeight || 0.95)}px`
                        : "95vh");
                (base as Record<string, unknown>).height = `${h}px !important`;
                (base as Record<string, unknown>).minHeight = `${opts.minHeight}px`;
                (base as Record<string, unknown>).boxSizing = "border-box";
            } else if (fixedW) {
                (base as Record<string, unknown>).maxWidth = `${fixedW} !important`;
                (base as Record<string, unknown>).width = `${fixedW} !important`;
                (base as Record<string, unknown>).maxHeight = maxH ?? "90vh";
                (base as Record<string, unknown>).height = maxH ?? "90vh";
            }
            return base;
        },
        [
            align,
            isRTL,
            position,
            isDragging,
            resizeType,
            isExiting,
            resize,
            width,
            height,
            topPosition,
            opts.minWidth,
            opts.maxHeight,
            opts.minHeight,
        ]
    );

    return {
        position,
        setPosition,
        isDragging,
        dialogRef,
        handleDragStart,
        resetPosition,
        resetOnExited,
        slideDirection,
        getPaperPositionSx,
        width,
        height,
        topPosition,
        resizeType,
        isExiting,
        handleResizeWidthStart,
        handleResizeHeightBottomStart,
        handleResizeHeightTopStart,
    };
}
