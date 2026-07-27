// lib/services/UserContextService.ts

import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";
import { getCookieName } from "@/utils/authUtils";

export class UserContextService {
    private request: NextRequest;
    private token: any;

    constructor(request: NextRequest) {
        this.request = request;
    }

    private async extractToken() {
        if (this.token) return this.token;

        const isSecure =
            process.env.NODE_ENV === "production" &&
            process.env.NEXT_PUBLIC_BASE_URL?.startsWith("https://");

        this.token = await getToken({
            req: this.request,
            secret: process.env.NEXTAUTH_SECRET,
            cookieName: getCookieName(isSecure ?? false),
        });

        return this.token;
    }

    async getAccountId(): Promise<number | undefined> {
        const token = await this.extractToken();
        return token?.account_id;
    }

    async getUserId(): Promise<string | undefined> {
        const token = await this.extractToken();
        return token?.id;
    }

    async getUserLanguage(): Promise<"en" | "he"> {
        const token = await this.extractToken();
        const language = (token?.language as string) || "English";
        return language === "Hebrew" ? "he" : "en";
    }

    async getCustomerCurrency(): Promise<string | null | undefined> {
        const accountId = await this.getAccountId();
        if (!accountId) return null;

        const account = await prisma.account.findUnique({
            where: { id: accountId },
            select: { currency: true },
        });

        return account?.currency;
    }
}
