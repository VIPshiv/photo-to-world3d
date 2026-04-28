import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
const FormData = require('form-data');

@Injectable()
export class AiService {
  private readonly aiWorkerUrl =
    process.env.AI_WORKER_URL || 'http://localhost:8000';

  // Newly Created Stateless Vector Generator!
  async generateEmbedding(
    imageBuffer: Buffer,
    filename: string,
  ): Promise<number[]> {
    try {
      const formData = new FormData();
      formData.append('file', imageBuffer, { filename });

      const response = await axios.post(`${this.aiWorkerUrl}/embed`, formData, {
        headers: { ...formData.getHeaders() },
      });

      if (!response.data || !response.data.success) {
        return [];
      }
      return response.data.embedding;
    } catch (e: any) {
      console.error('Embedding Generation failed', e.message);
      return [];
    }
  }

  async detectObjects(
    imageBuffer: Buffer,
    filename: string,
    databaseProductsAsJsonString: string,
    modelType: string = 'yolo',
    storeId?: string,
    sceneId?: string,
  ) {
    try {
      const formData = new FormData();
      formData.append('file', imageBuffer, { filename });
      formData.append('model_type', modelType);

      if (storeId) formData.append('storeId', storeId);
      if (sceneId) formData.append('sceneId', sceneId);

      // Under the Stateless framework, "classes" now literally sends the exact products as a JSON string!
      if (databaseProductsAsJsonString) {
        formData.append('classes', databaseProductsAsJsonString);
      }

      const response = await axios.post(
        `${this.aiWorkerUrl}/detect`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        },
      );

      if (response.data.success) {
        return response.data.detected_objects;
      } else {
        throw new Error(response.data.error || 'AI detection failed');
      }
    } catch (error: any) {
      console.error('AI Service Error:', error.message);
      throw new HttpException(
        `AI Service Unavailable: ${error.message}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
