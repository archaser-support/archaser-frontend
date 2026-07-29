/**
 * Client-safe file upload service utilities
 * This version can be used in React components without Node.js dependencies
 */
import { apiFetch } from "@/utils/apiFetch";


export interface FileUploadResult {
    filePath: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    fileCategory: 'Text' | 'Image' | 'Audio';
    uploadedBy: string;
    accountId: number;
}

export class FileUploadServiceClient {
    /**
     * Check if a file path is stored in S3
     */
    static isS3File(filePath: string): boolean {
        // Check if the file path starts with public/uploads/ (local format) or account_id/ (S3 format)
        const isS3 = !filePath.startsWith('public/uploads/');
        return isS3;
    }

    /**
     * Get the appropriate URL for a file (S3 presigned URL or local path)
     * This method calls the API to get S3 presigned URLs
     */
    static async getFileUrl(filePath: string, expiresIn: number = 3600): Promise<string> {

        if (this.isS3File(filePath)) {
            try {
                // Call the API to get a presigned URL
                const response = await apiFetch(`/api/activities/attachments/presigned-url`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        filePath,
                        expiresIn,
                    }),
                });


                if (response.ok) {
                    const data = await response.json();
                    return data.url;
                } else {
                    const errorText = await response.text();
                    console.error('Failed to get presigned URL:', response.status, response.statusText, errorText);

                    // Handle specific error cases
                    if (response.status === 503) {
                        // S3 service unavailable - this is a configuration issue
                        return filePath;
                    } else if (response.status === 400) {
                        // File is not an S3 file - this shouldn't happen with our logic
                        return filePath;
                    } else {
                        // Other errors - return original path as fallback
                        return filePath;
                    }
                }
            } catch (error) {
                console.error('Error getting presigned URL:', error);
                // Return original path as fallback
                return filePath;
            }
        } else {
            // Local file - return the path as is (it should already be in the correct format)
            return filePath;
        }
    }
}

// Export singleton instance
export const fileUploadServiceClient = new FileUploadServiceClient();
