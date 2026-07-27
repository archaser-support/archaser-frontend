import React from "react";
import { Box } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { ResizeHandleProps } from "../types";

const ResizeHandle: React.FC<ResizeHandleProps> = React.memo(
    ({
        columnField,
        onResizeStart,
        onAutoResize,
        language,
        resizeHandleClickRef,
    }) => {
        const theme = useTheme();

        return (
            <Box
                key={`${columnField}-resize-handle`}
                data-resize-handle="true"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Track click on resize handle to prevent sort
                    resizeHandleClickRef.current = {
                        field: columnField,
                        timestamp: Date.now(),
                    };
                }}
                onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onResizeStart(e);
                }}
                onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Clear the click tracker since double-click happened
                    resizeHandleClickRef.current = null;
                    onAutoResize();
                }}
                onMouseEnter={(e) => {
                    e.stopPropagation();
                }}
                sx={{
                    position: "absolute",
                    [language === "he" ? "left" : "right"]: "-4px",
                    top: 0,
                    bottom: 0,
                    width: "8px",
                    cursor: "col-resize",
                    backgroundColor: "transparent",
                    zIndex: 10,
                    pointerEvents: "auto",
                    touchAction: "none",
                    userSelect: "none",
                    "&:hover": {
                        backgroundColor: alpha(theme.palette.primary.main, 0.2),
                        [language === "he" ? "borderLeft" : "borderRight"]:
                            `2px solid ${theme.palette.primary.main}`,
                    },
                    "&:active": {
                        backgroundColor: alpha(theme.palette.primary.main, 0.4),
                        [language === "he" ? "borderLeft" : "borderRight"]:
                            `2px solid ${theme.palette.primary.dark}`,
                    },
                }}
            />
        );
    },
    (prevProps, nextProps) => {
        // Custom comparison function for memoization
        return (
            prevProps.columnField === nextProps.columnField &&
            prevProps.language === nextProps.language &&
            prevProps.onResizeStart === nextProps.onResizeStart &&
            prevProps.onAutoResize === nextProps.onAutoResize
        );
    }
);

ResizeHandle.displayName = "ResizeHandle";

export default ResizeHandle;
