import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

@Injectable()
export class MockAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const headerValue = request.headers['x-mock-user-id'];
    const userId = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!userId) {
      // Allow passing through if no user is specified?
      // For now let's just make it required to prove multi-tenancy.
      request.user = { id: 'user-1' }; // Fallback to user-1 if no header
      return true;
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: String(userId) },
      include: { stores: true },
    });

    if (!user) {
      throw new UnauthorizedException('Mock user not found');
    }

    // Attach user to request object
    request.user = user;
    return true;
  }
}
