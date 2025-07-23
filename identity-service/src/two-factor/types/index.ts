import { IsNumber, Max, Min } from 'class-validator';

// DTOs for Two-Factor Authentication
export class VerifyTwoFactorDto {
  @IsNumber()
  @Min(100000)
  @Max(999999)
  verificationCode: number;
}

export class DisableTwoFactorDto {
  @IsNumber()
  @Min(100000)
  @Max(999999)
  verificationCode: number;
}

export class RegenerateBackupCodesDto {
  @IsNumber()
  @Min(100000)
  @Max(999999)
  verificationCode: number;
}

// Response Types
export interface EnableTwoFactorResponse {
  secretKey: string;
  qrCodeUrl: string;
  backupCodes: string[];
  message: string;
}

export interface TwoFactorStatusResponse {
  enabled: boolean;
  verifiedAt?: string;
  hasBackupCodes: boolean;
}

export interface RegenerateBackupCodesResponse {
  backupCodes: string[];
  message: string;
}

// Internal Types
export interface TwoFactorConfig {
  issuer: string;
  window: number; // Time window for code validation (in 30-second steps)
}
