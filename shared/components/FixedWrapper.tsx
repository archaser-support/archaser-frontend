import { Box, BoxProps } from "@mui/material";
import React from "react";

interface FixedWrapperProps extends Omit<BoxProps, "position"> {
    top?: number | string;
    right?: number | string;
    bottom?: number | string;
    left?: number | string;
    zIndex?: number;
}

const FixedWrapper: React.FC<FixedWrapperProps> = ({
    children,
    top,
    right,
    bottom,
    left,
    zIndex = 1,
    sx,
    ...props
}) => {
    return (
        <Box
            position="fixed"
            top={top}
            right={right}
            bottom={bottom}
            left={left}
            zIndex={zIndex}
            sx={{
                ...sx,
            }}
            {...props}
        >
            {children}
        </Box>
    );
};

export default FixedWrapper;
