import { useState, useEffect } from "react";
import { BREAKPOINTS } from "../constants";

/**
 * Utility function to get initial window width
 */
export const getInitialWindowWidth = (): number => {
    if (typeof window !== "undefined") {
        return window.innerWidth;
    }
    return 1200;
};

/**
 * Custom hook for managing window width
 */
export const useWindowWidth = () => {
    const [windowWidth, setWindowWidth] = useState<number>(
        getInitialWindowWidth()
    );

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return windowWidth;
};

export { BREAKPOINTS };
