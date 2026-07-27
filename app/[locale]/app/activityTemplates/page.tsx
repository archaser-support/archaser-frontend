import { Metadata } from "next";
import { redirect } from "next/navigation";

import { getServerSessionSafe } from "@/utils/serverSession";

export const metadata: Metadata = {
    title: "Activity Templates",
};

export default async function Page() {
    // Cookie session is optional here; redirect is unconditional product routing.
    await getServerSessionSafe();

    // Redirect to the automated templates tab in settings
    redirect("/app/settings?tab=automated");
}
