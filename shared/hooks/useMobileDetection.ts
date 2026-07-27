import { useState, useEffect } from "react";

/**
 * Custom hook for detecting mobile screen size
 * @param breakpoint - The breakpoint in pixels (default: 768)
 * @returns boolean indicating if the screen is mobile size
 */
export const useMobileDetection = (breakpoint: number = 768): boolean => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < breakpoint);
        };

        checkMobile();
        window.addEventListener("resize", checkMobile);

        return () => window.removeEventListener("resize", checkMobile);
    }, [breakpoint]);

    return isMobile;
};
