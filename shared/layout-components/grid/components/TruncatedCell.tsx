import React from "react";
import { Box, Tooltip } from "@mui/material";

interface TruncatedCellProps {
    content: React.ReactNode;
    tooltipText: string;
    language?: string;
}

const TruncatedCell: React.FC<TruncatedCellProps> = React.memo(
    ({ content, tooltipText, language = "en" }) => {
        const [isTruncated, setIsTruncated] = React.useState(false);
        const contentRef = React.useRef<HTMLSpanElement | null>(null);

        const checkTruncation = React.useCallback(() => {
            if (contentRef.current) {
                const element = contentRef.current;
                // Check if the element itself is overflowing
                let isOverflowing = element.scrollWidth > element.clientWidth;

                // Also check if any child elements are overflowing
                if (!isOverflowing) {
                    const textElements = element.querySelectorAll("*");
                    for (let i = 0; i < textElements.length; i++) {
                        const el = textElements[i] as HTMLElement;
                        if (el.textContent && el.scrollWidth > el.clientWidth) {
                            isOverflowing = true;
                            break;
                        }
                    }
                }

                // If still not overflowing, check the text content directly
                // This handles cases where text might be truncated but scrollWidth equals clientWidth due to rounding
                if (!isOverflowing && element.textContent) {
                    const computedStyle = window.getComputedStyle(element);
                    const hasEllipsis = computedStyle.textOverflow === 'ellipsis';
                    const hasOverflowHidden = computedStyle.overflow === 'hidden' || computedStyle.overflowX === 'hidden';
                    const hasNowrap = computedStyle.whiteSpace === 'nowrap';
                    
                    // If the element has ellipsis styling and text content, check more carefully
                    if (hasEllipsis && hasOverflowHidden && hasNowrap && element.textContent.trim().length > 0) {
                        // Use a more lenient check: if scrollWidth is even slightly larger, consider it truncated
                        // Also account for potential rounding issues
                        const widthDiff = element.scrollWidth - element.clientWidth;
                        if (widthDiff > 0.5) { // Account for sub-pixel rendering
                            isOverflowing = true;
                        }
                    }
                }

                setIsTruncated(isOverflowing);
            }
        }, []);

        React.useLayoutEffect(() => {
            // Use multiple requestAnimationFrame calls to ensure DOM is fully rendered
            const rafId1 = requestAnimationFrame(() => {
                const rafId2 = requestAnimationFrame(() => {
                    checkTruncation();
                });
                return () => cancelAnimationFrame(rafId2);
            });
            
            // Also check after a short delay to catch cases where layout hasn't settled
            const timeoutId = setTimeout(() => {
                checkTruncation();
            }, 50);
            
            return () => {
                cancelAnimationFrame(rafId1);
                clearTimeout(timeoutId);
            };
        }, [content, checkTruncation]);

        React.useEffect(() => {
            window.addEventListener("resize", checkTruncation);
            // Also check on content changes with a slight delay
            const timeoutId = setTimeout(() => {
                checkTruncation();
            }, 100);
            
            return () => {
                clearTimeout(timeoutId);
                window.removeEventListener("resize", checkTruncation);
            };
        }, [content, checkTruncation]);

        // Callback ref to check truncation when element is mounted
        const setContentRef = React.useCallback((el: HTMLSpanElement | null) => {
            (contentRef as React.MutableRefObject<HTMLSpanElement | null>).current = el;
            if (el) {
                // Check truncation immediately when ref is set
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (contentRef.current) {
                            checkTruncation();
                        }
                    });
                });
            }
        }, [checkTruncation]);

        const cellContent = (
            <Box
                component="span"
                ref={setContentRef}
                sx={{
                    display: "block",
                    width: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    pointerEvents: "auto",
                }}
            >
                {content}
            </Box>
        );

        const tooltipWillRender = !!(isTruncated && tooltipText && tooltipText.length > 0);

        if (tooltipWillRender) {
            return (
                <Tooltip
                    title={tooltipText}
                    placement="bottom"
                    arrow
                    enterDelay={300}
                    leaveDelay={100}
                    PopperProps={{
                        sx: {
                            zIndex: 9999,
                            "& .MuiTooltip-tooltip": {
                                direction: language === "he" ? "rtl" : "ltr",
                            },
                            "& .MuiTooltip-arrow": {
                                ...(language === "he" && { transform: "scaleX(-1)" }),
                            },
                        },
                        modifiers: [
                            {
                                name: "preventOverflow",
                                enabled: true,
                                options: {
                                    boundary: "viewport",
                                },
                            },
                        ],
                    }}
                >
                    <span style={{ display: "block", width: "100%" }}>
                        {cellContent}
                    </span>
                </Tooltip>
            );
        }

        return cellContent;
    },
    (prevProps, nextProps) => {
        return (
            prevProps.content === nextProps.content &&
            prevProps.tooltipText === nextProps.tooltipText &&
            prevProps.language === nextProps.language
        );
    }
);

TruncatedCell.displayName = "TruncatedCell";

export default TruncatedCell;
