"use client";

import { Alert, Box, Button, Typography } from "@mui/material";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface PortalErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function PortalError({ error, reset }: PortalErrorProps) {
    const router = useRouter();

    useEffect(() => {
        console.error("Portal route error:", error);
    }, [error]);

    return (
        <Box
            sx={{
                minHeight: "70vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 2,
            }}
        >
            <Box sx={{ maxWidth: 560, width: "100%" }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    The portal could not be loaded. Please try again.
                </Alert>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    If this keeps happening, refresh the page or reopen the link from email.
                </Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Button variant="contained" onClick={reset}>
                        Retry
                    </Button>
                    <Button variant="outlined" onClick={() => router.refresh()}>
                        Refresh
                    </Button>
                </Box>
            </Box>
        </Box>
    );
}
