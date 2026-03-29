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
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor, AnyFilesInterceptor } from '@nestjs/platform-express';
import { ScenesService } from './scenes.service';
import { UploadService } from '../uploads/upload.service';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('scenes')
@UseGuards(MockAuthGuard)
export class ScenesController {
  constructor(
    private readonly scenesService: ScenesService,
    private readonly uploadService: UploadService, // Your Panorama Validator
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadScene(
    @CurrentUser() user: any,
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

    // 2. GET STORE FROM MOCK USER
    // The MockAuthGuard populated `req.user` which includes `.stores`
    // We assume the first store for simplicity
    const tenantStoreId =
      user?.stores && user.stores.length > 0 ? user.stores[0].id : null;

    if (!tenantStoreId) {
      throw new BadRequestException('No store associated with this user');
    }

    // 3. PROCESSING
    // This will:
    // a) Save the 360 image
    // b) Run the AI to auto-detect hotspots
    // c) Save everything to DB
    return this.scenesService.processScene(tenantStoreId, file, body.title);
  }

  @Get('store/my-scenes')
  async getMyScenes(@CurrentUser() user: any) {
    const tenantStoreId =
      user?.stores && user.stores.length > 0 ? user.stores[0].id : null;
    if (!tenantStoreId) return [];

    return this.scenesService.getScenesByStoreId(tenantStoreId); // Requires implementation in service
  }

  @Get(':id')
  async getScene(@Param('id') id: string) {
    const scene = await this.scenesService.getSceneById(id);
    if (!scene) throw new NotFoundException('Scene not found');
    return scene;
  }

  @Post(':id/finalize')
  async finalizeScene(@Param('id') id: string) {
    const scene = await this.scenesService.getSceneById(id);
    if (!scene) throw new NotFoundException('Scene not found');
    return this.scenesService.finalizeScene(id);
  }

  @Post('stitch')
  @UseInterceptors(AnyFilesInterceptor())
  async stitchScenes(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: { mode?: string },
  ) {
    if (!files || files.length < 2) {
      throw new BadRequestException(
        'At least 2 files are required for stitching',
      );
    }
    const mode = body.mode || 'guided';
    console.log(`[Stitch Request] Mode: ${mode}, Files: ${files.length}`);

    const resultUrl = await this.scenesService.stitchScene(files, mode);
    return { success: true, imageUrl: resultUrl };
  }
}
