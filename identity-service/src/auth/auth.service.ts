import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { TwoFactorService } from '../two-factor/two-factor.service';
import { UserService } from '../user/user.service';
import { JwtService } from './jwt.service';
import {
  AccountLockedException,
  AuthUser,
  InvalidCredentialsException,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  TokenPair,
  TwoFactorRequiredException,
} from './types';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  async login(loginDto: LoginDto): Promise<TokenPair> {
    const { email, password, twoFactorCode, tenantId } = loginDto;

    try {
      console.log(`Login attempt for email: ${email}`);

      // Step 1: Find and validate user
      const user = await this.userService.findActiveByEmail(email);
      if (!user) {
        console.log(`User not found for email: ${email}`);
        throw new InvalidCredentialsException('Invalid email or password');
      }

      console.log(
        `User found: ${user.email}, isActive: ${user.isActive}, isVerified: ${user.isVerified}`,
      );

      // Step 2: Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        console.log(`Account locked until: ${user.lockedUntil}`);
        throw new AccountLockedException('Account is temporarily locked');
      }

      // Step 3: Verify password
      console.log(`Verifying password for user: ${user.email}`);
      const isPasswordValid = await bcrypt.compare(
        password,
        user.hashedPassword,
      );
      console.log(`Password valid: ${isPasswordValid}`);

      if (!isPasswordValid) {
        console.log(`Invalid password for user: ${email}`);
        // Increment failed login attempts
        await this.userService.incrementFailedLoginAttempts(user.id);
        throw new InvalidCredentialsException('Invalid email or password');
      }

      // Step 4: Check 2FA if enabled
      if (user.twoFactorEnabled) {
        console.log(`2FA enabled for user: ${email}`);
        if (!twoFactorCode) {
          throw new TwoFactorRequiredException(
            'Two-factor authentication code required',
          );
        }

        // Verify 2FA code using TwoFactorService
        console.log(
          `Raw 2FA code received: ${twoFactorCode}, type: ${typeof twoFactorCode}`,
        );

        // Pass the code as-is to TwoFactorService
        const isValid2FA = await this.twoFactorService.verifyTwoFactorCode(
          user.id,
          twoFactorCode,
        );
        if (!isValid2FA) {
          console.log(`Invalid 2FA code for user: ${email}`);
          throw new InvalidCredentialsException(
            'Invalid two-factor authentication code',
          );
        }

        console.log(`2FA verification successful for user: ${email}`);
      }

      // Step 5: Reset failed login attempts and update last login
      await this.userService.resetFailedLoginAttempts(user.id);

      // Step 6: Generate and return tokens
      const resolvedTenantId = tenantId || 'default-tenant';
      const role = user.isSuperuser ? 'admin' : 'user';

      console.log(
        `Generating tokens for user: ${email}, tenant: ${resolvedTenantId}, role: ${role}`,
      );

      const tokenPair = this.jwtService.generateTokenPair(
        user,
        resolvedTenantId,
        role,
      );
      console.log(`Login successful for user: ${email}`);

      return tokenPair;
    } catch (error) {
      console.error(`Login error for ${email}:`, error.message);

      if (
        error instanceof TwoFactorRequiredException ||
        error instanceof InvalidCredentialsException ||
        error instanceof AccountLockedException
      ) {
        throw error;
      }

      console.error(`Unexpected login error:`, error);
      throw new UnauthorizedException('Login failed');
    }
  }

  async register(
    registerDto: RegisterDto,
  ): Promise<{ message: string; userId: string; email: string }> {
    const { email, password, passwordConfirm, firstName, lastName } =
      registerDto;

    try {
      console.log(`Registration attempt for email: ${email}`);

      // Validate password confirmation
      if (password !== passwordConfirm) {
        console.log('Password confirmation mismatch');
        throw new BadRequestException('Passwords do not match');
      }

      // Validate password strength
      console.log('Validating password strength...');
      this.validatePasswordStrength(password);

      // Check if user already exists
      console.log(`Checking if user exists: ${email}`);
      const existingUser = await this.userService.findByEmail(email);
      if (existingUser) {
        console.log(`User already exists: ${email}`);
        throw new BadRequestException(
          `User with email ${email} already exists`,
        );
      }

      // Create user using UserService
      console.log(`Creating user: ${email}`);
      const user = await this.userService.create({
        email,
        password, // UserService will handle hashing
        firstName,
        lastName,
      });

      console.log(
        `User created successfully: ${user.email} with ID: ${user.id}`,
      );

      return {
        message: 'Registration successful. You can now log in.',
        userId: user.id,
        email: user.email,
      };
    } catch (error) {
      console.error(`Registration error for ${email}:`, error.message);

      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error(`Unexpected registration error:`, error);
      throw new BadRequestException('Registration failed');
    }
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<TokenPair> {
    const { refreshToken } = refreshTokenDto;

    try {
      console.log(
        `Refresh token attempt with token: ${refreshToken.substring(0, 20)}...`,
      );

      // Verify refresh token
      const payload = this.jwtService.verifyRefreshToken(refreshToken);
      console.log(`Token payload:`, {
        sub: payload.sub,
        tenantId: payload.tenantId,
        role: payload.role,
        type: payload.type,
      });

      // Find user by email (since sub contains email in our implementation)
      const user = await this.userService.findByEmail(payload.sub);
      if (!user) {
        console.log(`User not found for email: ${payload.sub}`);
        throw new UnauthorizedException('User not found');
      }

      if (!user.isActive) {
        console.log(`User is not active: ${payload.sub}`);
        throw new UnauthorizedException('User not found or inactive');
      }

      console.log(`User found: ${user.email}, isActive: ${user.isActive}`);

      // Validate refresh token against user
      if (!this.jwtService.isRefreshTokenValid(refreshToken, user)) {
        console.log(`Invalid refresh token for user: ${user.email}`);
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new token pair
      console.log(
        `Generating new token pair for user: ${user.email}, tenant: ${payload.tenantId}, role: ${payload.role}`,
      );
      const newTokenPair = this.jwtService.generateTokenPair(
        user,
        payload.tenantId,
        payload.role,
      );

      console.log(`Refresh successful for user: ${user.email}`);
      return newTokenPair;
    } catch (error) {
      console.error(`Refresh token error:`, error.message);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      console.error(`Unexpected refresh error:`, error);
      throw new UnauthorizedException('Failed to refresh token');
    }
  }

  async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

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

  async logout(userId: string): Promise<{ message: string }> {
    // TODO: Implement token blacklisting with Redis
    // For now, we'll just return a success message
    // The client should discard the tokens
    console.log(`User ${userId} logged out`);

    return {
      message: 'Logged out successfully',
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    newPasswordConfirm: string,
  ): Promise<void> {
    // Delegate to UserService
    await this.userService.changePassword(userId, {
      currentPassword,
      newPassword,
      newPasswordConfirm,
    });
  }

  validatePasswordStrength(password: string): void {
    const minLength = 8;
    if (password.length < minLength) {
      throw new BadRequestException(
        `Password must be at least ${minLength} characters long`,
      );
    }
    if (!password.match(/\d/)) {
      throw new BadRequestException('Password must contain at least one digit');
    }
    if (!password.match(/[A-Z]/)) {
      throw new BadRequestException(
        'Password must contain at least one uppercase letter',
      );
    }
    if (!password.match(/[a-z]/)) {
      throw new BadRequestException(
        'Password must contain at least one lowercase letter',
      );
    }
    if (!password.match(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/)) {
      throw new BadRequestException(
        'Password must contain at least one special character',
      );
    }
  }
}
