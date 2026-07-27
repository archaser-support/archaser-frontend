"use client";

import { useSearchParams } from "next/navigation";

import ActivityTemplateEditPage from "../../../activityTemplates/ActivityTemplateEditPage";

export default function EditAutomatedTemplatePage() {
    const searchParams = useSearchParams();
    const backUrl =
        searchParams?.get("backUrl") || "/app/settings?tab=automated";

    return (
        <ActivityTemplateEditPage
            category="Automated"
            tabName="automated"
            editDescriptionKey="messages.activity_templates_edit_description"
            backUrl={backUrl}
        />
    );
}
