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

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);

    // Create user
    const user = this.userRepository.create({
      ...createUserDto,
      hashedPassword,
      // Set defaults
      timezone: createUserDto.timezone || 'UTC',
      locale: createUserDto.locale || 'en',
      theme: createUserDto.theme || 'light',
      emailNotifications: createUserDto.emailNotifications ?? true,
      smsNotifications: createUserDto.smsNotifications ?? false,
      pushNotifications: createUserDto.pushNotifications ?? true,
      marketingNotifications: createUserDto.marketingNotifications ?? false,
      isActive: true,
      isVerified: true, // Auth0 handles verification
      isSuperuser: false,
      twoFactorEnabled: false,
      failedLoginAttempts: 0,
    });

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

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    // Check email uniqueness if email is being updated
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.findByEmail(updateUserDto.email);
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // Update user
    Object.assign(user, updateUserDto);
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
}
