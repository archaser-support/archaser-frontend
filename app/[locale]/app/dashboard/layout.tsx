import { redirect } from "next/navigation";
import React from "react";

import { isArchaserAdminAccount } from "@/shared/utils/navigation";
import AppUrls from "@/utils/appUrls";
import { getServerSessionSafe } from "@/utils/serverSession";

interface LayoutProps {
    children: React.ReactNode;
}

export default async function DashboardLayout({ children }: LayoutProps) {
    const session = await getServerSessionSafe();

    if (session?.user) {
        const effectiveAccountId = session.user.view_as_user_id
            ? session.user.view_as_user_account_id
            : session.user.account_id;

        if (isArchaserAdminAccount(effectiveAccountId)) {
            redirect(AppUrls.ACCOUNTS);
        }
    }

    return <>{children}</>;
}
