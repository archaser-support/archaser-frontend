import InternalPageWrapper from "@/components/InternalPageWrapper";
import { getServerSessionSafe } from "@/utils/serverSession";

import CustomerList from "./CustomerList";

export const metadata = {
    title: "Customers",
};

interface PageProps {
    params: Promise<{
        locale: string;
    }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Page({ params }: PageProps) {
    await params; // Destructure to satisfy interface, locale not used

    // Cookie bridge gates UI; CustomerList loads product data via Nest client.
    // Do not hard-redirect here — middleware / AppShell handle unauthenticated users.
    await getServerSessionSafe();

    return (
        <InternalPageWrapper>
            <CustomerList clientType="All" />
        </InternalPageWrapper>
    );
}
