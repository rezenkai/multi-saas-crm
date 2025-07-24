import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/types';
import { TwoFactorService } from './two-factor.service';
import {
  DisableTwoFactorDto,
  EnableTwoFactorResponse,
  RegenerateBackupCodesDto,
  RegenerateBackupCodesResponse,
  TwoFactorStatusResponse,
  VerifyTwoFactorDto,
} from './types';

@Controller('auth/2fa')
@UseGuards(JwtAuthGuard) // All 2FA endpoints require authentication
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  async enableTwoFactor(
    @Request() req: any,
  ): Promise<{ success: boolean; data: EnableTwoFactorResponse }> {
    try {
      const authUser: AuthUser = req.user;
      const result = await this.twoFactorService.enableTwoFactor(authUser.id);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to enable 2FA');
    }
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyAndEnableTwoFactor(
    @Request() req: any,
    @Body() verifyDto: VerifyTwoFactorDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const authUser: AuthUser = req.user;
      const result = await this.twoFactorService.verifyAndEnableTwoFactor(
        authUser.id,
        verifyDto.verificationCode,
      );

      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to verify 2FA');
    }
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  async disableTwoFactor(
    @Request() req: any,
    @Body() disableDto: DisableTwoFactorDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const authUser: AuthUser = req.user;
      const result = await this.twoFactorService.disableTwoFactor(
        authUser.id,
        disableDto.verificationCode,
      );

      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to disable 2FA');
    }
  }

  @Post('regenerate-backup-codes')
  @HttpCode(HttpStatus.OK)
  async regenerateBackupCodes(
    @Request() req: any,
    @Body() regenerateDto: RegenerateBackupCodesDto,
  ): Promise<{ success: boolean; data: RegenerateBackupCodesResponse }> {
    try {
      const authUser: AuthUser = req.user;
      const result = await this.twoFactorService.regenerateBackupCodes(
        authUser.id,
        regenerateDto.verificationCode,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to regenerate backup codes');
    }
  }

  @Get('status')
  async getTwoFactorStatus(
    @Request() req: any,
  ): Promise<{ success: boolean; data: TwoFactorStatusResponse }> {
    try {
      const authUser: AuthUser = req.user;
      const result = await this.twoFactorService.getTwoFactorStatus(
        authUser.id,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new BadRequestException('Failed to get 2FA status');
    }
  }
}
