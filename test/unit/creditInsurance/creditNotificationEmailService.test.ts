import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NotificationDeliveryIntent } from "@/server/services/creditInsurance/NotificationRuleEvaluator";

const mocks = vi.hoisted(() => ({
    getTemplate: vi.fn(),
    replaceTemplateVariables: vi.fn(),
    setCustomerSenderNameAndReplyToEmail: vi.fn(),
    sendEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", async (importOriginal) => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    const actual = await importOriginal<typeof import("@/lib/prisma")>();
    return {
        ...actual,
        prisma: createPrismaMock(),
    };
});

vi.mock("@/server/services/InternalEmailTemplateService", () => ({
    InternalEmailTemplateService: class {
        getTemplate = mocks.getTemplate;
        replaceTemplateVariables = mocks.replaceTemplateVariables;
    },
}));

vi.mock("@/server/EmailService", () => ({
    EmailService: class {
        setCustomerSenderNameAndReplyToEmail =
            mocks.setCustomerSenderNameAndReplyToEmail;
        sendEmail = mocks.sendEmail;
    },
}));

import { prisma } from "@/lib/prisma";
import { CreditNotificationEmailService } from "@/server/services/creditInsurance/CreditNotificationEmailService";

const sampleIntent: NotificationDeliveryIntent = {
    ruleSetId: 1,
    ruleId: 11,
    triggerType: "overdue_block",
    recipientUserId: "u1",
    channel: "email",
    dedupKey: "credit:overdue_block:customer:101:recipient:u1:channel:email",
    title: "Overdue block detected",
    message: "Customer 101 is in overdue block.",
    actionUrl: "/app/credit-dashboard/report?type=overdue",
    metadata: { customerId: 101 },
    priority: "High",
};

describe("CreditNotificationEmailService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXTAUTH_URL = "https://app.example.com";
        mocks.getTemplate.mockResolvedValue({
            subject: "{{title}}",
            content: "<p>{{message}}</p><a href='{{action_url}}'>Open</a>",
        });
        mocks.replaceTemplateVariables.mockImplementation(
            (template: string, variables: Record<string, string>) =>
                Object.entries(variables).reduce(
                    (result, [key, value]) =>
                        result.replace(new RegExp(`{{${key}}}`, "g"), value),
                    template
                )
        );
        mocks.setCustomerSenderNameAndReplyToEmail.mockResolvedValue(undefined);
        mocks.sendEmail.mockResolvedValue(undefined);
        (prisma as any).user.findFirst.mockResolvedValue({
            id: "u1",
            email: "user@example.com",
            name: "Jane Doe",
            first_name: null,
            last_name: null,
        });
        (prisma as any).customer.findUnique.mockResolvedValue({
            Company: { name: "Acme Corp" },
            Person: null,
        });
    });

    it("sends email using internal template variables", async () => {
        const service = new CreditNotificationEmailService();
        const sent = await service.sendCreditAlertEmail({
            accountId: 55,
            intent: sampleIntent,
        });

        expect(sent).toBe(true);
        expect(mocks.getTemplate).toHaveBeenCalledWith(
            "credit_insurance_alert",
            55
        );
        expect(mocks.sendEmail).toHaveBeenCalledWith(
            "user@example.com",
            "Overdue block detected",
            expect.stringContaining("Customer 101 is in overdue block.")
        );
        expect(mocks.sendEmail).toHaveBeenCalledWith(
            "user@example.com",
            expect.any(String),
            expect.stringContaining(
                "https://app.example.com/app/credit-dashboard/report?type=overdue"
            )
        );
    });

    it("returns false when recipient has no email", async () => {
        (prisma as any).user.findFirst.mockResolvedValue({
            id: "u1",
            email: null,
            name: "Jane Doe",
        });

        const service = new CreditNotificationEmailService();
        const sent = await service.sendCreditAlertEmail({
            accountId: 55,
            intent: sampleIntent,
        });

        expect(sent).toBe(false);
        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });
});
