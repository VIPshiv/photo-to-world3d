import {
  Controller,
  Post,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  Get,
  Delete,
  ParseFilePipeBuilder,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('products')
@UseGuards(MockAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() createProductDto: CreateProductDto) {
    const tenantStoreId =
      user?.stores && user.stores.length > 0 ? user.stores[0].id : null;
    if (!tenantStoreId)
      throw new BadRequestException('No store found for user');
    return this.productsService.create(tenantStoreId, createProductDto);
  }

  @Post(':id/image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png)$/,
        })
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024, // 5MB limit
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ) {
    const tenantStoreId = user?.stores && user.stores.length > 0 ? user.stores[0].id : null;
    if (!tenantStoreId) throw new BadRequestException('No store associated with this user');

    return this.productsService.uploadImage(id, file.buffer, file.originalname, tenantStoreId);
  }

  @Get('all')
  findAllGlobal() {
    return this.productsService.findAllGlobal();
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query('sceneId') sceneId?: string) {
    const tenantStoreId =
      user?.stores && user.stores.length > 0 ? user.stores[0].id : null;
    if (!tenantStoreId) return [];
    return this.productsService.findAll(tenantStoreId, sceneId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    const tenantStoreId = user?.stores && user.stores.length > 0 ? user.stores[0].id : null;
    if (!tenantStoreId) throw new BadRequestException('No store associated with this user');

    return this.productsService.delete(id, tenantStoreId);
  }
}
