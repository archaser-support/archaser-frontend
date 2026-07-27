/**
 * File Deletion Service
 * Handles deletion of files from both S3 and local filesystem for account deletion
 */

import {
    S3Client,
    DeleteObjectsCommand,
    ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { LogService } from "./LogService";
import { LogLevel } from "@/types/enums";

export class FileDeletionService {
    private s3Client: S3Client | null = null;
    private bucketName: string | null = null;
    private logService: LogService;
    private isS3Configured: boolean = false;

    constructor() {
        this.logService = LogService.getInstance();
        this.initializeS3();
    }

    private initializeS3() {
        const accessKeyId = process.env.NEXT_APP_AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.NEXT_APP_AWS_SECRET_ACCESS_KEY;
        const region = process.env.NEXT_APP_AWS_REGION;
        this.bucketName = process.env.NEXT_APP_AWS_S3_BUCKET_NAME || null;

        if (accessKeyId && secretAccessKey && region && this.bucketName) {
            this.s3Client = new S3Client({
                region,
                credentials: {
                    accessKeyId,
                    secretAccessKey,
                },
            });
            this.isS3Configured = true;
        }
    }

    /**
     * Delete all files associated with an account
     * @param accountId - Account ID
     * @returns Object with deletion results
     */
    async deleteAccountFiles(accountId: number): Promise<{
        success: boolean;
        filesDeleted: number;
        errors: string[];
    }> {
        const errors: string[] = [];
        let filesDeleted = 0;

        try {
            await this.logService.logMessage(
                LogLevel.INFO,
                `Starting file deletion for account ${accountId}`,
                "FileDeletionService",
                { accountId }
            );

            // Delete activity attachments from database and storage
            const attachmentResult =
                await this.deleteActivityAttachments(accountId);
            filesDeleted += attachmentResult.filesDeleted;
            errors.push(...attachmentResult.errors);

            // Delete account logo
            const logoResult = await this.deleteAccountLogo(accountId);
            if (logoResult.deleted) {
                filesDeleted++;
            }
            errors.push(...logoResult.errors);

            // Delete account folder (S3 or local)
            const folderResult = await this.deleteAccountFolder(accountId);
            filesDeleted += folderResult.filesDeleted;
            errors.push(...folderResult.errors);

            await this.logService.logMessage(
                LogLevel.INFO,
                `File deletion completed for account ${accountId}. Deleted ${filesDeleted} files.`,
                "FileDeletionService",
                { accountId, filesDeleted, errorCount: errors.length }
            );

            return {
                success: errors.length === 0,
                filesDeleted,
                errors,
            };
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to delete files for account ${accountId}: ${error.message}`,
                "FileDeletionService",
                { accountId, error: error.message }
            );

            return {
                success: false,
                filesDeleted,
                errors: [...errors, error.message],
            };
        }
    }

    /**
     * Delete activity attachments for an account
     */
    private async deleteActivityAttachments(accountId: number): Promise<{
        filesDeleted: number;
        errors: string[];
    }> {
        const errors: string[] = [];
        let filesDeleted = 0;

        try {
            // Get all activity attachments for this account
            const attachments = await prisma.activityAttachment.findMany({
                where: { account_id: accountId },
                select: { id: true, file_path: true },
            });

            await this.logService.logMessage(
                LogLevel.INFO,
                `Found ${attachments.length} activity attachments for account ${accountId}`,
                "FileDeletionService",
                { accountId, attachmentCount: attachments.length }
            );

            // Delete each file from storage
            for (const attachment of attachments) {
                try {
                    if (this.isS3Configured) {
                        await this.deleteFromS3(attachment.file_path);
                    } else {
                        await this.deleteFromLocal(attachment.file_path);
                    }
                    filesDeleted++;
                } catch (error: any) {
                    errors.push(
                        `Failed to delete file ${attachment.file_path}: ${error.message}`
                    );
                }
            }

            // Delete database records
            await prisma.activityAttachment.deleteMany({
                where: { account_id: accountId },
            });

            return { filesDeleted, errors };
        } catch (error: any) {
            errors.push(
                `Failed to delete activity attachments: ${error.message}`
            );
            return { filesDeleted, errors };
        }
    }

    /**
     * Delete account logo
     */
    private async deleteAccountLogo(accountId: number): Promise<{
        deleted: boolean;
        errors: string[];
    }> {
        const errors: string[] = [];

        try {
            // Get account logo path
            const account = await prisma.account.findUnique({
                where: { id: accountId },
                select: { logo: true },
            });

            if (!account?.logo) {
                return { deleted: false, errors: [] };
            }

            // Delete logo file
            if (this.isS3Configured) {
                await this.deleteFromS3(account.logo);
            } else {
                await this.deleteFromLocal(account.logo);
            }

            return { deleted: true, errors: [] };
        } catch (error: any) {
            errors.push(`Failed to delete account logo: ${error.message}`);
            return { deleted: false, errors };
        }
    }

    /**
     * Delete entire account folder from S3 or local storage
     */
    private async deleteAccountFolder(accountId: number): Promise<{
        filesDeleted: number;
        errors: string[];
    }> {
        const errors: string[] = [];
        let filesDeleted = 0;

        try {
            if (this.isS3Configured) {
                const result = await this.deleteS3Folder(accountId.toString());
                filesDeleted = result.filesDeleted;
                errors.push(...result.errors);
            } else {
                const result = await this.deleteLocalFolder(accountId);
                filesDeleted = result.filesDeleted;
                errors.push(...result.errors);
            }

            return { filesDeleted, errors };
        } catch (error: any) {
            errors.push(`Failed to delete account folder: ${error.message}`);
            return { filesDeleted, errors };
        }
    }

    /**
     * Delete file from S3
     */
    private async deleteFromS3(filePath: string): Promise<void> {
        if (!this.s3Client || !this.bucketName) {
            throw new Error("S3 client not configured");
        }

        const command = new DeleteObjectsCommand({
            Bucket: this.bucketName,
            Delete: {
                Objects: [{ Key: filePath }],
            },
        });

        await this.s3Client.send(command);
    }

    /**
     * Delete entire folder from S3
     */
    private async deleteS3Folder(folderPrefix: string): Promise<{
        filesDeleted: number;
        errors: string[];
    }> {
        if (!this.s3Client || !this.bucketName) {
            return { filesDeleted: 0, errors: ["S3 client not configured"] };
        }

        const errors: string[] = [];
        let filesDeleted = 0;

        try {
            // List all objects in the folder
            const listCommand = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: `${folderPrefix}/`,
            });

            const listResponse = await this.s3Client.send(listCommand);

            if (!listResponse.Contents || listResponse.Contents.length === 0) {
                return { filesDeleted: 0, errors: [] };
            }

            // Delete all objects
            const objectsToDelete = listResponse.Contents.map((obj) => ({
                Key: obj.Key!,
            }));

            const deleteCommand = new DeleteObjectsCommand({
                Bucket: this.bucketName,
                Delete: {
                    Objects: objectsToDelete,
                },
            });

            const deleteResponse = await this.s3Client.send(deleteCommand);
            filesDeleted = deleteResponse.Deleted?.length || 0;

            if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
                deleteResponse.Errors.forEach((error) => {
                    errors.push(
                        `Failed to delete ${error.Key}: ${error.Message}`
                    );
                });
            }

            return { filesDeleted, errors };
        } catch (error: any) {
            errors.push(`Failed to delete S3 folder: ${error.message}`);
            return { filesDeleted, errors };
        }
    }

    /**
     * Delete file from local filesystem
     */
    private async deleteFromLocal(filePath: string): Promise<void> {
        const fullPath = path.join(process.cwd(), filePath);

        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    }

    /**
     * Delete entire folder from local filesystem
     */
    private async deleteLocalFolder(accountId: number): Promise<{
        filesDeleted: number;
        errors: string[];
    }> {
        const errors: string[] = [];
        let filesDeleted = 0;

        try {
            const folderPath = path.join(
                process.cwd(),
                "public",
                "uploads",
                accountId.toString()
            );

            if (!fs.existsSync(folderPath)) {
                return { filesDeleted: 0, errors: [] };
            }

            // Recursively delete folder and count files
            const deleteRecursive = (dirPath: string): void => {
                if (fs.existsSync(dirPath)) {
                    const files = fs.readdirSync(dirPath);

                    files.forEach((file) => {
                        const filePath = path.join(dirPath, file);
                        const stat = fs.statSync(filePath);

                        if (stat.isDirectory()) {
                            deleteRecursive(filePath);
                        } else {
                            fs.unlinkSync(filePath);
                            filesDeleted++;
                        }
                    });

                    fs.rmdirSync(dirPath);
                }
            };

            deleteRecursive(folderPath);

            return { filesDeleted, errors };
        } catch (error: any) {
            errors.push(`Failed to delete local folder: ${error.message}`);
            return { filesDeleted, errors };
        }
    }
}
