import { prisma } from "@/lib/prisma";
import { logMessage } from "@/server/services/LogService";

class CronService {
    /**
     * Create a new CronJob record.
     * @param {string} name - The name of the cron job.
     * @returns {Promise<Object>} - The created CronJob record.
     */
    static async createCronJob(name) {
        try {
            const newJob = await prisma.cronJobs.create({
                data: {
                    name,
                },
            });
            return newJob;
        } catch (error) {
            await logMessage(
                "ERROR",
                `Error creating CronJob: ${error.message}`,
                "CronService.createCronJob"
            );
            throw error;
        }
    }

    /**
     * Get the latest CronJob record by name.
     * @param {string} name - The name of the cron job.
     * @returns {Promise<Object|null>} - The latest CronJob record or null if not found.
     */
    static async getLatestCronJobByName(name) {
        try {
            const latestJob = await prisma.cronJobs.findFirst({
                where: {
                    name,
                },
                orderBy: {
                    created_at: "desc",
                },
            });
            return latestJob;
        } catch (error) {
            await logMessage(
                "ERROR",
                `Error fetching latest CronJob by name: ${error.message}`,
                "CronService.getLatestCronJobByName"
            );
            throw error;
        }
    }

    /**
     * Get the created date of the latest CronJob by name.
     * @param {string} name - The name of the cron job.
     * @returns {Promise<Date|null>} - The created date of the latest CronJob or null if not found.
     */
    static async getLatestCronJobCreatedDate(name) {
        try {
            const latestJob = await this.getLatestCronJobByName(name);
            const createdDate = latestJob ? latestJob.created_at : null;
            return createdDate;
        } catch (error) {
            await logMessage(
                "ERROR",
                `Error fetching created date of the latest CronJob: ${error.message}`,
                "CronService.getLatestCronJobCreatedDate"
            );
            throw error;
        }
    }
}

export default CronService;
