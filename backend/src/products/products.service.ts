import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  private async notifyAiWorker() {
    try {
      await axios.post(process.env.AI_WORKER_URL ? `${process.env.AI_WORKER_URL}/refresh-db` : 'http://localhost:8000/refresh-db');
    } catch (e) {
      console.warn('Failed to notify AI worker:', e.message);
    }
  }

  async create(storeId: string, dto: CreateProductDto) {
    // 1. Create the product entry in DB
    const res = await this.prisma.product.create({
      data: {
        storeId,
        sceneId: dto.sceneId,
        title: dto.title,
        price: dto.price,
        description: dto.description,
        category: dto.category,
        externalLink: dto.externalLink,
      },
    });
    this.notifyAiWorker();
    return res;
  }

  async uploadImage(productId: string, fileBuffer: Buffer, filename: string, storeId: string) {  
    // 1. Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.storeId !== storeId) {
      throw new NotFoundException('You do not own this product');
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

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { mainImageUrl: fakePublicUrl },
    });
    this.notifyAiWorker();
    return updated;
  }

  async delete(id: string, storeId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.storeId !== storeId) {
      throw new NotFoundException('You do not own this product');
    }

    await this.prisma.$transaction(async (tx) => {
      // Unlink from any hotspots first to avoid foreign key constraint errors
      await tx.hotspot.updateMany({
        where: { productId: id },
        data: { productId: null },
      });
      // Now safe to delete
      await tx.product.delete({
        where: { id },
      });
    });
    this.notifyAiWorker();
    return { success: true };
  }

  async findAllGlobal() {
    return this.prisma.product.findMany();
  }

  async findAll(storeId: string, sceneId?: string) {
    if (sceneId) {
      return this.prisma.product.findMany({
        where: { 
          storeId,
          OR: [
            { sceneId: sceneId },
            { sceneId: null }
          ]
        },
      });
    }
    return this.prisma.product.findMany({
      where: { storeId, sceneId: null },
    });
  }
}
