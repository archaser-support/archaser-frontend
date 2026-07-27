import { redirect } from "next/navigation";

import InternalPageWrapper from "@/components/InternalPageWrapper";
import { getServerSessionSafe } from "@/utils/serverSession";

interface LayoutProps {
    children: React.ReactNode;
}

const CronJobsLayout = async ({ children }: LayoutProps) => {
    // Cookie bridge session for UI gates; middleware handles unauthenticated users.
    const session = await getServerSessionSafe();

    // Check if user has access to cron jobs (only account_id 10013)
    if (session?.user?.account_id && session.user.account_id !== 10013) {
        redirect("/app/dashboard");
    }

    return <InternalPageWrapper>{children}</InternalPageWrapper>;
};

export default CronJobsLayout;
