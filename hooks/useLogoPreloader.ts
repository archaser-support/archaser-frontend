/**
 * Logo Preloader Hook
 * 
 * Preloads S3 logos in the background to improve user experience.
 * Can be used to preload logos for related pages or components.
 */

import { useEffect } from 'react';

import { FileUploadServiceClient } from '@/lib/fileUploadServiceClient';
import { logoCache } from '@/utils/logoCache';

interface UseLogoPreloaderOptions {
    /**
     * Array of S3 file paths to preload
     */
    s3Paths: string[];

    /**
     * Whether to preload immediately or wait for a delay
     */
    immediate?: boolean;

    /**
     * Delay in milliseconds before preloading (if not immediate)
     */
    delay?: number;
}

/**
 * Hook to preload S3 logos in the background
 */
export function useLogoPreloader({
    s3Paths,
    immediate = false,
    delay = 1000
}: UseLogoPreloaderOptions) {
    useEffect(() => {
        if (!s3Paths.length) return;

        const preloadLogos = async () => {
            const preloadPromises = s3Paths
                .filter(path => FileUploadServiceClient.isS3File(path))
                .filter(path => !logoCache.isCached(path)) // Only preload if not already cached
                .map(async (s3Path) => {
                    try {
                        const presignedUrl = await FileUploadServiceClient.getFileUrl(s3Path);
                        logoCache.setCachedUrl(s3Path, presignedUrl);
                    } catch (error) {
                        // Silently handle preload failures
                    }
                });

            await Promise.allSettled(preloadPromises);
        };

        if (immediate) {
            preloadLogos();
        } else {
            const timeoutId = setTimeout(preloadLogos, delay);
            return () => clearTimeout(timeoutId);
        }
    }, [s3Paths, immediate, delay]);
}

/**
 * Utility function to preload a single S3 logo
 */
export async function preloadSingleLogo(s3Path: string): Promise<string | null> {
    if (!FileUploadServiceClient.isS3File(s3Path)) {
        return null;
    }

    // Check cache first
    const cached = logoCache.getCachedUrl(s3Path);
    if (cached) {
        return cached;
    }

    try {
        const presignedUrl = await FileUploadServiceClient.getFileUrl(s3Path);
        logoCache.setCachedUrl(s3Path, presignedUrl);
        return presignedUrl;
    } catch (error) {
        return null;
    }
}
