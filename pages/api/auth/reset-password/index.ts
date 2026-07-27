import bcrypt from "bcryptjs";
import { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/server/utils/passwordValidation";

interface ResetPasswordRequest {
    token: string;
    password: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    try {
        const { token, password }: ResetPasswordRequest = req.body;

        // Validate password complexity
        const passwordErrors = validatePassword(password);
        if (passwordErrors.length > 0) {
            const errorMessages = passwordErrors
                .map((err) => err.message)
                .join(", ");
            return res.status(400).json({ message: errorMessages });
        }

        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: { gt: new Date() },
            },
        });

        // User found

        if (!user) {
            return res
                .status(400)
                .json({ message: "Invalid or expired token" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null,
                session_version: { increment: 1 },
            },
        });

        return res.status(200).json({
            message:
                "Password reset successfully. All existing sessions have been invalidated.",
        });
    } catch {
        // Error resetting password
        return res.status(500).json({ message: "Failed to reset password" });
    }
}
