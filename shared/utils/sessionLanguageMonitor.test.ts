import { describe, expect, it } from "vitest";

import {
    isAuthRoute,
    shouldRedirectForSessionLocale,
} from "./sessionLanguageMonitor";

describe("sessionLanguageMonitor", () => {
    describe("isAuthRoute", () => {
        it("treats localized login as an auth route", () => {
            expect(isAuthRoute("/en/login")).toBe(true);
            expect(isAuthRoute("/he/login")).toBe(true);
        });

        it("treats password reset routes as auth routes", () => {
            expect(isAuthRoute("/en/forget-password")).toBe(true);
            expect(isAuthRoute("/he/reset-password")).toBe(true);
        });

        it("does not treat app routes as auth routes", () => {
            expect(isAuthRoute("/en/app/dashboard")).toBe(false);
        });
    });

    describe("shouldRedirectForSessionLocale", () => {
        it("does not locale-bounce the login page after sign-in (Hebrew user on /en/login)", () => {
            // Regression: SessionLanguageMonitor used to hard-nav /en/login → /he/login
            // while handlePasswordLogin was still resolving the dashboard URL, causing
            // a visible login reload before the app.
            const result = shouldRedirectForSessionLocale({
                pathname: "/en/login",
                status: "authenticated",
                sessionLanguage: "Hebrew",
                languageChangeInProgress: false,
                isPortalRoute: false,
            });
            expect(result).toEqual({ redirect: false });
        });

        it("still redirects mismatched locale on app routes", () => {
            const result = shouldRedirectForSessionLocale({
                pathname: "/en/app/dashboard",
                status: "authenticated",
                sessionLanguage: "Hebrew",
                languageChangeInProgress: false,
                isPortalRoute: false,
            });
            expect(result).toEqual({
                redirect: true,
                newPath: "/he/app/dashboard",
            });
        });

        it("does not redirect when locale already matches", () => {
            const result = shouldRedirectForSessionLocale({
                pathname: "/he/app/customers",
                status: "authenticated",
                sessionLanguage: "Hebrew",
                languageChangeInProgress: false,
                isPortalRoute: false,
            });
            expect(result).toEqual({ redirect: false });
        });

        it("does not redirect while a user-owned language change is in progress", () => {
            // Regression: updateSession flips session language before the hard-nav;
            // without this guard SessionLanguageMonitor races a second reload.
            const result = shouldRedirectForSessionLocale({
                pathname: "/en/app/settings/users/abc",
                status: "authenticated",
                sessionLanguage: "Hebrew",
                languageChangeInProgress: true,
                isPortalRoute: false,
            });
            expect(result).toEqual({ redirect: false });
        });

        it("does not redirect during post-login handoff on /app", () => {
            const result = shouldRedirectForSessionLocale({
                pathname: "/en/app/dashboard",
                status: "authenticated",
                sessionLanguage: "Hebrew",
                languageChangeInProgress: false,
                loginHandoffInProgress: true,
                isPortalRoute: false,
            });
            expect(result).toEqual({ redirect: false });
        });

        it("treats hebrew language case-insensitively", () => {
            const result = shouldRedirectForSessionLocale({
                pathname: "/he/app/dashboard",
                status: "authenticated",
                sessionLanguage: "hebrew",
                languageChangeInProgress: false,
                isPortalRoute: false,
            });
            expect(result).toEqual({ redirect: false });
        });

        it("skips portal routes", () => {
            const result = shouldRedirectForSessionLocale({
                pathname: "/en/portal/abc",
                status: "authenticated",
                sessionLanguage: "Hebrew",
                languageChangeInProgress: false,
                isPortalRoute: true,
            });
            expect(result).toEqual({ redirect: false });
        });
    });
});
