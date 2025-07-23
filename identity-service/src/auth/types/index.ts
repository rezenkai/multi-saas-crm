import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

// DTOs
export class LoginDto {
  @IsEmail()
  @Transform(({ value }) => value.toLowerCase())
  email: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsOptional()
  // Allow either number (TOTP) or string (backup codes) - don't transform
  twoFactorCode?: number | string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class RegisterDto {
  @IsEmail()
  @Transform(({ value }) => value.toLowerCase())
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(8)
  passwordConfirm: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;
}

// Response Types
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface LoginResponse {
  success: boolean;
  data?: TokenPair;
  error?: string;
  message?: string;
}

export interface JwtPayload {
  sub: string; // email (matching Kotlin implementation)
  email: string; // for convenience
  tenantId: string; // mapped from tenant_id
  role: string;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
  jti?: string; // JWT ID for refresh tokens
}

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  isVerified: boolean;
  isSuperuser: boolean;
  authorities: string[];
}

// Custom Exceptions
export class TwoFactorRequiredException extends Error {
  constructor(message: string = 'Two-factor authentication code required') {
    super(message);
    this.name = 'TwoFactorRequiredException';
  }
}

export class InvalidCredentialsException extends Error {
  constructor(message: string = 'Invalid credentials') {
    super(message);
    this.name = 'InvalidCredentialsException';
  }
}

export class AccountLockedException extends Error {
  constructor(message: string = 'Account is temporarily locked') {
    super(message);
    this.name = 'AccountLockedException';
  }
}

export class InvalidTokenException extends Error {
  constructor(message: string = 'Invalid or expired token') {
    super(message);
    this.name = 'InvalidTokenException';
  }
}
