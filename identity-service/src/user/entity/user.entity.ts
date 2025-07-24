import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: false })
  email: string;

  @Column({ unique: true, nullable: true })
  username?: string;

  @Exclude()
  @Column({ name: 'hashed_password', nullable: false })
  hashedPassword: string;

  @Column({ name: 'first_name', nullable: true })
  firstName?: string;

  @Column({ name: 'last_name', nullable: true })
  lastName?: string;

  // Profile fields
  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  title?: string;

  @Column({ nullable: true })
  department?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  // Settings
  @Column({ default: 'UTC' })
  timezone: string;

  @Column({ default: 'en' })
  locale: string;

  @Column({ default: 'light' })
  theme: string;

  @Column({ name: 'email_notifications', default: true })
  emailNotifications: boolean;

  @Column({ name: 'sms_notifications', default: false })
  smsNotifications: boolean;

  @Column({ name: 'push_notifications', default: true })
  pushNotifications: boolean;

  @Column({ name: 'marketing_notifications', default: false })
  marketingNotifications: boolean;

  // Status fields
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'is_superuser', default: false })
  isSuperuser: boolean;

  // Two-Factor Authentication
  @Column({ name: 'two_factor_enabled', default: false })
  twoFactorEnabled: boolean;

  @Exclude()
  @Column({ name: 'two_factor_secret', nullable: true })
  twoFactorSecret?: string;

  @Exclude()
  @Column({ name: 'backup_codes', type: 'text', nullable: true })
  backupCodes?: string; // JSON array of backup codes

  @Column({ name: 'two_factor_verified_at', type: 'timestamp', nullable: true })
  twoFactorVerifiedAt?: Date;

  // Security fields
  @Exclude()
  @Column({ name: 'failed_login_attempts', default: 0 })
  failedLoginAttempts: number;

  @Exclude()
  @Column({ name: 'locked_until', type: 'timestamp', nullable: true })
  lockedUntil?: Date;

  @Column({ name: 'last_login', type: 'timestamp', nullable: true })
  lastLogin?: Date;

  // Auth0 Integration
  @Column({ name: 'auth0_id', nullable: true, unique: true })
  auth0Id?: string;

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Virtual properties (similar to Kotlin)
  get fullName(): string {
    return `${this.firstName || ''} ${this.lastName || ''}`.trim();
  }

  get isAccountNonLocked(): boolean {
    if (!this.lockedUntil) return true;
    return new Date() > this.lockedUntil;
  }

  get isEnabled(): boolean {
    return this.isActive && this.isVerified;
  }

  get authorities(): string[] {
    const authorities = ['ROLE_USER'];
    if (this.isSuperuser) {
      authorities.push('ROLE_ADMIN');
    }
    return authorities;
  }
}
