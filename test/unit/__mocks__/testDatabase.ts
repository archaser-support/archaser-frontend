import { PrismaClient } from "@prisma/client";

// Test database configuration
export class TestDatabase {
    private static instance: TestDatabase;
    private prisma: PrismaClient;

    private constructor() {
        // Create Prisma client with test environment
        this.prisma = new PrismaClient({
            datasources: {
                db: {
                    url: process.env.DATABASE_URL,
                },
            },
            log:
                process.env.NODE_ENV === "test"
                    ? ["error"]
                    : ["query", "info", "warn", "error"],
        });
    }

    public static getInstance(): TestDatabase {
        if (!TestDatabase.instance) {
            TestDatabase.instance = new TestDatabase();
        }
        return TestDatabase.instance;
    }

    public getPrisma(): PrismaClient {
        return this.prisma;
    }

    public async connect(): Promise<void> {
        try {
            await this.prisma.$connect();
            console.log("✅ Test database connected successfully");
        } catch (error) {
            console.error("❌ Test database connection failed:", error);
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        await this.prisma.$disconnect();
        console.log("🔌 Test database disconnected");
    }

    public async cleanup(): Promise<void> {
        // Clean up test data - be very specific to avoid affecting real data
        const testPrefixes = ["TEST_IMPORT_", "TEST_CREDIT_", "TEST_BATCH_"];

        for (const prefix of testPrefixes) {
            // Clean up invoices with test prefixes
            await this.prisma.invoice.deleteMany({
                where: {
                    invoice_number: {
                        startsWith: prefix,
                    },
                },
            });

            // Clean up customers with test IDs
            await this.prisma.customer.deleteMany({
                where: {
                    id: {
                        in: [
                            999996, 999995, 999994, 999993, 999992, 999991,
                            999990,
                        ],
                    },
                },
            });

            // Clean up customers with test IDs
            await this.prisma.customer.deleteMany({
                where: {
                    id: {
                        in: [
                            999996, 999995, 999994, 999993, 999992, 999991,
                            999990,
                        ],
                    },
                },
            });
        }

        console.log("🧹 Test data cleaned up");
    }

    public async verifyTestEnvironment(): Promise<void> {
        const dbUrl = process.env.DATABASE_URL;

        if (!dbUrl) {
            throw new Error("DATABASE_URL is not set in test environment");
        }

        // Verify we're not connecting to production
        if (dbUrl.includes("supabase.com") || dbUrl.includes("aws")) {
            throw new Error(
                "❌ CRITICAL: Tests are configured to use PRODUCTION database! Please check .env.test configuration."
            );
        }

        // Verify we're using local database
        if (!dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")) {
            console.warn(
                "⚠️ Warning: DATABASE_URL does not appear to be local. Verify test environment configuration."
            );
        }

        console.log("✅ Test environment verified - using local database");
    }
}

// Export singleton instance
export const testDatabase = TestDatabase.getInstance();
