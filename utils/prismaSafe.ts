import { isAmplifySsrBuild } from "@/utils/amplifyMode";

/**
 * Lazy Prisma access for EC2 hybrid RSC pages.
 * Amplify UI builds must not open a database connection.
 */
export async function getPrismaSafe(): Promise<
    typeof import("@/lib/prisma").prisma | null
> {
    if (isAmplifySsrBuild()) {
        return null;
    }
    const mod = await import("@/lib/prisma");
    return mod.prisma;
}
