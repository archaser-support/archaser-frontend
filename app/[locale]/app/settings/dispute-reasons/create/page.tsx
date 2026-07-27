"use client";

import { useSearchParams } from "next/navigation";

import DisputeReasonCreatePage from "../../../disputeReasons/DisputeReasonCreatePage";

export default function CreateDisputeReasonPage() {
    const searchParams = useSearchParams();
    const backUrl =
        searchParams?.get("backUrl") || "/app/settings?tab=dispute-reason";

    return (
        <DisputeReasonCreatePage
            backUrl={backUrl}
        />
    );
}
