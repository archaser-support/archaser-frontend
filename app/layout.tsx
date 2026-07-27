"use client";
import "./globals.scss";
import { Provider } from "react-redux";

import GlobalErrorHandler from "@/components/GlobalErrorHandler";
import DebugConsoleLogger from "@/components/DebugConsoleLogger";
import store from "@/shared/redux/store";

const RootLayout = ({ children }: any) => {
    return (
        <Provider store={store}>
            <GlobalErrorHandler />
            <DebugConsoleLogger />
            {children}
        </Provider>
    );
};

export default RootLayout;
