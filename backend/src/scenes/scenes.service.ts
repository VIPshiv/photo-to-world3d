import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { HotspotType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import * as util from 'util';

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

  async getScenesByStoreId(storeId: string) {
    return this.prisma.scene.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      include: {
        hotspots: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async finalizeScene(sceneId: string) {
    return this.prisma.scene.update({
      where: { id: sceneId },
      data: { status: 'LIVE' },
    });
  }

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
          let product: (typeof storeProducts)[0] | undefined;
          if (obj.product && obj.product.id) {
            product = storeProducts.find((p) => p.id === obj.product!.id);
          }

          // 2. Fallback: Try name match (only if AI didn't provide a specific link)
          if (!product) {
            product = storeProducts.find(
              (p) =>
                p.category?.toLowerCase() === obj.label.toLowerCase() ||
                p.title.toLowerCase().includes(obj.label.toLowerCase()),
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

  async stitchScene(
    files: Express.Multer.File[],
    mode: string = 'guided',
  ): Promise<string> {
    const execPromise = util.promisify(exec);

    const sessionDir = path.join(
      process.cwd(),
      'uploads',
      `stitch_${Date.now()}`,
    );
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const filePaths: string[] = [];
    const outputFilename = `pano_${Date.now()}.jpg`;
    const outputPath = path.join(process.cwd(), 'uploads', outputFilename);

    // SAVE FILES TO DISK
    for (let i = 0; i < files.length; i++) {
      let filename: string;

      if (mode === 'cubemap') {
        // Use the fieldname (front, back, left, right, top, bottom)
        // Fallback to index if fieldname is obscure
        const name = files[i].fieldname || `face_${i}`;
        filename = `${name}.jpg`;
      } else {
        // Guide/Feature mode just needs generic names
        filename = `img_${i}.jpg`;
      }

      const filePath = path.join(sessionDir, filename);
      fs.writeFileSync(filePath, files[i].buffer);
      filePaths.push(filePath);
    }

    // SELECT SCRIPT BASED ON MODE
    let scriptPath: string;
    let command: string;

    if (mode === 'cubemap') {
      console.log(
        '[Stitch Service] Mode: CUBEMAP -> Using stitch_prototype.py',
      );
      scriptPath = path.join(
        process.cwd(),
        '..',
        'model',
        'experimental',
        'stitch_prototype.py',
      );
      // Prototype script takes input DIRECTORY
      command = `python "${scriptPath}" "${sessionDir}" --out "${outputPath}"`;
    } else {
      console.log('[Stitch Service] Mode: GUIDED -> Using stitch_feature.py');
      scriptPath = path.join(
        process.cwd(),
        '..',
        'model',
        'experimental',
        'stitch_feature.py',
      );
      // Feature script takes list of FILES
      const args = `"${filePaths.join('" "')}"`;
      command = `python "${scriptPath}" ${args} --out "${outputPath}"`;
    }

    try {
      console.log(`[Stitch Service] Executing: ${command}`);
      const { stdout, stderr } = await execPromise(command);
      console.log('[Stitch Output]', stdout);
      if (stderr) console.error('[Stitch Error]', stderr);

      // Ensure successful output exists
      if (!fs.existsSync(outputPath)) {
        throw new Error('Python script completed but output file not found');
      }

      // Clean up the temp images
      fs.rmSync(sessionDir, { recursive: true, force: true });

      // Return the static asset URL path
      return `/uploads/${outputFilename}`;
    } catch (e) {
      console.error('[Stitch Failure]', e);
      throw new Error('Stitching failed in backend.');
    }
  }
}
