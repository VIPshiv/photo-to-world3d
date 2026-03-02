import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { HotspotType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

interface DetectedObject {
  label: string;
  confidence: number;
  box: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  center: {
    x: number;
    y: number;
  };
  product?: {
    id: string;
  };
}

@Injectable()
export class ScenesService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async processScene(
    storeId: string,
    file: Express.Multer.File,
    title: string,
  ) {
    // 1. SAVE FILE (Simulating S3)
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

    const filename = `scene_${Date.now()}_${file.originalname}`;
    fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
    const imageUrl = `/uploads/${filename}`;

    // 2. FETCH STORE INVENTORY (The "Future Automatic" Logic)
    // We get all products for this store to find their CATEGORIES.
    // e.g. ["shoe", "bag"]
    const storeProducts = await this.prisma.product.findMany({
      where: { storeId },
      select: { category: true, id: true, title: true },
    });

    // Make a unique list of categories to tell AI what to look for
    // e.g. Set("shoe", "bag") -> ["shoe", "bag"]
    const allowedCategories = [
      ...new Set(storeProducts.map((p) => p.category).filter(Boolean)),
    ];

    console.log(
      `[Auto-AI] Scanning for categories: ${allowedCategories.join(', ')}`,
    );

    // 3. RUN AI DETECTION
    // This is the Magic Step.
    let detectedObjects: DetectedObject[] = [];
    try {
      detectedObjects = (await this.aiService.detectObjects(
        file.buffer,
        file.originalname,
        allowedCategories as string[],
      )) as unknown as DetectedObject[];
    } catch (e: unknown) {
      // Safely handle unknown error type
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        'AI Detection skipped or failed (Continuing upload anyway)',
        msg,
      );
    }

    // 4. SAVE SCENE TO DB
    const scene = await this.prisma.scene.create({
      data: {
        storeId,
        title: title || 'Untitled Scene',
        imageUrl: imageUrl,
      },
    });

    // 5. AUTO-CREATE HOTSPOTS
    if (detectedObjects.length > 0) {
      const hotspotsData = detectedObjects
        .map((obj) => {
          // 1. Trust the AI Link first (if Python CLIP found a match)
          let product: typeof storeProducts[0] | undefined;
          if (obj.product && obj.product.id) {
             product = storeProducts.find(p => p.id === obj.product!.id);
          }

          // 2. Fallback: Try name match (only if AI didn't provide a specific link)
          if (!product) {
              product = storeProducts.find((p) => 
                p.category?.toLowerCase() === obj.label.toLowerCase() || 
                p.title.toLowerCase().includes(obj.label.toLowerCase())
            );
          }

          // Convert normalized Center X/Y (0-1) to Yaw/Pitch (Degrees)
          // X: 0..1 -> 0..360 (Yaw) - Adjusted to fix "Opposite Direction"
          // Y: 0..1 -> 90..-90 (Pitch)
          const yaw = obj.center.x * 360;
          const pitch = (1 - obj.center.y) * 180 - 90;

          return {
            sceneId: scene.id,
            productId: product ? product.id : null,
            // Use Positive Yaw (Left-to-Right mapping)
            yaw: yaw,
            pitch: pitch,
            label: product ? product.title : obj.label,
            type: HotspotType.PRODUCT,
          } as const;
        })
        .filter((h): h is NonNullable<typeof h> => h !== null);

      // Bulk Insert Hotspots
      if (hotspotsData.length > 0) {
        await this.prisma.hotspot.createMany({
          data: hotspotsData.map((h) => ({
            ...h,
            type: HotspotType.PRODUCT, // Ensure enum matching
          })),
        });
      }

      console.log(
        `[Auto-AI] Created ${hotspotsData.length} hotspots automatically.`,
      );
    }

    return {
      success: true,
      sceneId: scene.id,
      hotspotCount: detectedObjects.length,
      message: 'Scene uploaded and AI processed.',
    };
  }

  async getSceneById(id: string) {
    return this.prisma.scene.findUnique({
      where: { id },
      include: {
        hotspots: {
          include: { product: true },
        },
      },
    });
  }
}
