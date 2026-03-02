import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
const FormData = require('form-data');

@Injectable()
export class AiService {
  private readonly aiWorkerUrl = 'http://localhost:8000'; // Config this in env later

  async detectObjects(imageBuffer: Buffer, filename: string, allowedClasses?: string[]) {
    try {
      const formData = new FormData();
      formData.append('file', imageBuffer, { filename });

      if (allowedClasses && allowedClasses.length > 0) {
        formData.append('classes', allowedClasses.join(','));
      }

      const response = await axios.post(`${this.aiWorkerUrl}/detect`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

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
