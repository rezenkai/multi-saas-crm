import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseInterceptors,
} from '@nestjs/common';
import { ChangePasswordDto, CreateUserDto, UpdateUserDto } from './dto';
import { User } from './entity/user.entity';
import { UserService } from './user.service';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // We'll create this later

@Controller('users')
@UseInterceptors(ClassSerializerInterceptor) // This will exclude @Exclude() fields
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createUserDto: CreateUserDto,
  ): Promise<{ success: boolean; data: User; message: string }> {
    const user = await this.userService.create(createUserDto);
    return {
      success: true,
      data: user,
      message: 'User created successfully',
    };
  }

  @Get()
  // @UseGuards(JwtAuthGuard) // Uncomment when we have auth guards
  async findAll(): Promise<{ success: boolean; data: User[] }> {
    const users = await this.userService.findAll();
    return {
      success: true,
      data: users,
    };
  }

  @Get('me')
  // @UseGuards(JwtAuthGuard)
  async getProfile(
    @Request() req: any,
  ): Promise<{ success: boolean; data: User }> {
    // For now, we'll use a placeholder. Later this will come from JWT
    const userId = req.user?.id || 'placeholder-id';
    const user = await this.userService.findById(userId);
    return {
      success: true,
      data: user,
    };
  }

  @Get(':id')
  // @UseGuards(JwtAuthGuard)
  async findOne(
    @Param('id') id: string,
  ): Promise<{ success: boolean; data: User }> {
    const user = await this.userService.findById(id);
    return {
      success: true,
      data: user,
    };
  }

  @Patch('me')
  // @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Request() req: any,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<{ success: boolean; data: User; message: string }> {
    // For now, we'll use a placeholder. Later this will come from JWT
    const userId = req.user?.id || 'placeholder-id';
    const user = await this.userService.update(userId, updateUserDto);
    return {
      success: true,
      data: user,
      message: 'Profile updated successfully',
    };
  }

  @Patch(':id')
  // @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<{ success: boolean; data: User; message: string }> {
    const user = await this.userService.update(id, updateUserDto);
    return {
      success: true,
      data: user,
      message: 'User updated successfully',
    };
  }

  @Post('change-password')
  // @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    // For now, we'll use a placeholder. Later this will come from JWT
    const userId = req.user?.id || 'placeholder-id';
    await this.userService.changePassword(userId, changePasswordDto);
    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  @Get('check-email/:email')
  async checkEmailAvailability(@Param('email') email: string): Promise<{
    success: boolean;
    data: { email: string; available: boolean };
  }> {
    const exists = await this.userService.existsByEmail(email);
    return {
      success: true,
      data: {
        email,
        available: !exists,
      },
    };
  }

  @Delete(':id')
  // @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.userService.remove(id);
    return {
      success: true,
      message: 'User deleted successfully',
    };
  }
}
