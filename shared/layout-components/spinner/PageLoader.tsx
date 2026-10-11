"use client";

import { useEffect } from "react";

import { useSpinner } from "./SpinnerProvider";

/**
 * Page-level loading state (Suspense / `dynamic()` fallbacks, initial page fetches).
 * Renders nothing itself; shows the single shared SpinnerOverlay while mounted.
 */
const PageLoader = () => {
    const { registerPageLoader } = useSpinner();

    useEffect(() => registerPageLoader(), [registerPageLoader]);

    return null;
};

export default PageLoader;
