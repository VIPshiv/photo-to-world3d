import {
  Controller,
  Post,
  Get,
  Delete,
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

  @Post('analyze')
  @UseInterceptors(FileInterceptor('file'))
  async analyzeScene(
    @CurrentUser() user: any,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png)$/ })
        .addMaxSizeValidator({ maxSize: 20 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
    @Body() body: { title: string; modelType?: string; sceneId?: string },
  ) {
    if (!file) throw new BadRequestException('File is required');
    this.uploadService.validatePanorama(file.buffer, file.originalname);

    const tenantStoreId =
      user?.stores && user.stores.length > 0 ? user.stores[0].id : null;
    if (!tenantStoreId)
      throw new BadRequestException('No store associated with this user');

    return this.scenesService.analyzeScene(
      tenantStoreId,
      file,
      body.title,
      body.modelType || 'yolo',
      body.sceneId,
    );
  }

  @Post('analyze-existing')
  async analyzeExistingScene(
    @CurrentUser() user: any,
    @Body() body: { imageUrl: string; modelType?: string; sceneId?: string },
  ) {
    const tenantStoreId =
      user?.stores && user.stores.length > 0 ? user.stores[0].id : null;
    if (!tenantStoreId)
      throw new BadRequestException('No store associated with this user');

    return this.scenesService.analyzeExistingScene(
      tenantStoreId,
      body.imageUrl,
      body.modelType || 'yolo',
      body.sceneId,
    );
  }

  @Post('save')
  async saveScene(
    @CurrentUser() user: any,
    @Body()
    body: {
      title: string;
      imageUrl: string;
      hotspots: any[];
      status?: string;
      modelType?: string;
      sceneId?: string;
    },
  ) {
    const tenantStoreId =
      user?.stores && user.stores.length > 0 ? user.stores[0].id : null;
    if (!tenantStoreId)
      throw new BadRequestException('No store associated with this user');

    if (body.sceneId) {
      return this.scenesService.updateScene(body.sceneId, {
        title: body.title,
        imageUrl: body.imageUrl,
        hotspots: body.hotspots,
        status: body.status || 'LIVE',
        modelType: body.modelType || 'yolo',
      });
    } else {
      return this.scenesService.createSceneWithHotspots(
        tenantStoreId,
        body.title,
        body.imageUrl,
        body.hotspots,
        body.status || 'LIVE',
        body.modelType || 'yolo',
      );
    }
  }

  @Post('draft')
  async createDraftScene(@CurrentUser() user: any) {
    const tenantStoreId =
      user?.stores && user.stores.length > 0 ? user.stores[0].id : null;
    if (!tenantStoreId)
      throw new BadRequestException('No store associated with this user');

    const scene = await this.scenesService.createDraftScene(tenantStoreId);
    return { sceneId: scene.id };
  }

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
    @Body() body: { title: string; sceneId?: string },
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
    return this.scenesService.processScene(
      tenantStoreId,
      file,
      body.title,
      body.sceneId,
    );
  }

  @Get('store/my-scenes')
  async getMyScenes(@CurrentUser() user: any) {
    const tenantStoreId =
      user?.stores && user.stores.length > 0 ? user.stores[0].id : null;
    if (!tenantStoreId) return [];

    return this.scenesService.getScenesByStoreId(tenantStoreId); // Requires implementation in service
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

  @Get(':id')
  async getScene(@Param('id') id: string) {
    const scene = await this.scenesService.getSceneById(id);
    if (!scene) throw new NotFoundException('Scene not found');
    return scene;
  }

  @Post(':id')
  async updateScene(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      imageUrl?: string;
      hotspots?: any[];
      status?: string;
      modelType?: string;
    },
    @CurrentUser() user: any,
  ) {
    const tenantStoreId =
      user?.stores && user.stores.length > 0 ? user.stores[0].id : null;
    if (!tenantStoreId)
      throw new BadRequestException('No store associated with this user');

    const scene = await this.scenesService.getSceneById(id);
    if (!scene) throw new NotFoundException('Scene not found');
    if (scene.storeId !== tenantStoreId)
      throw new BadRequestException('You do not own this scene');

    return this.scenesService.updateScene(id, body);
  }

  @Post(':id/finalize')
  async finalizeScene(@Param('id') id: string, @CurrentUser() user: any) {
    const tenantStoreId =
      user?.stores && user.stores.length > 0 ? user.stores[0].id : null;
    if (!tenantStoreId)
      throw new BadRequestException('No store associated with this user');

    const scene = await this.scenesService.getSceneById(id);
    if (!scene) throw new NotFoundException('Scene not found');
    if (scene.storeId !== tenantStoreId)
      throw new BadRequestException('You do not own this scene');

    return this.scenesService.finalizeScene(id);
  }

  @Post(':id/status')
  async updateSceneStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentUser() user: any,
  ) {
    const tenantStoreId =
      user?.stores && user.stores.length > 0 ? user.stores[0].id : null;
    if (!tenantStoreId)
      throw new BadRequestException('No store associated with this user');

    const scene = await this.scenesService.getSceneById(id);
    if (!scene) throw new NotFoundException('Scene not found');
    if (scene.storeId !== tenantStoreId)
      throw new BadRequestException('You do not own this scene');

    return this.scenesService.updateSceneStatus(id, body.status);
  }

  @Post(':id/replace-with-draft')
  async replaceWithDraft(
    @Param('id') liveId: string,
    @Body() body: { draftId: string },
    @CurrentUser() user: any,
  ) {
    const tenantStoreId =
      user?.stores && user.stores.length > 0 ? user.stores[0].id : null;
    if (!tenantStoreId)
      throw new BadRequestException('No store associated with this user');

    const liveScene = await this.scenesService.getSceneById(liveId);
    if (!liveScene || liveScene.storeId !== tenantStoreId)
      throw new BadRequestException('You do not own this live scene');

    const draftScene = await this.scenesService.getSceneById(body.draftId);
    if (!draftScene || draftScene.storeId !== tenantStoreId)
      throw new BadRequestException('You do not own this draft scene');

    return this.scenesService.replaceLiveWithDraft(liveId, body.draftId);
  }

  @Delete(':id')
  async deleteScene(@Param('id') id: string, @CurrentUser() user: any) {
    const tenantStoreId =
      user?.stores && user.stores.length > 0 ? user.stores[0].id : null;
    if (!tenantStoreId)
      throw new BadRequestException('No store associated with this user');

    const scene = await this.scenesService.getSceneById(id);
    if (!scene) throw new NotFoundException('Scene not found');
    if (scene.storeId !== tenantStoreId)
      throw new BadRequestException('You do not own this scene');

    return this.scenesService.deleteScene(id);
  }

  @Post(':id/cancel')
  async cancelDraftScene(@Param('id') id: string) {
    // Called via sendBeacon, no reliable headers. Verify it's a DRAFT by unguessable ID.
    const scene = await this.scenesService.getSceneById(id);
    if (!scene)
      return { success: true, message: 'Already deleted or not found' };

    if (scene.status === 'DRAFT') {
      return this.scenesService.deleteScene(id);
    }
    return { success: false, message: 'Cannot cancel a LIVE scene' };
  }
}
