import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseFilePipeBuilder,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor, AnyFilesInterceptor } from '@nestjs/platform-express';
import { ScenesService } from './scenes.service';
import { UploadService } from '../uploads/upload.service';

@Controller('scenes')
export class ScenesController {
  constructor(
    private readonly scenesService: ScenesService,
    private readonly uploadService: UploadService, // Your Panorama Validator
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadScene(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png)$/ })
        .addMaxSizeValidator({ maxSize: 20 * 1024 * 1024 }) // 20MB for 360 photos
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
    @Body() body: { title: string },
  ) {
    if (!file) throw new BadRequestException('File is required');

    // 1. VALIDATION (The "Guard")
    // Ensures aspect ratio is 2:1 (Panorama)
    this.uploadService.validatePanorama(file.buffer, file.originalname);

    // 2. HARDCODED DEMO STORE
    // In future, this comes from JWT
    const demoStoreId = 'store-123';

    // 3. PROCESSING
    // This will:
    // a) Save the 360 image
    // b) Run the AI to auto-detect hotspots
    // c) Save everything to DB
    return this.scenesService.processScene(demoStoreId, file, body.title);
  }

  @Get(':id')
  async getScene(@Param('id') id: string) {
    const scene = await this.scenesService.getSceneById(id);
    if (!scene) throw new NotFoundException('Scene not found');
    return scene;
  }

  @Post('stitch')
  @UseInterceptors(AnyFilesInterceptor())
  async stitchScenes(@UploadedFiles() files: Array<Express.Multer.File>) {
    if (!files || files.length < 2) {
      throw new BadRequestException('At least 2 files are required for stitching');
    }
    const resultUrl = await this.scenesService.stitchScene(files);
    return { success: true, imageUrl: resultUrl };
  }
}
