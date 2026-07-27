import Box from "@mui/material/Box";
import React from "react";

const GridContainer: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => (
    <Box
        sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 2,
        }}
    >
        {children}
    </Box>
);

export default GridContainer;
