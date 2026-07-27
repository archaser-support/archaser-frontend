import { prisma } from "@/lib/prisma";
import { EmailService } from "@/server/EmailService";
import { InternalEmailTemplateService } from "@/server/services/InternalEmailTemplateService";
import type { NotificationDeliveryIntent } from "@/server/services/creditInsurance/NotificationRuleEvaluator";

function buildAbsoluteActionUrl(actionUrl: string): string {
    const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
    if (!base || actionUrl.startsWith("http")) {
        return actionUrl;
    }
    return `${base}${actionUrl.startsWith("/") ? actionUrl : `/${actionUrl}`}`;
}

function fallbackEmailBody(variables: Record<string, string>): string {
    const entitySummary = [variables.customer_name, variables.invoice_number]
        .filter(Boolean)
        .join(" — ");

    return `
<p>Hello ${variables.recipient_name},</p>
<p>${variables.message}</p>
${entitySummary ? `<p><strong>Related to:</strong> ${entitySummary}</p>` : ""}
<p><a href="${variables.action_url}">View credit report</a></p>
`.trim();
}

export class CreditNotificationEmailService {
    constructor(
        private readonly templateService = new InternalEmailTemplateService(),
        private readonly emailService = new EmailService()
    ) {}

    async sendCreditAlertEmail(input: {
        accountId: number;
        intent: NotificationDeliveryIntent;
    }): Promise<boolean> {
        const user = await prisma.user.findFirst({
            where: {
                id: input.intent.recipientUserId,
                account_id: input.accountId,
                deactivated_at: null,
            },
            select: {
                id: true,
                email: true,
                name: true,
                first_name: true,
                last_name: true,
            },
        });

        if (!user?.email) {
            return false;
        }

        const recipientName =
            user.name?.trim() ||
            `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
            "there";

        const { customerName, invoiceNumber } =
            await this.resolveEntityLabels(input.intent.metadata);

        const actionUrl = buildAbsoluteActionUrl(input.intent.actionUrl);
        const variables: Record<string, string> = {
            recipient_name: recipientName,
            title: input.intent.title,
            message: input.intent.message,
            action_url: actionUrl,
            customer_name: customerName,
            invoice_number: invoiceNumber,
            trigger_type: input.intent.triggerType,
        };

        const template = await this.templateService.getTemplate(
            "credit_insurance_alert",
            input.accountId
        );

        let emailSubject = input.intent.title;
        let emailBody: string;

        if (template) {
            emailSubject = this.templateService.replaceTemplateVariables(
                template.subject,
                variables
            );
            emailBody = this.templateService.replaceTemplateVariables(
                template.content,
                variables
            );
        } else {
            emailBody = fallbackEmailBody(variables);
        }

        await this.emailService.setCustomerSenderNameAndReplyToEmail(
            input.accountId
        );
        await this.emailService.sendEmail(user.email, emailSubject, emailBody);
        return true;
    }

    private async resolveEntityLabels(metadata: Record<string, unknown>): Promise<{
        customerName: string;
        invoiceNumber: string;
    }> {
        let customerName = "";
        let invoiceNumber = "";

        const customerId =
            typeof metadata.customerId === "number"
                ? metadata.customerId
                : undefined;
        const invoiceId =
            typeof metadata.invoiceId === "number" ? metadata.invoiceId : undefined;

        if (customerId != null) {
            const customer = await prisma.customer.findUnique({
                where: { id: customerId },
                select: {
                    Company: { select: { name: true } },
                    Person: { select: { first_name: true, last_name: true } },
                },
            });
            customerName =
                customer?.Company?.name?.trim() ||
                `${customer?.Person?.first_name ?? ""} ${customer?.Person?.last_name ?? ""}`.trim();
        }

        if (invoiceId != null) {
            const invoice = await prisma.invoice.findUnique({
                where: { id: invoiceId },
                select: { invoice_number: true },
            });
            invoiceNumber = invoice?.invoice_number?.trim() ?? "";
        }

        return { customerName, invoiceNumber };
    }
}
