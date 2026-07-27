import fs from "fs";
import path from "path";
import { Readable } from "stream";

import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface FileUploadResult {
    filePath: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    fileCategory: "Text" | "Image" | "Audio";
    uploadedBy: string;
    accountId: number;
}

export interface FileDownloadResult {
    stream: Readable;
    fileName: string;
    fileType: string;
    fileSize: number;
}

export class FileUploadService {
    private s3Client: S3Client | null = null;
    private bucketName: string;
    private region: string;
    private enableS3Upload: boolean;

    constructor() {
        // Check if S3 upload is enabled
        this.enableS3Upload = process.env.ENABLE_S3_UPLOAD === "true";

        this.bucketName = process.env.NEXT_APP_AWS_S3_BUCKET_NAME || "";
        this.region = process.env.NEXT_APP_AWS_REGION || "eu-north-1";

        // Only initialize S3 client if S3 upload is enabled
        if (this.enableS3Upload) {
            const hasAwsCredentials = !!(
                process.env.NEXT_APP_AWS_ACCESS_KEY_ID &&
                process.env.NEXT_APP_AWS_SECRET_ACCESS_KEY
            );
            const hasBucketName = !!process.env.NEXT_APP_AWS_S3_BUCKET_NAME;

            if (!hasAwsCredentials || !hasBucketName) {
                throw new Error(
                    "S3 configuration is required when ENABLE_S3_UPLOAD is true. Please set NEXT_APP_AWS_ACCESS_KEY_ID, NEXT_APP_AWS_SECRET_ACCESS_KEY, and NEXT_APP_AWS_S3_BUCKET_NAME environment variables."
                );
            }

            try {
                this.s3Client = new S3Client({
                    region: this.region,
                    credentials: {
                        accessKeyId: process.env.NEXT_APP_AWS_ACCESS_KEY_ID!,
                        secretAccessKey:
                            process.env.NEXT_APP_AWS_SECRET_ACCESS_KEY!,
                    },
                });
            } catch (error) {
                console.error("Failed to initialize S3 client:", error);
                throw new Error(
                    `Failed to initialize S3 client: ${error instanceof Error ? error.message : "Unknown error"}`
                );
            }
        }
    }

    /**
     * Upload a file to S3 or local storage based on configuration
     */
    async uploadFile(
        file: {
            filepath: string;
            originalFilename?: string | null;
            mimetype?: string | null;
            size?: number;
        },
        activityId: string,
        userId: string,
        accountId: number
    ): Promise<FileUploadResult> {
        if (this.enableS3Upload) {
            return this.uploadToS3(file, activityId, userId, accountId);
        } else {
            return this.uploadToLocal(file, activityId, userId, accountId);
        }
    }

    /**
     * Download a file from S3 or local storage
     */
    async downloadFile(
        filePath: string,
        fileName: string,
        fileType: string
    ): Promise<FileDownloadResult> {
        if (this.isS3File(filePath)) {
            return this.downloadFromS3(filePath, fileName, fileType);
        } else {
            return this.downloadFromLocal(filePath, fileName, fileType);
        }
    }

    /**
     * Delete a file from S3 or local storage
     */
    async deleteFile(filePath: string): Promise<void> {
        if (this.isS3File(filePath)) {
            await this.deleteFromS3(filePath);
        } else {
            await this.deleteFromLocal(filePath);
        }
    }

    /**
     * Generate a presigned URL for S3 downloads
     */
    async generatePresignedUrl(
        filePath: string,
        expiresIn: number = 3600
    ): Promise<string | null> {
        if (!this.isS3Available()) {
            throw new Error("S3 client not configured");
        }

        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: filePath,
            });

            // We know s3Client is not null here because isS3Available() checks for it
            return await getSignedUrl(this.s3Client!, command, { expiresIn });
        } catch (error) {
            console.error("Error generating presigned URL:", error);
            throw new Error(
                `Failed to generate presigned URL: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }

    /**
     * Check if a file path is stored in S3 or local storage
     */
    isS3File(filePath: string): boolean {
        // Check if the file path starts with account_id/ (S3 format) or public/uploads/ (local format)
        return !filePath.startsWith("public/uploads/");
    }

    /**
     * Check if S3 is properly configured and available
     */
    isS3Available(): boolean {
        // Check if we have S3 client and bucket name, regardless of NODE_ENV
        // This allows S3 to work even in development if credentials are provided
        return !!this.s3Client && !!this.bucketName;
    }

    /**
     * Generate the appropriate URL for a file (S3 presigned URL or local file URL)
     */
    async getFileUrl(
        filePath: string,
        expiresIn: number = 3600
    ): Promise<string> {
        if (this.isS3File(filePath)) {
            if (this.isS3Available()) {
                const presignedUrl = await this.generatePresignedUrl(
                    filePath,
                    expiresIn
                );
                if (presignedUrl) {
                    return presignedUrl;
                }
                // Fallback to direct S3 URL if presigned URL generation fails
                return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${filePath}`;
            } else {
                throw new Error(
                    "S3 is not configured - cannot generate file URL"
                );
            }
        } else {
            // For local files, return the relative path that can be served by Next.js
            return `/${filePath}`;
        }
    }

    /**
     * Get the current configuration status for debugging
     */
    getConfigurationStatus() {
        return {
            enableS3Upload: this.enableS3Upload,
            hasS3Client: !!this.s3Client,
            hasBucketName: !!this.bucketName,
            bucketName: this.bucketName,
            region: this.region,
            hasAwsCredentials: !!(
                process.env.NEXT_APP_AWS_ACCESS_KEY_ID &&
                process.env.NEXT_APP_AWS_SECRET_ACCESS_KEY
            ),
        };
    }

    /**
     * Test S3 connection (for debugging)
     */
    async testS3Connection(): Promise<boolean> {
        if (!this.s3Client || !this.bucketName) {
            return false;
        }

        try {
            // Try to list objects in the bucket (limited to 1 item)
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: "test-connection",
            });

            // This will fail with a 404, but it will test the connection
            await this.s3Client.send(command);
            return true;
        } catch (error: any) {
            // 404 is expected for a non-existent key, but it means the connection works
            if (error.$metadata?.httpStatusCode === 404) {
                return true;
            }
            console.error("S3 connection test failed:", error);
            return false;
        }
    }

    private async uploadToS3(
        file: {
            filepath: string;
            originalFilename?: string | null;
            mimetype?: string | null;
            size?: number;
        },
        activityId: string,
        userId: string,
        accountId: number
    ): Promise<FileUploadResult> {
        if (!this.s3Client || !this.bucketName) {
            throw new Error("S3 client not configured");
        }

        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const fileExtension = path.extname(file.originalFilename || "");
        const s3Key = `${accountId}/${activityId}/${timestamp}-${randomString}${fileExtension}`;

        // Read file from local temp location
        const fileBuffer = fs.readFileSync(file.filepath);

        // Sanitize metadata values for S3 compatibility
        const sanitizeMetadataValue = (value: string): string => {
            // Remove or replace invalid characters for S3 metadata
            return value
                .replace(/[^\x20-\x7E]/g, "") // Remove non-ASCII printable characters
                .replace(/[^\w\s\-_.]/g, "_") // Replace special chars with underscore
                .substring(0, 1024); // Limit length to S3 metadata value limit
        };

        // Upload to S3
        const uploadCommand = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: s3Key,
            Body: fileBuffer,
            ContentType: file.mimetype || "application/octet-stream",
            ContentLength: file.size || fileBuffer.length,
            Metadata: {
                originalName: sanitizeMetadataValue(
                    file.originalFilename || "Unknown file"
                ),
                uploadedBy: sanitizeMetadataValue(userId),
                accountId: sanitizeMetadataValue(accountId.toString()),
                activityId: sanitizeMetadataValue(activityId),
            },
        });

        try {
            await this.s3Client.send(uploadCommand);
        } catch (error) {
            console.error("S3 upload failed:", error);
            throw new Error(
                `S3 upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }

        // Clean up local temp file
        try {
            fs.unlinkSync(file.filepath);
        } catch (_cleanupError) {
            // Ignore cleanup errors
        }

        // Determine file category
        const fileCategory = this.determineFileCategory(file.mimetype || "");

        return {
            filePath: s3Key,
            fileName: file.originalFilename || "Unknown file",
            fileSize: file.size || 0,
            fileType: file.mimetype || "application/octet-stream",
            fileCategory,
            uploadedBy: userId,
            accountId,
        };
    }

    private async downloadFromS3(
        filePath: string,
        fileName: string,
        fileType: string
    ): Promise<FileDownloadResult> {
        if (!this.s3Client || !this.bucketName) {
            throw new Error("S3 client not configured");
        }

        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: filePath,
        });

        const response = await this.s3Client.send(command);

        if (!response.Body) {
            throw new Error("File not found in S3");
        }

        return {
            stream: response.Body as Readable,
            fileName,
            fileType,
            fileSize: response.ContentLength || 0,
        };
    }

    private async deleteFromS3(filePath: string): Promise<void> {
        if (!this.s3Client || !this.bucketName) {
            throw new Error("S3 client not configured");
        }

        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: filePath,
        });

        await this.s3Client.send(command);
    }

    private determineFileCategory(
        mimeType: string
    ): "Text" | "Image" | "Audio" {
        if (mimeType.startsWith("image/")) {
            return "Image";
        } else if (mimeType.startsWith("audio/")) {
            return "Audio";
        } else {
            return "Text";
        }
    }

    private async uploadToLocal(
        file: {
            filepath: string;
            originalFilename?: string | null;
            mimetype?: string | null;
            size?: number;
        },
        activityId: string,
        userId: string,
        accountId: number
    ): Promise<FileUploadResult> {
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const fileExtension = path.extname(file.originalFilename || "");
        const fileName = `${timestamp}-${randomString}${fileExtension}`;

        // Create customer-specific directory
        const customerDir = path.join(
            process.cwd(),
            "public",
            "uploads",
            accountId.toString()
        );
        const filePath = path.join(customerDir, fileName);

        // Ensure directory exists
        if (!fs.existsSync(customerDir)) {
            fs.mkdirSync(customerDir, { recursive: true });
        }

        // Copy file from temp location to final location
        fs.copyFileSync(file.filepath, filePath);

        // Clean up local temp file
        try {
            fs.unlinkSync(file.filepath);
        } catch (_cleanupError) {
            // Ignore cleanup errors
        }

        // Determine file category
        const fileCategory = this.determineFileCategory(file.mimetype || "");

        // Return relative path for storage in database
        const relativePath = `public/uploads/${accountId}/${fileName}`;

        return {
            filePath: relativePath,
            fileName: file.originalFilename || "Unknown file",
            fileSize: file.size || 0,
            fileType: file.mimetype || "application/octet-stream",
            fileCategory,
            uploadedBy: userId,
            accountId,
        };
    }

    private async downloadFromLocal(
        filePath: string,
        fileName: string,
        fileType: string
    ): Promise<FileDownloadResult> {
        const fullPath = path.join(process.cwd(), filePath);

        if (!fs.existsSync(fullPath)) {
            throw new Error("File not found in local storage");
        }

        const stats = fs.statSync(fullPath);
        const fileStream = fs.createReadStream(fullPath);

        return {
            stream: fileStream,
            fileName,
            fileType,
            fileSize: stats.size,
        };
    }

    private async deleteFromLocal(filePath: string): Promise<void> {
        const fullPath = path.join(process.cwd(), filePath);

        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    }
}

// Export singleton instance
export const fileUploadService = new FileUploadService();
