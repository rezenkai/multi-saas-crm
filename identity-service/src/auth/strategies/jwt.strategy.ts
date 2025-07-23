import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../user/user.service';
import { JwtService } from '../jwt.service';
import { TokenBlacklistService } from '../token-blacklist.service';
import { AuthUser } from '../types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly jwtService: JwtService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: true, // We need the request to get the raw token
    });
  }

  async validate(req: any, payload: any): Promise<AuthUser> {
    // Extract the raw token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid authorization header');
    }

    const token = authHeader.substring(7);

    // Check if token is blacklisted (matching Kotlin behavior)
    const isBlacklisted =
      await this.tokenBlacklistService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token is blacklisted');
    }

    // Ensure it's an access token (matching Kotlin isAccessToken check)
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Find user by email (matching Kotlin: sub is email)
    const user = await this.userService.findByEmail(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if user is active and verified (matching Kotlin UserDetails.isEnabled)
    if (!user.isActive || !user.isVerified) {
      throw new UnauthorizedException('User account is not active');
    }

    // Validate token against user (matching Kotlin isTokenValid)
    if (!this.jwtService.isTokenValid(token, user)) {
      throw new UnauthorizedException('Invalid token for user');
    }

    // Add tenant and role to request attributes (matching Kotlin filter)
    req.tenantId = payload.tenant_id || 'default-tenant';
    req.userRole = payload.role || 'user';

    // Return user info that will be attached to request.user
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      isVerified: user.isVerified,
      isSuperuser: user.isSuperuser,
      authorities: user.isSuperuser
        ? ['ROLE_ADMIN', 'ROLE_USER']
        : ['ROLE_USER'],
    };
  }
}
