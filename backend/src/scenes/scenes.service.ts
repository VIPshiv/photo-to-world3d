import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { SceneStatus, HotspotType } from '@prisma/client';
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
    const scene = await this.prisma.scene.update({
      where: { id: sceneId },
      data: { status: 'LIVE' },
    });

    await this.prisma.product.updateMany({
      where: { storeId: scene.storeId, sceneId: null },
      data: { sceneId: scene.id },
    });

    return scene;
  }

  async updateSceneStatus(sceneId: string, status: string) {
    return this.prisma.scene.update({
      where: { id: sceneId },
      data: { status: status as SceneStatus },
    });
  }

  async analyzeScene(
    storeId: string,
    file: Express.Multer.File,
    title: string,
    modelType: string,
    sceneId?: string,
  ) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

    const filename = `scene_${Date.now()}_${file.originalname}`;
    fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
    const imageUrl = `/uploads/${filename}`;

    const storeProducts = await this.prisma.product.findMany({
      where: sceneId ? { storeId, sceneId } : { storeId },
      select: { category: true, id: true, title: true, price: true, mainImageUrl: true, externalLink: true, description: true },
    });

    const allowedCategories = [
      ...new Set(storeProducts.map((p) => p.category).filter(Boolean)),
    ];

    let detectedObjects: DetectedObject[] = [];
    try {
      detectedObjects = (await this.aiService.detectObjects(
        file.buffer,
        file.originalname,
        allowedCategories as string[],
        modelType,
        storeId,
        sceneId
      )) as unknown as DetectedObject[];
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('AI Detection failed', msg);
    }

    const hotspots = detectedObjects.map((obj) => {
      let product = obj.product && obj.product.id 
        ? storeProducts.find((p) => p.id === obj.product!.id) 
        : undefined;

      if (!product) {
        product = storeProducts.find(
          (p) =>
            p.category?.toLowerCase() === obj.label.toLowerCase() ||
            p.title.toLowerCase().includes(obj.label.toLowerCase()),
        );
      }

      const yaw = obj.center.x * 360;
      const pitch = (1 - obj.center.y) * 180 - 90;

      return {
        productId: product ? product.id : null,
        yaw: yaw,
        pitch: pitch,
        label: product ? product.title : obj.label,
        type: HotspotType.PRODUCT,
        box: obj.box, // keep bounding box for plotting
        product: product ? {
          id: product.id,
          title: product.title,
          price: product.price,
          mainImageUrl: product.mainImageUrl,
          description: product.description,
          externalLink: product.externalLink
        } : undefined
      };
    }).filter(Boolean);

    return {
      success: true,
      imageUrl,
      hotspots,
      message: `Scanned with ${modelType}`,
    };
  }

  async analyzeExistingScene(
    storeId: string,
    imageUrl: string,
    modelType: string,
    sceneId?: string,
  ) {
    const filePath = path.join(process.cwd(), imageUrl.replace(/^\//, ''));
    if (!fs.existsSync(filePath)) throw new Error('Image file not found on server');
    
    const buffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);

    const storeProducts = await this.prisma.product.findMany({
      where: sceneId ? { storeId, sceneId } : { storeId },
      select: { category: true, id: true, title: true, price: true, mainImageUrl: true, externalLink: true, description: true },
    });

    const allowedCategories = [
      ...new Set(storeProducts.map((p) => p.category).filter(Boolean)),
    ];

    let detectedObjects: DetectedObject[] = [];
    try {
      detectedObjects = (await this.aiService.detectObjects(
        buffer,
        filename,
        allowedCategories as string[],
        modelType,
        storeId,
        sceneId
      )) as unknown as DetectedObject[];
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`AI Detection failed for ${modelType}`, msg);
    }

    const hotspots = detectedObjects.map((obj) => {
      let product = obj.product && obj.product.id 
        ? storeProducts.find((p) => p.id === obj.product!.id) 
        : undefined;

      if (!product) {
        product = storeProducts.find(
          (p) =>
            p.category?.toLowerCase() === obj.label.toLowerCase() ||
            p.title.toLowerCase().includes(obj.label.toLowerCase()),
        );
      }

      const yaw = obj.center.x * 360;
      const pitch = (1 - obj.center.y) * 180 - 90;

      return {
        productId: product ? product.id : null,
        yaw: yaw,
        pitch: pitch,
        label: product ? product.title : obj.label,
        type: HotspotType.PRODUCT,
        box: obj.box,
        product: product ? {
          id: product.id,
          title: product.title,
          price: product.price,
          mainImageUrl: product.mainImageUrl,
          description: product.description,
          externalLink: product.externalLink
        } : undefined
      };
    }).filter(Boolean);

    return {
      success: true,
      imageUrl,
      hotspots,
      message: `Scanned with ${modelType.toUpperCase()}`,
    };
  }

  async createSceneWithHotspots(storeId: string, title: string, imageUrl: string, hotspots: any[], status: string = 'LIVE', modelType: string = 'yolo') {
    const scene = await this.prisma.scene.create({
      data: {
        storeId,
        title: title || 'Untitled Scene',
        imageUrl: imageUrl,
        status: status as SceneStatus,
        modelType: modelType,
      },
    });

    if (hotspots && hotspots.length > 0) {
      await this.prisma.hotspot.createMany({
        data: hotspots.map((h) => ({
          sceneId: scene.id,
          productId: h.productId,
          yaw: h.yaw,
          pitch: h.pitch,
          label: h.label,
          type: HotspotType.PRODUCT,
        })),
      });
    }

      if (status === 'LIVE') {
        await this.prisma.product.updateMany({
          where: { storeId, sceneId: null },
          data: { sceneId: scene.id },
        });
      }

      return { success: true, sceneId: scene.id };
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
        'yolo', // Added explicit default yolo
        storeId,
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

  async replaceLiveWithDraft(liveId: string, draftId: string) {
    const draft = await this.prisma.scene.findUnique({
      where: { id: draftId },
      include: { hotspots: true }
    });
    if (!draft) throw new Error('Draft not found');

    await this.prisma.hotspot.deleteMany({
      where: { sceneId: liveId }
    });

    await this.prisma.scene.update({
      where: { id: liveId },
      data: {
        modelType: draft.modelType,
        title: draft.title
      }
    });

    if (draft.hotspots.length > 0) {
      await this.prisma.hotspot.createMany({
        data: draft.hotspots.map(h => ({
          sceneId: liveId,
          productId: h.productId,
          yaw: h.yaw,
          pitch: h.pitch,
          label: h.label,
          type: HotspotType.PRODUCT
        }))
      });
    }

    await this.prisma.product.updateMany({
      where: { sceneId: draftId },
      data: { sceneId: liveId }
    });

    await this.prisma.hotspot.deleteMany({
      where: { sceneId: draftId }
    });

    await this.prisma.scene.delete({
      where: { id: draftId }
    });

    return { success: true };
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

  async updateScene(id: string, data: { title?: string, imageUrl?: string, hotspots?: any[], status?: string, modelType?: string }) {
    await this.prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.modelType !== undefined) updateData.modelType = data.modelType;

      await tx.scene.update({
        where: { id },
        data: updateData,
      });

      if (data.hotspots) {
        await tx.hotspot.deleteMany({ where: { sceneId: id } });
        if (data.hotspots.length > 0) {
          await tx.hotspot.createMany({
            data: data.hotspots.map((h) => ({
              sceneId: id,
              productId: h.productId,
              yaw: h.yaw,
              pitch: h.pitch,
              label: h.label,
              type: 'PRODUCT',
            })),
          });
        }
      }

        if (data.status === 'LIVE') {
          const sceneToUpdate = await tx.scene.findUnique({ where: { id } });
          if (sceneToUpdate) {
            await tx.product.updateMany({
              where: { storeId: sceneToUpdate.storeId, sceneId: null },
              data: { sceneId: id },
            });
          }
        }
    });
    return { success: true };
  }

  async deleteScene(id: string) {
    await this.prisma.$transaction(async (tx) => {
      // 1. Reset products that are linked to this scene
      await tx.product.updateMany({
        where: { sceneId: id },
        data: { sceneId: null },
      });

      // 2. Delete all hotspots inside this scene
      await tx.hotspot.deleteMany({
        where: { sceneId: id },
      });

      // 3. Delete the scene itself
      await tx.scene.delete({
        where: { id },
      });
    });

    return { success: true };
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
        '[Stitch Service] Mode: CUBEMAP -> Using cubemap.py',
      );
      scriptPath = path.join(
        process.cwd(),
        '..',
        'model',
        'techniques',
        'cubemap.py',
      );
      // Prototype script takes input DIRECTORY
      command = `python "${scriptPath}" "${sessionDir}" --out "${outputPath}"`;
    } else {
      console.log('[Stitch Service] Mode: GUIDED -> Using guided_feature.py');
      scriptPath = path.join(
        process.cwd(),
        '..',
        'model',
        'techniques',
        'guided_feature.py',
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
