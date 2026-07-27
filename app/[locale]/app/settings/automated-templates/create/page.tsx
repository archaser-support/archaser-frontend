"use client";

import { useSearchParams } from "next/navigation";

import ActivityTemplateCreatePage from "../../../activityTemplates/ActivityTemplateCreatePage";

export default function CreateAutomatedTemplatePage() {
    const searchParams = useSearchParams();
    const backUrl =
        searchParams?.get("backUrl") || "/app/settings?tab=automated";

    return (
        <ActivityTemplateCreatePage
            category="Automated"
            tabName="automated"
            createDescriptionKey="activityTemplates.create_automated_description"
            backUrl={backUrl}
        />
    );
}
