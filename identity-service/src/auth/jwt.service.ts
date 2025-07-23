import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { User } from '../user/entity/user.entity';
import { InvalidTokenException, JwtPayload, TokenPair } from './types';

@Injectable()
export class JwtService {
  constructor(
    private readonly nestJwtService: NestJwtService,
    private readonly configService: ConfigService,
  ) {}

  generateAccessToken(user: User, tenantId: string, role: string): string {
    const claims = {
      sub: user.email, // Using email as subject, matching Kotlin
      tenant_id: tenantId, // Snake case to match Kotlin
      role: role,
      type: 'access',
    };

    return this.nestJwtService.sign(claims, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '15m',
    });
  }

  generateRefreshToken(user: User, tenantId: string, role: string): string {
    const claims = {
      sub: user.email, // Using email as subject, matching Kotlin
      tenant_id: tenantId, // Snake case to match Kotlin
      role: role,
      type: 'refresh',
      jti: this.generateUUID(), // Adding JTI like Kotlin version
    };

    return this.nestJwtService.sign(claims, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn:
        this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
    });
  }

  generateTokenPair(
    user: User,
    tenantId: string = 'default-tenant',
    role?: string,
  ): TokenPair {
    const userRole = role || (user.isSuperuser ? 'admin' : 'user');

    const accessToken = this.generateAccessToken(user, tenantId, userRole);
    const refreshToken = this.generateRefreshToken(user, tenantId, userRole);

    return {
      accessToken,
      refreshToken,
      tokenType: 'bearer', // Lowercase to match Kotlin
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  extractUsername(token: string): string {
    try {
      const payload = this.verifyToken(token);
      return payload.sub;
    } catch (error) {
      throw new InvalidTokenException('Cannot extract username from token');
    }
  }

  extractTenantId(token: string): string {
    try {
      const payload = this.verifyToken(token);
      return payload.tenant_id || 'default-tenant';
    } catch (error) {
      throw new InvalidTokenException('Cannot extract tenant ID from token');
    }
  }

  extractRole(token: string): string {
    try {
      const payload = this.verifyToken(token);
      return payload.role || 'user';
    } catch (error) {
      throw new InvalidTokenException('Cannot extract role from token');
    }
  }

  extractTokenType(token: string): string {
    try {
      const payload = this.verifyToken(token);
      return payload.type;
    } catch (error) {
      throw new InvalidTokenException('Cannot extract token type');
    }
  }

  isTokenValid(token: string, user: User): boolean {
    try {
      const username = this.extractUsername(token);
      const isExpired = this.isTokenExpired(token);
      return username === user.email && !isExpired;
    } catch {
      return false;
    }
  }

  isAccessToken(token: string): boolean {
    try {
      return this.extractTokenType(token) === 'access';
    } catch {
      return false;
    }
  }

  isRefreshToken(token: string): boolean {
    try {
      return this.extractTokenType(token) === 'refresh';
    } catch {
      return false;
    }
  }

  isRefreshTokenValid(token: string, user: User): boolean {
    try {
      const payload = this.verifyRefreshToken(token);
      return payload.sub === user.email && !this.isTokenExpired(token);
    } catch {
      return false;
    }
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      const payload = this.nestJwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      }) as any;

      if (payload.type !== 'access') {
        throw new InvalidTokenException('Invalid token type');
      }

      // Convert to our JwtPayload format
      return {
        sub: payload.sub,
        email: payload.sub, // In Kotlin, sub is the email
        tenantId: payload.tenant_id,
        role: payload.role,
        iat: payload.iat,
        exp: payload.exp,
        type: payload.type,
      };
    } catch (error) {
      throw new InvalidTokenException('Invalid or expired access token');
    }
  }

  verifyRefreshToken(token: string): JwtPayload {
    try {
      const payload = this.nestJwtService.verify(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      }) as any;

      if (payload.type !== 'refresh') {
        throw new InvalidTokenException('Invalid token type');
      }

      // Convert to our JwtPayload format
      return {
        sub: payload.sub,
        email: payload.sub, // In Kotlin, sub is the email
        tenantId: payload.tenant_id || 'default-tenant', // Map from tenant_id
        role: payload.role || 'user',
        iat: payload.iat,
        exp: payload.exp,
        type: payload.type,
        jti: payload.jti,
      };
    } catch (error) {
      throw new InvalidTokenException('Invalid or expired refresh token');
    }
  }

  private verifyToken(token: string): any {
    try {
      // Try access token first
      return this.nestJwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      try {
        // Try refresh token
        return this.nestJwtService.verify(token, {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        });
      } catch (error) {
        throw new InvalidTokenException('Invalid token');
      }
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = this.verifyToken(token);
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch {
      return true;
    }
  }

  getExpiration(token: string): Date {
    try {
      const payload = this.verifyToken(token);
      return new Date(payload.exp * 1000);
    } catch (error) {
      throw new InvalidTokenException('Cannot extract expiration from token');
    }
  }

  extractTokenFromHeader(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new InvalidTokenException('Invalid authorization header format');
    }
    return authHeader.substring(7);
  }

  private generateUUID(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  getRolePermissions(role: string): string[] {
    switch (role) {
      case 'admin':
        return [
          'read:all',
          'write:all',
          'delete:all',
          'manage:users',
          'manage:settings',
        ];
      case 'manager':
        return [
          'read:contacts',
          'write:contacts',
          'read:companies',
          'write:companies',
          'read:deals',
          'write:deals',
        ];
      case 'user':
        return [
          'read:contacts',
          'write:contacts:own',
          'read:companies',
          'read:deals',
          'write:deals:own',
        ];
      default:
        return [];
    }
  }
}
