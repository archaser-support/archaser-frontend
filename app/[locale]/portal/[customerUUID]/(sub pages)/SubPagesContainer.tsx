"use client";

import { FC, PropsWithChildren } from "react";

import PortalHeader from "@/app/[locale]/portal/[customerUUID]/components/PortalHeader";

type SubPagesContainerProps = {
    customerName: string | null;
    logo?: string | null;
    children: React.ReactNode;
    showBackButton?: boolean;
    customerUUID?: string;
};

const SubPagesContainer: FC<PropsWithChildren<SubPagesContainerProps>> = ({
    logo,
    customerName,
    children,
    showBackButton = true,
    customerUUID,
}) => {
    // Note: Language sync is handled by PortalHeader (which is rendered below)
    // We don't call it here to avoid duplicate hook instances

    return (
        <div className="min-h-screen bg-gray-100">
            <PortalHeader
                logo={logo}
                customerName={customerName}
                className="mx-4 mt-4"
                customerUUID={customerUUID}
            />
            <div className="w-full flex items-center justify-center px-4">
                <div className="flex flex-col items-center justify-center w-full max-w-4xl">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default SubPagesContainer;
