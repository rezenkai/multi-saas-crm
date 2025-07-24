import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { ChangePasswordDto, CreateUserDto, UpdateUserDto } from './dto';
import { User } from './entity/user.entity';

// Extended interface for Auth0 user creation
interface CreateUserWithAuth0Dto extends Omit<CreateUserDto, 'password'> {
  password?: string; // Make password optional for Auth0 users
  auth0Id?: string;
  isActive?: boolean;
  isVerified?: boolean;
  lastLogin?: Date;
  hashedPassword?: string; // Allow direct hashed password setting
  avatarUrl?: string; // Add avatarUrl explicitly
}

// Extended interface for Auth0 user updates
interface UpdateUserWithAuth0Dto extends UpdateUserDto {
  auth0Id?: string;
  isVerified?: boolean;
  lastLogin?: Date;
  hashedPassword?: string;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(
    createUserDto: CreateUserDto | CreateUserWithAuth0Dto,
  ): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    let hashedPassword: string | undefined;

    // Handle password for different user types
    const authDto = createUserDto as CreateUserWithAuth0Dto;
    if (authDto.hashedPassword) {
      // Direct hashed password (for Auth0 managed users)
      hashedPassword = authDto.hashedPassword;
    } else if (authDto.password === 'auth0_managed') {
      // Auth0 managed users don't have a local password
      hashedPassword = undefined;
    } else if (authDto.password || (createUserDto as CreateUserDto).password) {
      // Regular users - hash the password
      const plainPassword =
        authDto.password || (createUserDto as CreateUserDto).password;
      hashedPassword = await bcrypt.hash(plainPassword, 12);
    } else {
      throw new BadRequestException('Password is required for non-Auth0 users');
    }

    // Create user with proper defaults
    const userData: Partial<User> = {
      // Fix: Use Partial<User> type
      email: createUserDto.email.toLowerCase(),
      username: createUserDto.username,
      hashedPassword,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      // Profile fields
      avatarUrl: authDto.avatarUrl || undefined, // Fix: Use undefined instead of null
      phone: undefined,
      title: undefined,
      department: undefined,
      bio: undefined,
      // Settings with proper defaults
      timezone: createUserDto.timezone || 'UTC',
      locale: createUserDto.locale || 'en',
      theme: createUserDto.theme || 'light',
      emailNotifications: createUserDto.emailNotifications ?? true,
      smsNotifications: createUserDto.smsNotifications ?? false,
      pushNotifications: createUserDto.pushNotifications ?? true,
      marketingNotifications: createUserDto.marketingNotifications ?? false,
      // Status fields
      isActive: authDto.isActive ?? true,
      isVerified: authDto.isVerified ?? false, // Auth0 users can be pre-verified
      isSuperuser: false,
      // 2FA fields
      twoFactorEnabled: false,
      twoFactorSecret: undefined,
      backupCodes: undefined,
      twoFactorVerifiedAt: undefined,
      // Security fields
      failedLoginAttempts: 0,
      lockedUntil: undefined,
      lastLogin: authDto.lastLogin || undefined,
      // Auth0 integration
      auth0Id: authDto.auth0Id || undefined,
    };

    const user = this.userRepository.create(userData);
    return await this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  async findActiveByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: {
        email: email.toLowerCase(),
        isActive: true,
      },
    });
  }

  async findByAuth0Id(auth0Id: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { auth0Id },
    });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto | UpdateUserWithAuth0Dto,
  ): Promise<User> {
    const user = await this.findById(id);

    // Check email uniqueness if email is being updated
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.findByEmail(updateUserDto.email);
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // Prepare update data
    const updateData: Partial<User> = { ...updateUserDto };

    // Handle email transformation
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase();
    }

    // Handle Auth0-specific fields if they exist
    const authDto = updateUserDto as UpdateUserWithAuth0Dto;
    if (authDto.auth0Id !== undefined) {
      updateData.auth0Id = authDto.auth0Id;
    }
    if (authDto.isVerified !== undefined) {
      updateData.isVerified = authDto.isVerified;
    }
    if (authDto.lastLogin !== undefined) {
      updateData.lastLogin = authDto.lastLogin;
    }
    if (authDto.hashedPassword !== undefined) {
      updateData.hashedPassword = authDto.hashedPassword;
    }

    // Update user
    Object.assign(user, updateData);
    return await this.userRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.userRepository.remove(user);
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const { currentPassword, newPassword, newPasswordConfirm } =
      changePasswordDto;

    if (newPassword !== newPasswordConfirm) {
      throw new BadRequestException('New passwords do not match');
    }

    const user = await this.findById(userId);

    // Check if user has a password (Auth0 users might not)
    if (!user.hashedPassword) {
      throw new BadRequestException(
        'Password change not available for SSO users',
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.hashedPassword,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Check if new password is different
    const isSamePassword = await bcrypt.compare(
      newPassword,
      user.hashedPassword,
    );
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    // Hash new password and update
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await this.userRepository.update(userId, {
      hashedPassword: hashedNewPassword,
      failedLoginAttempts: 0, // Reset failed attempts
    });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.userRepository.count({
      where: { email: email.toLowerCase() },
    });
    return count > 0;
  }

  async incrementFailedLoginAttempts(userId: string): Promise<void> {
    const user = await this.findById(userId);
    const attempts = user.failedLoginAttempts + 1;

    const updateData: Partial<User> = {
      failedLoginAttempts: attempts,
    };

    // Lock account if too many failed attempts
    if (attempts >= 5) {
      updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
    }

    await this.userRepository.update(userId, updateData);
  }

  async resetFailedLoginAttempts(userId: string): Promise<void> {
    const user = await this.findById(userId);
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLogin = new Date();
    await this.userRepository.save(user);
  }

  async updateTwoFactorSecret(userId: string, secret: string): Promise<void> {
    await this.userRepository.update(userId, {
      twoFactorSecret: secret,
    });
  }

  async enableTwoFactor(userId: string, backupCodes: string[]): Promise<void> {
    await this.userRepository.update(userId, {
      twoFactorEnabled: true,
      twoFactorVerifiedAt: new Date(),
      backupCodes: JSON.stringify(backupCodes),
    });
  }

  async disableTwoFactor(userId: string): Promise<void> {
    const user = await this.findById(userId);
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.backupCodes = undefined;
    user.twoFactorVerifiedAt = undefined;
    await this.userRepository.save(user);
  }

  async updateBackupCodes(
    userId: string,
    backupCodes: string[],
  ): Promise<void> {
    await this.userRepository.update(userId, {
      backupCodes: JSON.stringify(backupCodes),
    });
  }

  async useBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user.backupCodes) return false;

    const backupCodes = JSON.parse(user.backupCodes) as string[];
    const codeIndex = backupCodes.indexOf(code.toUpperCase());

    if (codeIndex === -1) return false;

    // Remove used backup code
    backupCodes.splice(codeIndex, 1);
    await this.userRepository.update(userId, {
      backupCodes: JSON.stringify(backupCodes),
    });

    return true;
  }

  // Additional helper methods for Auth0 integration

  /**
   * Create Auth0 managed user (no local password)
   */
  async createAuth0User(userData: {
    email: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    auth0Id: string;
    isVerified?: boolean;
  }): Promise<User> {
    // Fix: Remove avatarUrl from interface since it's not in your original DTOs
    const createUserDto: CreateUserWithAuth0Dto = {
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      username: userData.username || userData.email,
      auth0Id: userData.auth0Id,
      isActive: true,
      isVerified: userData.isVerified ?? true, // Auth0 users are typically pre-verified
      lastLogin: new Date(),
      hashedPassword: undefined, // Auth0 manages authentication
    };

    return this.create(createUserDto);
  }

  /**
   * Update user's Auth0 ID
   */
  async updateAuth0Id(userId: string, auth0Id: string): Promise<User> {
    const updateDto: UpdateUserWithAuth0Dto = {
      auth0Id,
    };
    return this.update(userId, updateDto);
  }

  /**
   * Sync user data from Auth0
   */
  async syncFromAuth0(
    userId: string,
    auth0Data: {
      email?: string;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
      isVerified?: boolean;
    },
  ): Promise<User> {
    const updateDto: UpdateUserWithAuth0Dto = {
      ...auth0Data,
      lastLogin: new Date(),
    };
    return this.update(userId, updateDto);
  }
}
