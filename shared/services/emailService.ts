import {
    SESClient,
    SendEmailCommand,
    CreateConfigurationSetCommand,
    CreateConfigurationSetEventDestinationCommand,
} from "@aws-sdk/client-ses";

// Configure AWS SES v3 client
const sesClient = new SESClient({
    region: process.env.NEXT_APP_AWS_REGION,
    credentials: {
        accessKeyId: process.env.NEXT_APP_AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.NEXT_APP_AWS_SECRET_ACCESS_KEY || "",
    },
});

interface SendEmailParams {
    to: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
    fromEmail: string;
    fromName?: string;
    activityContactId: number;
    configurationSetName?: string;
}

export async function sendEmailWithSESTracking(params: SendEmailParams) {
    const {
        to,
        subject,
        htmlContent,
        textContent,
        fromEmail,
        fromName,
        activityContactId,
        configurationSetName = process.env.SES_CONFIGURATION_SET ||
        "default-config-set",
    } = params;

    try {
        // Prepare email command for AWS SDK v3
        const command = new SendEmailCommand({
            Source: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
            Destination: {
                ToAddresses: [to],
            },
            Message: {
                Subject: {
                    Data: subject,
                    Charset: "UTF-8",
                },
                Body: {
                    Html: {
                        Data: htmlContent,
                        Charset: "UTF-8",
                    },
                    ...(textContent && {
                        Text: {
                            Data: textContent,
                            Charset: "UTF-8",
                        },
                    }),
                },
            },
            ConfigurationSetName: configurationSetName,
            Tags: [
                {
                    Name: "ActivityContactId",
                    Value: activityContactId.toString(),
                },
            ],
        });

        // Send email via SES v3
        const result = await sesClient.send(command);
        const messageId = result.MessageId;

        // Update the activity contact with SES message ID
        const { prisma } = await import("@/lib/prisma");
        await prisma.activityContact.update({
            where: { id: activityContactId },
            data: {
                message_id: messageId, // Use existing message_id field
                sent_at: new Date(),
                status: "Sent",
            },
        });

        return { success: true, messageId };
    } catch (error: any) {
        // Update activity contact with failure status
        const { prisma } = await import("@/lib/prisma");
        await prisma.activityContact.update({
            where: { id: activityContactId },
            data: {
                status: "Failed",
                failed_at: new Date(),
                failure_reason: error.message,
            },
        });

        throw error;
    }
}

// Function to configure SES event publishing
export async function configureSESEventPublishing() {
    // Use existing configuration set
    const configSetName =
        process.env.SES_CONFIGURATION_SET || "email-tracking-config-set";

    try {
        const createConfigSetCommand = new CreateConfigurationSetCommand({
            ConfigurationSet: {
                Name: configSetName,
            },
        });
        await sesClient.send(createConfigSetCommand);
    } catch (error: any) {
        // Ignore if configuration set already exists
        if (error.name !== "ConfigurationSetAlreadyExistsException") {
            throw error;
        }
    }

    // Create event destination for delivery notifications
    const snsTopicArn = process.env.NEXT_APP_AWS_SNS_TOPIC_ARN;
    if (!snsTopicArn) {
        throw new Error(
            "NEXT_APP_AWS_SNS_TOPIC_ARN environment variable is required"
        );
    }

    try {
        const createEventDestCommand = new CreateConfigurationSetEventDestinationCommand({
            ConfigurationSetName: configSetName,
            EventDestination: {
                Name: "delivery-events",
                Enabled: true,
                MatchingEventTypes: [
                    "send",
                    "delivery",
                    "bounce",
                    "complaint",
                    "open",
                    "click",
                ],
                SNSDestination: {
                    TopicARN: snsTopicArn,
                },
            },
        });
        await sesClient.send(createEventDestCommand);
    } catch (error: any) {
        if (error.name !== "EventDestinationAlreadyExistsException") {
            throw error;
        }
    }

    return configSetName;
}
