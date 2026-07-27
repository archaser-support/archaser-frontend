import { describe, it, expect } from "vitest";

import { prisma } from "../lib/prisma";

describe.skip("Customer Language Assignment (Requires Playwright Setup)", () => {
    test("should set language to Hebrew when country is Israel", async ({
        request,
    }) => {
        // Test data
        const israelCustomerData = {
            customer_number: "TEST-ISRAEL-001",
            type: "Company",
            country_id: 106, // Israel
            collection_status: "Active",
        };

        // Create customer with Israel country
        const response = await request.post("/api/customers", {
            data: israelCustomerData,
            headers: {
                "Content-Type": "application/json",
            },
        });

        expect(response.status()).toBe(200);
        const customer = await response.json();

        // Verify language is set to Hebrew
        expect(customer.language).toBe("Hebrew");

        // Clean up - delete the test customer
        if (customer.id) {
            await prisma.customer.delete({
                where: { id: customer.id },
            });
        }
    });

    test("should set language to English when country is not Israel", async ({
        request,
    }) => {
        // Test data
        const usCustomerData = {
            customer_number: "TEST-US-001",
            type: "Company",
            country_id: 233, // United States
            collection_status: "Active",
        };

        // Create customer with US country
        const response = await request.post("/api/customers", {
            data: usCustomerData,
            headers: {
                "Content-Type": "application/json",
            },
        });

        expect(response.status()).toBe(200);
        const customer = await response.json();

        // Verify language is set to English
        expect(customer.language).toBe("English");

        // Clean up - delete the test customer
        if (customer.id) {
            await prisma.customer.delete({
                where: { id: customer.id },
            });
        }
    });

    test("should set language to English when no country is specified", async ({
        request,
    }) => {
        // Test data
        const noCountryCustomerData = {
            customer_number: "TEST-NO-COUNTRY-001",
            type: "Company",
            collection_status: "Active",
        };

        // Create customer without country
        const response = await request.post("/api/customers", {
            data: noCountryCustomerData,
            headers: {
                "Content-Type": "application/json",
            },
        });

        expect(response.status()).toBe(200);
        const customer = await response.json();

        // Verify language defaults to English
        expect(customer.language).toBe("English");

        // Clean up - delete the test customer
        if (customer.id) {
            await prisma.customer.delete({
                where: { id: customer.id },
            });
        }
    });
});
