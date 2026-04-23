import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
const FormData = require('form-data');

@Injectable()
export class AiService {
  private readonly aiWorkerUrl = process.env.AI_WORKER_URL || 'http://localhost:8000';

  async detectObjects(
    imageBuffer: Buffer,
    filename: string,
    allowedClasses?: string[],
    modelType: string = 'yolo',
    storeId?: string,
    sceneId?: string,
  ) {
    try {
      const formData = new FormData();
      formData.append('file', imageBuffer, { filename });
      formData.append('model_type', modelType);
      
      if (storeId) {
        formData.append('storeId', storeId);
      }
      if (sceneId) {
        formData.append('sceneId', sceneId);
      }

      if (allowedClasses !== undefined) {
        if (allowedClasses.length === 0) {
          formData.append('classes', '__EMPTY__');
        } else {
          formData.append('classes', allowedClasses.join(','));
        }
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
    } catch (error) {
      console.error('AI Service Error:', error.message);
      throw new HttpException(
        `AI Service Unavailable: ${error.message}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
