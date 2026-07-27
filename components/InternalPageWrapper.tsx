import { Box, Typography } from "@mui/material";
import React from "react";

interface InternalPageWrapperProps {
    title?: string;
    description?: string;
    maxWidth?: number | string;
    children?: React.ReactNode;
}

const InternalPageWrapper = ({
    title,
    description,
    maxWidth = "100%",
    children,
}: InternalPageWrapperProps) => {
    return (
        <Box
            sx={{
                minHeight: "100%",
                bgcolor: "background.default",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                {(title || description) && (
                    <Box sx={{ mb: 3 }}>
                        {title && (
                            <Typography
                                variant="h2"
                                sx={{
                                    fontWeight: 600,
                                    fontSize: "2rem",
                                    mb: 2,
                                    color: "text.primary",
                                }}
                            >
                                {title}
                            </Typography>
                        )}
                        {description && (
                            <Typography
                                variant="body1"
                                color="text.secondary"
                                sx={{
                                    fontSize: "0.875rem",
                                    maxWidth: maxWidth,
                                }}
                            >
                                {description}
                            </Typography>
                        )}
                    </Box>
                )}
                {children}
            </Box>
        </Box>
    );
};

export default InternalPageWrapper;
