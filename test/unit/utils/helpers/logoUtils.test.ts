import { describe, it, expect } from "vitest";

import {
    createLogoDataUrl,
    decodeLogo,
    isValidImage,
    getLogoMimeType,
} from "@/utils/logoUtils";

describe("logoUtils", () => {
    describe("createLogoDataUrl", () => {
        it("should create a valid data URL without query parameters", () => {
            // Create a simple PNG buffer (PNG signature + minimal data)
            const pngBuffer = new Uint8Array([
                0x89,
                0x50,
                0x4e,
                0x47,
                0x0d,
                0x0a,
                0x1a,
                0x0a, // PNG signature
                0x00,
                0x00,
                0x00,
                0x0d, // IHDR chunk length
                0x49,
                0x48,
                0x44,
                0x52, // IHDR
                0x00,
                0x00,
                0x00,
                0x01, // width
                0x00,
                0x00,
                0x00,
                0x01, // height
                0x08,
                0x02,
                0x00,
                0x00,
                0x00, // bit depth, color type, etc.
            ]);

            const result = createLogoDataUrl(pngBuffer);

            // Should start with data:image/png;base64,
            expect(result).toMatch(/^data:image\/png;base64,/);

            // Should not contain query parameters
            expect(result).not.toContain("?v=");
            expect(result).not.toContain("?");
        });

        it("should handle empty input", () => {
            const result = createLogoDataUrl();
            expect(result).toBe("");
        });

        it("should handle null input", () => {
            const result = createLogoDataUrl(null as any);
            expect(result).toBe("");
        });

        it("should handle already existing data URL", () => {
            const existingDataUrl =
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
            const result = createLogoDataUrl(existingDataUrl);
            expect(result).toBe(existingDataUrl);
        });
    });

    describe("decodeLogo", () => {
        it("should decode Uint8Array to data URL", () => {
            const jpegBuffer = new Uint8Array([
                0xff,
                0xd8,
                0xff, // JPEG signature
                0xe0,
                0x00,
                0x10,
                0x4a,
                0x46,
                0x49,
                0x46,
                0x00,
                0x01,
                0x01,
                0x01,
                0x00,
                0x48,
                0x00,
                0x48,
                0x00,
                0x00,
            ]);

            const result = decodeLogo(jpegBuffer);
            expect(result).toMatch(/^data:image\/jpeg;base64,/);
        });

        it("should handle object with data property", () => {
            const pngBuffer = new Uint8Array([
                0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            ]);

            const result = decodeLogo({ data: pngBuffer });
            expect(result).toMatch(/^data:image\/png;base64,/);
        });
    });

    describe("isValidImage", () => {
        it("should validate PNG images", () => {
            const pngBuffer = new Uint8Array([
                0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            ]);
            expect(isValidImage(pngBuffer)).toBe(true);
        });

        it("should validate JPEG images", () => {
            const jpegBuffer = new Uint8Array([0xff, 0xd8, 0xff]);
            expect(isValidImage(jpegBuffer)).toBe(true);
        });

        it("should reject invalid images", () => {
            const invalidBuffer = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
            expect(isValidImage(invalidBuffer)).toBe(false);
        });

        it("should reject empty buffers", () => {
            expect(isValidImage(new Uint8Array())).toBe(false);
        });
    });

    describe("getLogoMimeType", () => {
        it("should detect PNG format", () => {
            const pngBuffer = new Uint8Array([
                0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            ]);
            expect(getLogoMimeType(pngBuffer)).toBe("image/png");
        });

        it("should detect JPEG format", () => {
            const jpegBuffer = new Uint8Array([0xff, 0xd8, 0xff]);
            expect(getLogoMimeType(jpegBuffer)).toBe("image/jpeg");
        });

        it("should default to PNG for unknown formats", () => {
            const unknownBuffer = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
            expect(getLogoMimeType(unknownBuffer)).toBe("image/png");
        });
    });
});
