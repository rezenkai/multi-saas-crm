import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import * as speakeasy from 'speakeasy';
import { UserService } from '../user/user.service';
import {
  EnableTwoFactorResponse,
  RegenerateBackupCodesResponse,
  TwoFactorConfig,
  TwoFactorStatusResponse,
} from './types';

@Injectable()
export class TwoFactorService {
  private readonly config: TwoFactorConfig;

  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {
    this.config = {
      issuer:
        this.configService.get<string>('TWO_FACTOR_ISSUER') ||
        'Identity Service',
      window: parseInt(
        this.configService.get<string>('TWO_FACTOR_WINDOW') || '2',
      ),
    };
  }

  async enableTwoFactor(userId: string): Promise<EnableTwoFactorResponse> {
    const user = await this.userService.findById(userId);

    if (user.twoFactorEnabled) {
      throw new BadRequestException(
        'Two-factor authentication is already enabled',
      );
    }

    // Generate secret key using speakeasy
    const secret = speakeasy.generateSecret({
      name: user.email,
      issuer: this.config.issuer,
      length: 32,
    });

    // Generate QR code URL
    const qrCodeUrl = await this.generateQRCode(secret.otpauth_url!);

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Save secret to user (but don't enable 2FA yet - user needs to verify first)
    await this.userService.updateTwoFactorSecret(userId, secret.base32!);
    await this.userService.updateBackupCodes(userId, backupCodes);

    return {
      secretKey: secret.base32!,
      qrCodeUrl,
      backupCodes,
      message:
        'Scan QR code with your authenticator app and verify with a code to complete setup',
    };
  }

  async verifyAndEnableTwoFactor(
    userId: string,
    verificationCode: number,
  ): Promise<{ message: string }> {
    const user = await this.userService.findById(userId);

    if (user.twoFactorEnabled) {
      throw new BadRequestException(
        'Two-factor authentication is already enabled',
      );
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException(
        'Two-factor setup not initiated. Please call /enable first.',
      );
    }

    // Verify the code
    const isValid = this.verifyTOTPCode(user.twoFactorSecret, verificationCode);
    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    // Enable 2FA for the user
    await this.userService.enableTwoFactor(
      userId,
      JSON.parse(user.backupCodes || '[]'),
    );

    return {
      message: 'Two-factor authentication enabled successfully',
    };
  }

  async disableTwoFactor(
    userId: string,
    verificationCode: number,
  ): Promise<{ message: string }> {
    const user = await this.userService.findById(userId);

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException('Two-factor secret not found');
    }

    // Verify the code or check if it's a backup code
    const isValidTOTP = this.verifyTOTPCode(
      user.twoFactorSecret,
      verificationCode,
    );
    const isValidBackupCode = await this.verifyBackupCode(
      userId,
      verificationCode.toString(),
    );

    if (!isValidTOTP && !isValidBackupCode) {
      throw new BadRequestException('Invalid verification code');
    }

    // Disable 2FA
    await this.userService.disableTwoFactor(userId);

    return {
      message: 'Two-factor authentication disabled successfully',
    };
  }

  async regenerateBackupCodes(
    userId: string,
    verificationCode: number,
  ): Promise<RegenerateBackupCodesResponse> {
    const user = await this.userService.findById(userId);

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException('Two-factor secret not found');
    }

    // Verify the code
    const isValid = this.verifyTOTPCode(user.twoFactorSecret, verificationCode);
    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    // Generate new backup codes
    const newBackupCodes = this.generateBackupCodes();
    await this.userService.updateBackupCodes(userId, newBackupCodes);

    return {
      backupCodes: newBackupCodes,
      message: 'New backup codes generated. Store them safely!',
    };
  }

  async getTwoFactorStatus(userId: string): Promise<TwoFactorStatusResponse> {
    const user = await this.userService.findById(userId);

    return {
      enabled: user.twoFactorEnabled,
      verifiedAt: user.twoFactorVerifiedAt?.toISOString(),
      hasBackupCodes: !!user.backupCodes,
    };
  }

  /**
   * Verify 2FA code during login (used by AuthService)
   */
  async verifyTwoFactorCode(
    userId: string,
    code: number | string,
  ): Promise<boolean> {
    const user = await this.userService.findById(userId);

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      console.log(`2FA not enabled or no secret for user: ${userId}`);
      return false;
    }

    console.log(
      `Verifying 2FA code for user: ${userId}, code: "${code}", type: ${typeof code}`,
    );

    // First, try as backup code (string)
    if (typeof code === 'string' && code.length > 6) {
      console.log(`Trying backup code verification for: "${code}"`);
      console.log(`User backup codes: ${user.backupCodes}`);

      const isValidBackup = await this.verifyBackupCode(
        userId,
        code.toUpperCase(),
      );
      console.log(`Backup code verification result: ${isValidBackup}`);

      if (isValidBackup) {
        return true;
      }
    }

    // Then try as TOTP code (number or numeric string)
    const numericCode = typeof code === 'number' ? code : parseInt(code);
    if (!isNaN(numericCode) && numericCode >= 100000 && numericCode <= 999999) {
      console.log(`Trying TOTP verification for code: ${numericCode}`);
      const isValidTOTP = this.verifyTOTPCode(
        user.twoFactorSecret,
        numericCode,
      );
      console.log(`TOTP verification result: ${isValidTOTP}`);

      if (isValidTOTP) {
        return true;
      }
    }

    console.log(`All 2FA verification methods failed`);
    return false;
  }

  /**
   * Generate TOTP secret key
   */
  generateSecretKey(): string {
    const secret = speakeasy.generateSecret({
      name: 'User',
      issuer: this.config.issuer,
      length: 32,
    });
    return secret.base32!;
  }

  /**
   * Generate QR code URL for manual entry
   */
  generateQRCodeUrl(
    userEmail: string,
    secretKey: string,
    issuer?: string,
  ): string {
    return speakeasy.otpauthURL({
      secret: secretKey,
      label: userEmail,
      issuer: issuer || this.config.issuer,
      algorithm: 'sha1',
      digits: 6,
      period: 30,
    });
  }

  /**
   * Verify TOTP code
   */
  verifyTOTPCode(secretKey: string, code: number): boolean {
    return speakeasy.totp.verify({
      secret: secretKey,
      encoding: 'base32',
      token: code.toString(),
      window: this.config.window, // Allow 2 time steps before/after
    });
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      // Generate 8-character alphanumeric codes
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Generate QR code as data URL
   */
  private async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      return await QRCode.toDataURL(otpauthUrl);
    } catch (error) {
      throw new BadRequestException('Failed to generate QR code');
    }
  }

  /**
   * Verify and consume backup code
   */
  private async verifyBackupCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    return await this.userService.useBackupCode(userId, code.toUpperCase());
  }
}
