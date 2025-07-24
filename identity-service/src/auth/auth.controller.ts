import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  AccountLockedException,
  AuthUser,
  InvalidCredentialsException,
  LoginDto,
  LoginResponse,
  RefreshTokenDto,
  RegisterDto,
  TwoFactorRequiredException,
} from './types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    try {
      const tokenPair = await this.authService.login(loginDto);

      return {
        success: true,
        data: tokenPair,
      };
    } catch (error) {
      if (error instanceof TwoFactorRequiredException) {
        return {
          success: false,
          error: '2FA_REQUIRED',
          message: error.message,
        };
      }

      if (
        error instanceof InvalidCredentialsException ||
        error instanceof AccountLockedException
      ) {
        throw new UnauthorizedException(error.message);
      }

      throw new UnauthorizedException('Login failed');
    }
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    try {
      const result = await this.authService.register(registerDto);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Registration failed');
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    try {
      const tokenPair = await this.authService.refreshToken(refreshTokenDto);

      return {
        success: true,
        data: tokenPair,
      };
    } catch (error) {
      throw new UnauthorizedException('Failed to refresh token');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getCurrentUser(@Request() req: any) {
    const authUser: AuthUser = req.user;

    try {
      const user = await this.authService.getCurrentUser(authUser.id);

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      throw new UnauthorizedException('Failed to get current user');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: any) {
    const authUser: AuthUser = req.user;

    try {
      const result = await this.authService.logout(authUser.id);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      throw new BadRequestException('Logout failed');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: any,
    @Body()
    body: {
      currentPassword: string;
      newPassword: string;
      newPasswordConfirm: string;
    },
  ) {
    const authUser: AuthUser = req.user;
    const { currentPassword, newPassword, newPasswordConfirm } = body;

    try {
      await this.authService.changePassword(
        authUser.id,
        currentPassword,
        newPassword,
        newPasswordConfirm,
      );

      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to change password');
    }
  }
}
