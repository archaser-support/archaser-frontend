"use client";

import { useSearchParams } from "next/navigation";

import ActivityTemplateEditPage from "../../../activityTemplates/ActivityTemplateEditPage";

export default function EditDisputeTemplatePage() {
    const searchParams = useSearchParams();
    const backUrl =
        searchParams?.get("backUrl") ||
        "/app/settings?tab=templates&templateType=dispute";

    return (
        <ActivityTemplateEditPage
            category="Dispute"
            tabName="dispute"
            editDescriptionKey="messages.activity_templates_edit_description"
            backUrl={backUrl}
        />
    );
}
