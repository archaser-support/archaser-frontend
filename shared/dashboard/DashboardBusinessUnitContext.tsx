"use client";

import React, { createContext, useContext } from "react";

const DashboardBusinessUnitContext = createContext<number | null>(null);

type DashboardBusinessUnitProviderProps = {
    value: number | null;
    children: React.ReactNode;
};

export function DashboardBusinessUnitProvider({
    value,
    children,
}: DashboardBusinessUnitProviderProps) {
    return (
        <DashboardBusinessUnitContext.Provider value={value}>
            {children}
        </DashboardBusinessUnitContext.Provider>
    );
}

export function useDashboardBusinessUnitId(): number | null {
    return useContext(DashboardBusinessUnitContext);
}
