"use client";

import { useSearchParams } from "next/navigation";

import ActivityTemplateEditPage from "../../../activityTemplates/ActivityTemplateEditPage";

export default function EditPromiseToPayTemplatePage() {
    const searchParams = useSearchParams();
    const backUrl =
        searchParams?.get("backUrl") || "/app/settings?tab=templates&templateType=promiseToPay";

    return (
        <ActivityTemplateEditPage
            category="Promise_to_pay"
            tabName="promiseToPay"
            editDescriptionKey="messages.activity_templates_edit_description"
            backUrl={backUrl}
        />
    );
}
