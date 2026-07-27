"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useSelector } from "react-redux";

import { RootState } from "@/shared/redux/reducer";

// Add types
type SpinnerContextType = {
    isVisible: boolean;
    showSpinner: () => void;
    hideSpinner: () => void;
    toggleSpinner: () => void;
};

const SpinnerContext = createContext<SpinnerContextType>({
    isVisible: false,
    showSpinner: () => {},
    hideSpinner: () => {},
    toggleSpinner: () => {},
});

export const SpinnerProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const requestCount = useSelector((state: RootState) => state.requestCount);

    const showSpinner = () => setIsVisible(true);
    const hideSpinner = () => setIsVisible(false);
    const toggleSpinner = () => setIsVisible((prev) => !prev);

    useEffect(() => {
        if (requestCount > 0) {
            showSpinner();
        } else {
            hideSpinner();
        }
    }, [requestCount]);

    return (
        <SpinnerContext.Provider
            value={{ isVisible, showSpinner, hideSpinner, toggleSpinner }}
        >
            {children}
        </SpinnerContext.Provider>
    );
};

export const useSpinner = () => useContext(SpinnerContext);
