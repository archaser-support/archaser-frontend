import { Metadata } from "next";

import InternalPageWrapper from "@/components/InternalPageWrapper";

import EmailCampaignReportContainer from "./EmailCampaignReportContainer";

export const metadata: Metadata = {
    title: "Email Campaign Report - ARchaser",
    description: "View and analyze email campaign performance reports",
};

export default async function Page() {
    return (
        <InternalPageWrapper>
            <EmailCampaignReportContainer />
        </InternalPageWrapper>
    );
}
