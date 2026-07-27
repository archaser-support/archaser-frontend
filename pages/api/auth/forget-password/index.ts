import crypto from "crypto";

import { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@/lib/prisma";
import { sentResetPasswordEmail } from "@/server/EmailService";
import AppUrls from "@/utils/appUrls";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    try {
        const { email, language } = req.body;

        const user = await prisma.user.findFirst({
            where: {
                email,
            }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour expiry

        await prisma.user.update({
            where: { id: user.id },
            data: { resetToken, resetTokenExpiry },
        });

        // Use automatic language detection from user table, with fallback to provided language
        await sentResetPasswordEmail(
            process.env.NEXTAUTH_URL + AppUrls.RESET_PASSWORD(resetToken),
            email,
            language // Optional override, will auto-detect from user table if not provided
        );

        return res
            .status(200)
            .json({ message: "Reset link sent to your email" });
    } catch (error: any) {
        console.error("Error in forget password:", error);

        // Check if it's an SMTP authentication error
        if (
            error.code === "EAUTH" ||
            error.message?.includes("Username and Password not accepted")
        ) {
            return res.status(500).json({
                message:
                    "Email service configuration error. Please contact support.",
                error:
                    process.env.NODE_ENV === "development"
                        ? error.message
                        : undefined,
            });
        }

        // Check if it's an email template error
        if (
            error.message?.includes("Invalid template type") ||
            error.message?.includes("Template not found")
        ) {
            return res.status(500).json({
                message: "Email template error. Please contact support.",
                error:
                    process.env.NODE_ENV === "development"
                        ? error.message
                        : undefined,
            });
        }

        return res.status(500).json({
            message: "Failed to process forget password request",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
}
