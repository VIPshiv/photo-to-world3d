import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(storeId: string, dto: CreateProductDto) {
    // 1. Create the product entry in DB
    return this.prisma.product.create({
      data: {
        storeId,
        title: dto.title,
        price: dto.price,
        description: dto.description,
        category: dto.category,
      },
    });
  }

  async uploadImage(productId: string, fileBuffer: Buffer, filename: string) {
    // 1. Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // 2. FAKE CLOUD UPLOAD (For Demo)
    // In production, we send to S3/Cloudinary here.
    // For now, we save to a local 'uploads' folder so it works instantly.
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }

    // Create unique name
    const ext = path.extname(filename);
    const uniqueName = `prod_${productId}_${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, uniqueName);

    fs.writeFileSync(filePath, fileBuffer);

    // 3. Update DB with the URL
    // In real app: https://s3.aws.com/bucket/uniqueName
    const fakePublicUrl = `/uploads/${uniqueName}`;

    return this.prisma.product.update({
      where: { id: productId },
      data: { mainImageUrl: fakePublicUrl },
    });
  }

  async delete(id: string) {
    return this.prisma.product.delete({
      where: { id },
    });
  }

  async findAll(storeId: string) {
    return this.prisma.product.findMany({
      where: { storeId },
    });
  }
}
