import { DefaultSession } from "next-auth";

// Extend the built-in Session & User types
declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            email: string;
            name: string;
            image?: string;
            account_id: number;
            account_name: string;
            primary_color?: string | null;
            secondary_color?: string | null;
            chart_palette_color?: string | null;
            language: string;
            role: string; // ✅ Add role field
            timezone?: string;
            currency?: string;
            locale?: string;
            view_as_user_id?: string;
            view_as_user_account_id?: number;
            view_as_user_role?: string;
            view_as_user_account_name?: string;
            view_as_user_name?: string;
            sidebar_collapsed?: boolean;
        } & DefaultSession["user"];
        view_as_user_id?: string;
        locale?: string;
        language?: string;
        sidebar_collapsed?: boolean;
    }

    interface User {
        id: string;
        email: string;
        name: string;
        image?: string;
        account_id: number | null;
        account_name?: string;
        primary_color?: string | null;
        secondary_color?: string | null;
        chart_palette_color?: string | null;
        language: string;
        role: string; // ✅ Add role field
        timezone?: string;
        currency?: string;
        locale?: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        email: string;
        name: string;
        image?: string;
        account_id: number | null;
        account_name?: string;
        primary_color?: string | null;
        secondary_color?: string | null;
        chart_palette_color?: string | null;
        language: string;
        role: string;
        timezone?: string;
        currency?: string;
        locale?: string;
        view_as_user_id?: string;
        view_as_user_account_id?: number;
        view_as_user_role?: string;
        view_as_user_account_name?: string;
        view_as_user_name?: string;
        session_version?: number;
        sidebar_collapsed?: boolean;
    }
}
