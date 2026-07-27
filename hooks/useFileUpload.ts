import { useState, useCallback } from 'react';

import { fileUploadServiceClient, FileUploadServiceClient } from '@/lib/fileUploadServiceClient';

export const useFileUpload = () => {
    const [isLoading, setIsLoading] = useState(false);

    const getFileUrl = useCallback(async (filePath: string, expiresIn: number = 3600): Promise<string> => {
        setIsLoading(true);
        try {
            return await FileUploadServiceClient.getFileUrl(filePath, expiresIn);
        } catch (error) {
            console.error('Error getting file URL:', error);
            // Return original path as fallback
            return filePath;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const isS3File = useCallback((filePath: string): boolean => {
        return FileUploadServiceClient.isS3File(filePath);
    }, []);

    return {
        getFileUrl,
        isS3File,
        isLoading,
    };
};
