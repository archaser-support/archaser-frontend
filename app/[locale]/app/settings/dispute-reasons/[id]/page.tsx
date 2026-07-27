"use client";

import { useSearchParams, useParams } from "next/navigation";

import DisputeReasonEditPage from "../../../disputeReasons/DisputeReasonEditPage";

export default function EditDisputeReasonPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const backUrl =
        searchParams?.get("backUrl") || "/app/settings?tab=dispute-reason";

    const id = params?.id as string;

    if (!id) {
        return null;
    }

    return (
        <DisputeReasonEditPage
            disputeReasonId={parseInt(id)}
            backUrl={backUrl}
        />
    );
}
