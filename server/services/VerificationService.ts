import { contact_status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EmailService } from "@/server/EmailService";
import { LogLevel } from "@/types/enums";
import { LogService } from "./LogService";

export class VerificationService {
    private static instance: VerificationService;
    private emailService: EmailService;
    private logService: LogService;

    private constructor() {
        this.emailService = new EmailService();
        this.logService = LogService.getInstance();
    }

    public static getInstance(): VerificationService {
        if (!VerificationService.instance) {
            VerificationService.instance = new VerificationService();
        }
        return VerificationService.instance;
    }

    /**
     * Generate a 6-digit code and store it in the database
     */
    async generateCode(customerUUID: string): Promise<string> {
        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Expiration time (15 minutes)
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        try {
            await prisma.verificationCode.create({
                data: {
                    customer_uuid: customerUUID,
                    code: code,
                    expires_at: expiresAt,
                },
            });
            return code;
        } catch (error) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to save verification code: ${(error as Error).message}`,
                "VerificationService.generateCode",
                { customerUUID }
            );
            throw error;
        }
    }

    /**
     * Verify the provided code for a customer
     */
    async verifyCode(customerUUID: string, code: string): Promise<boolean> {
        try {
            // Find valid, non-expired code
            const validCode = await prisma.verificationCode.findFirst({
                where: {
                    customer_uuid: customerUUID,
                    code: code,
                    expires_at: {
                        gt: new Date(),
                    },
                },
                orderBy: {
                    created_at: "desc",
                },
            });

            if (validCode) {
                // Delete the used code (and potentially older valid ones to clean up)
                await prisma.verificationCode.deleteMany({
                    where: {
                        customer_uuid: customerUUID,
                        code: code,
                        id: validCode.id
                    },
                });
                return true;
            }

            return false;
        } catch (error) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Error verifying code: ${(error as Error).message}`,
                "VerificationService.verifyCode",
                { customerUUID }
            );
            return false;
        }
    }

    /**
     * Helper to get email address for a customer UUID, optionally targeting a specific contact
     */
    async getEmailAddress(customerUUID: string, contactId?: number): Promise<{ email: string; name: string; accountId: number; verificationEnabled: boolean } | null> {
        // If contact ID is provided, try to fetch that specific contact
        if (contactId) {
            const contact = await prisma.contact.findFirst({
                where: {
                    id: contactId,
                    Customer: {
                        customer_uuid: customerUUID
                    },
                    status: contact_status.Active, // Active
                    email: { not: null }
                },
                select: {
                    email: true,
                    first_name: true,
                    Customer: {
                        select: {
                            account_id: true,
                            Account: {
                                select: {
                                    portal_verification_enabled: true
                                }
                            }
                        }
                    }
                }
            });

            if (contact && contact.email && contact.Customer) {
                const verificationEnabled = contact.Customer.Account?.portal_verification_enabled ?? true;
                return {
                    email: contact.email,
                    name: contact.first_name || "Customer",
                    accountId: contact.Customer.account_id,
                    verificationEnabled
                };
            }
            // If contact not found or invalid, fallback to default behavior logic below
        }

        const customer = await prisma.customer.findFirst({
            where: { customer_uuid: customerUUID },
            select: {
                email: true,
                account_id: true,
                Account: {
                    select: {
                        portal_verification_enabled: true
                    }
                },
                Person: {
                    select: {
                        first_name: true
                    }
                },
                Company: {
                    select: {
                        Contact: {
                            where: {
                                status: contact_status.Active, // Active
                                email: { not: null }
                            },
                            orderBy: {
                                priority_level: 'asc' // Primary first
                            },
                            take: 1,
                            select: {
                                email: true,
                                first_name: true
                            }
                        }
                    }
                }
            },
        });

        if (!customer) {
            return null;
        }

        let emailToSend = customer.email;
        let name = "Customer";

        if (!emailToSend && customer.Company?.Contact?.[0]?.email) {
            emailToSend = customer.Company.Contact[0].email;
            name = customer.Company.Contact[0].first_name || name;
        }

        if (!emailToSend) {
            return null;
        }

        const verificationEnabled = customer.Account?.portal_verification_enabled ?? true;

        return { email: emailToSend, name, accountId: customer.account_id, verificationEnabled };
    }

    /**
     * Send the verification code to the customer's email
     */
    async sendVerificationEmail(customerUUID: string, contactId?: number, locale: string = 'en'): Promise<{ success: boolean; emailObfuscated?: string; error?: string }> {
        try {
            const customerData = await this.getEmailAddress(customerUUID, contactId);

            if (!customerData) {
                this.logService.logMessage(LogLevel.WARNING, `No email found for customer ${customerUUID} (contactId: ${contactId})`, "VerificationService.sendVerificationEmail");
                return { success: false, error: "No contact email found." };
            }

            const { email: emailToSend, name, accountId, verificationEnabled } = customerData;

            if (!verificationEnabled) {
                return { success: false, error: "Verification is disabled for this account." };
            }

            // 2. Generate Code
            const code = await this.generateCode(customerUUID);

            // 3. Send Email
            try {
                await this.emailService.setCustomerSenderNameAndReplyToEmail(accountId);
            } catch (e) {
                await this.logService.logMessage(LogLevel.ERROR, "Failed to set sender config", "VerificationService", { accountId });
                // Continue with default sender if specific one fails
            }

            const subject = "Your Verification Code"; // TODO: Localize
            // Simple HTML template for now
            const body = `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Verification Code</h2>
                    <p>Hello ${name},</p>
                    <p>Please use the following code to access your portal:</p>
                    <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 20px 0;">
                        ${code}
                    </div>
                    <p>This code will expire in 15 minutes.</p>
                    <p>If you didn't request this code, please ignore this email.</p>
                </div>
            `;

            await this.emailService.sendEmail(emailToSend, subject, body);

            // Return success with obfuscated email for UI display
            const [local, domain] = emailToSend.split('@');
            const obfuscated = `${local.substring(0, 2)}***@${domain}`;

            return { success: true, emailObfuscated: obfuscated };

        } catch (error) {
            const errorMessage = (error as Error).message;
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to send verification email: ${errorMessage}`,
                "VerificationService.sendVerificationEmail",
                { customerUUID }
            );
            return { success: false, error: `Error: ${errorMessage}` };
        }
    }
}
