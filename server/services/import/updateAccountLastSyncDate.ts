import { prisma } from "@/lib/prisma";

export async function updateAccountLastSyncDate(
    accountId: number,
    syncedAt: Date = new Date()
): Promise<void> {
    await prisma.account.update({
        where: { id: accountId },
        data: { last_sync_date: syncedAt },
    });
}
