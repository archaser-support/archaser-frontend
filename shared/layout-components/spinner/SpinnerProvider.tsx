"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { useSelector } from "react-redux";

import { RootState } from "@/shared/redux/reducer";

// Add types
type SpinnerContextType = {
    isVisible: boolean;
    label?: string;
    showSpinner: (label?: string) => void;
    hideSpinner: () => void;
    toggleSpinner: () => void;
    /** Shows the shared page overlay until the returned cleanup is called. */
    registerPageLoader: () => () => void;
};

const SpinnerContext = createContext<SpinnerContextType>({
    isVisible: false,
    showSpinner: () => {},
    hideSpinner: () => {},
    toggleSpinner: () => {},
    registerPageLoader: () => () => {},
});

type ManualSpinnerState = { isVisible: boolean; label?: string };

export const SpinnerProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [manual, setManual] = useState<ManualSpinnerState>({
        isVisible: false,
    });
    const [pageLoaderCount, setPageLoaderCount] = useState(0);
    const requestCount = useSelector((state: RootState) => state.requestCount);

    const isVisible =
        requestCount > 0 || manual.isVisible || pageLoaderCount > 0;

    const showSpinner = (label?: string) => setManual({ isVisible: true, label });
    const hideSpinner = () => setManual({ isVisible: false });
    const toggleSpinner = () =>
        setManual((prev) => ({ isVisible: !prev.isVisible }));

    const registerPageLoader = useCallback(() => {
        setPageLoaderCount((count) => count + 1);
        return () => setPageLoaderCount((count) => Math.max(0, count - 1));
    }, []);

    return (
        <SpinnerContext.Provider
            value={{
                isVisible,
                label: manual.isVisible ? manual.label : undefined,
                showSpinner,
                hideSpinner,
                toggleSpinner,
                registerPageLoader,
            }}
        >
            {children}
        </SpinnerContext.Provider>
    );
};

export const useSpinner = () => useContext(SpinnerContext);
