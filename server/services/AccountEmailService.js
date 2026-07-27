import nodemailer from "nodemailer";

import { addEnvironmentPrefixToEmailSubject } from "@/utils/domainUtils";

class CustomerEmailService {
    constructor(email, password, senderEmail, fromName) {
        this.transporter = nodemailer.createTransport({
            service: "Gmail", // Use your email service provider
            auth: {
                user: email, // Email address provided at runtime
                pass: password, // Email password or an app-specific password provided at runtime
            },
        });
        this.senderEmail = senderEmail;
        this.fromName = fromName;
    }

    async sendEmail({
        toEmail,
        subject,
        body,
        replyToEmail = "",
        ccEmail = "",
    }) {
        // Add environment prefix to subject
        const prefixedSubject = addEnvironmentPrefixToEmailSubject(subject);

        const mailOptions = {
            from: `${this.fromName} <${this.senderEmail}>`, // Sender address
            to: toEmail, // List of recipients
            subject: prefixedSubject, // Subject line with environment prefix
            html: body,
        };

        if (replyToEmail !== "") mailOptions.replyTo = replyToEmail;

        if (ccEmail !== "") mailOptions.cc = ccEmail;

        const info = await this.transporter.sendMail(mailOptions);
        return info.response; // Return the response if the email is sent successfully
    }
}

export default CustomerEmailService;
