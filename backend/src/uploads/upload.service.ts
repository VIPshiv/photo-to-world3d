import { Injectable, BadRequestException } from '@nestjs/common';
import * as sizeOf from 'image-size';

@Injectable()
export class UploadService {
  /**
   * Validates if the uploaded file is a valid 360 panorama (2:1 aspect ratio).
   * @param buffer File buffer
   * @param filename Filename for error context
   */
  validatePanorama(buffer: Buffer, filename: string): void {
    try {
      const dimensions = sizeOf.imageSize(buffer);

      if (!dimensions.width || !dimensions.height) {
        throw new BadRequestException(
          `Could not determine dimensions for file: ${filename}`,
        );
      }

      // 360 Panoramas are typically 2:1 ratio (width = 2 * height)
      // We allow a small error margin (tolerance) because some cameras are 6080x3040, others might be slightly off.
      const ratio = dimensions.width / dimensions.height;
      const expectedRatio = 2.0;
      const tolerance = 0.1; // Allow 1.9 to 2.1

      if (Math.abs(ratio - expectedRatio) > tolerance) {
        throw new BadRequestException(
          `Invalid aspect ratio (${ratio.toFixed(2)}). 360° photos must be 2:1 (e.g. 4096x2048). Your image is ${dimensions.width}x${dimensions.height}.`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid image file');
    }
  }
}
