import { describe, it, expect, beforeEach, vi } from 'vitest';

import { FileUploadService } from '@/lib/fileUploadService';

// Mock environment variables
const mockEnv = {
    NODE_ENV: 'development',
    NEXT_APP_AWS_ACCESS_KEY_ID: '',
    NEXT_APP_AWS_SECRET_ACCESS_KEY: '',
    NEXT_APP_AWS_REGION: 'eu-north-1',
    NEXT_APP_AWS_S3_BUCKET_NAME: '',
};

// Mock fs module - cannot use top-level variables in mock factory
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
        renameSync: vi.fn(),
        copyFileSync: vi.fn(),
        unlinkSync: vi.fn(),
        readFileSync: vi.fn(),
        statSync: vi.fn(),
        createReadStream: vi.fn(),
    },
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    renameSync: vi.fn(),
    copyFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    readFileSync: vi.fn(),
    statSync: vi.fn(),
    createReadStream: vi.fn(),
}));

// Mock path module - cannot use top-level variables in mock factory
vi.mock('path', () => ({
    default: {
        join: vi.fn(),
        extname: vi.fn(),
        basename: vi.fn(),
    },
    join: vi.fn(),
    extname: vi.fn(),
    basename: vi.fn(),
}));

// Mock process - cannot use top-level variables in mock factory
vi.mock('process', () => ({
    cwd: vi.fn(),
}));

describe('FileUploadService', () => {
    let service: FileUploadService;
    let mockFs: any;
    let mockPath: any;
    let mockProcessCwd: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Reset environment
        Object.keys(mockEnv).forEach(key => {
            process.env[key] = mockEnv[key];
        });

        // Get the mocked modules - access default export for default imports
        const fsModule = await import('fs');
        const pathModule = await import('path');
        const processModule = await import('process');

        // Access default export (for default imports) or named export
        mockFs = (fsModule.default || fsModule) as any;
        mockPath = (pathModule.default || pathModule) as any;
        mockProcessCwd = processModule.cwd as ReturnType<typeof vi.fn>;

        // Setup default mocks
        mockProcessCwd.mockReturnValue('/test/workspace');
        mockPath.join.mockImplementation((...args: any[]) => args.join('/'));
        mockPath.extname.mockReturnValue('.txt');
        mockPath.basename.mockReturnValue('test-file.txt');
        mockFs.existsSync.mockReturnValue(false);
        mockFs.statSync.mockReturnValue({ size: 1024 });
        mockFs.createReadStream.mockReturnValue({
            pipe: vi.fn(),
        });
        mockFs.copyFileSync.mockImplementation(() => { });
        mockFs.readFileSync.mockReturnValue(Buffer.from('test content'));
    });

    describe('Development Mode', () => {
        beforeEach(() => {
            // Ensure all S3-related env vars are cleared for development mode
            process.env.NODE_ENV = 'development';
            process.env.ENABLE_S3_UPLOAD = 'false';
            delete process.env.NEXT_APP_AWS_S3_BUCKET_NAME;
            delete process.env.NEXT_APP_AWS_ACCESS_KEY_ID;
            delete process.env.NEXT_APP_AWS_SECRET_ACCESS_KEY;
            service = new FileUploadService();
        });

        it('should use local storage in development mode', () => {
            expect(service['enableS3Upload']).toBe(false);
            expect(service['s3Client']).toBeNull();
        });

        it('should upload files to local storage', async () => {
            const mockFile = {
                filepath: '/tmp/test-file.txt',
                originalFilename: 'test-file.txt',
                mimetype: 'text/plain',
                size: 1024,
            };

            const result = await service.uploadFile(
                mockFile,
                '123',
                'user-1',
                1
            );

            // The service returns paths in format: public/uploads/{accountId}/{fileName}
            expect(result.filePath).toMatch(/^public\/uploads\/1\//);
            expect(result.fileName).toBe('test-file.txt');
            expect(result.fileSize).toBe(1024);
            expect(result.fileType).toBe('text/plain');
            expect(result.fileCategory).toBe('Text');
            expect(result.uploadedBy).toBe('user-1');
            expect(result.accountId).toBe(1);
        });

        it('should determine file categories correctly', async () => {
            const testCases = [
                { mimetype: 'image/jpeg', expected: 'Image' },
                { mimetype: 'audio/mp3', expected: 'Audio' },
                { mimetype: 'text/plain', expected: 'Text' },
                { mimetype: 'application/pdf', expected: 'Text' },
            ];

            for (const testCase of testCases) {
                const mockFile = {
                    filepath: '/tmp/test-file',
                    originalFilename: 'test-file',
                    mimetype: testCase.mimetype,
                    size: 1024,
                };

                const result = await service.uploadFile(
                    mockFile,
                    '123',
                    'user-1',
                    1
                );

                expect(result.fileCategory).toBe(testCase.expected);
            }
        });
    });

    describe('Production Mode', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
            process.env.ENABLE_S3_UPLOAD = 'true';
            process.env.NEXT_APP_AWS_S3_BUCKET_NAME = 'test-bucket';
            process.env.NEXT_APP_AWS_ACCESS_KEY_ID = 'test-key';
            process.env.NEXT_APP_AWS_SECRET_ACCESS_KEY = 'test-secret';
            process.env.NEXT_APP_AWS_REGION = 'eu-north-1';
        });

        it('should initialize S3 client in production mode', () => {
            service = new FileUploadService();
            expect(service['enableS3Upload']).toBe(true);
            expect(service['s3Client']).toBeDefined();
            expect(service['bucketName']).toBe('test-bucket');
        });

        it('should fall back to local storage when S3 is not configured', () => {
            process.env.ENABLE_S3_UPLOAD = 'false';
            process.env.NEXT_APP_AWS_S3_BUCKET_NAME = '';
            service = new FileUploadService();

            expect(service['enableS3Upload']).toBe(false);
            expect(service['s3Client']).toBeNull();
        });
    });

    describe('File Operations', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
            service = new FileUploadService();
        });

        it('should handle file download from local storage', async () => {
            const mockStream = { pipe: vi.fn() };
            mockFs.existsSync.mockReturnValue(true);
            mockFs.createReadStream.mockReturnValue(mockStream);

            const result = await service.downloadFile(
                'public/uploads/test-file.txt',
                'test-file.txt',
                'text/plain'
            );

            expect(result.stream).toBe(mockStream);
            expect(result.fileName).toBe('test-file.txt');
            expect(result.fileType).toBe('text/plain');
            expect(result.fileSize).toBe(1024);
        });

        it('should handle file deletion from local storage', async () => {
            mockFs.existsSync.mockReturnValue(true);
            // Reset path.join mock to track calls
            mockPath.join.mockClear();
            mockPath.join.mockImplementation((...args: any[]) => args.join('/'));

            await expect(
                service.deleteFile('public/uploads/test-file.txt')
            ).resolves.not.toThrow();

            // The service joins process.cwd() with the filePath
            expect(mockFs.unlinkSync).toHaveBeenCalled();
            // Verify path.join was called (with actual process.cwd() or mocked value)
            expect(mockPath.join).toHaveBeenCalled();
            // Verify unlinkSync was called with a path that includes the filePath
            const unlinkCall = mockFs.unlinkSync.mock.calls[0][0];
            expect(unlinkCall).toContain('public/uploads/test-file.txt');
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
            service = new FileUploadService();
        });

        it('should handle missing files gracefully', async () => {
            mockFs.existsSync.mockReturnValue(false);

            await expect(
                service.downloadFile(
                    'public/uploads/missing-file.txt',
                    'missing-file.txt',
                    'text/plain'
                )
            ).rejects.toThrow('File not found');
        });

        it('should handle file upload errors gracefully', async () => {
            mockFs.copyFileSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            const mockFile = {
                filepath: '/tmp/test-file.txt',
                originalFilename: 'test-file.txt',
                mimetype: 'text/plain',
                size: 1024,
            };

            await expect(
                service.uploadFile(mockFile, '123', 'user-1', 1)
            ).rejects.toThrow('Permission denied');
        });
    });
});
