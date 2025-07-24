import {
  IsArray,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  TELEGRAM = 'telegram',
  WHATSAPP = 'whatsapp',
  PUSH = 'push',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export class SendNotificationDto {
  @IsString()
  to: string; // Email, phone number, or user ID

  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels: NotificationChannel[];

  @IsString()
  template: string;

  @IsObject()
  data: Record<string, any>;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority = NotificationPriority.NORMAL;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SendEmailDto {
  @IsEmail()
  to: string;

  @IsString()
  subject: string;

  @IsString()
  template: string;

  @IsObject()
  data: Record<string, any>;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class SendSmsDto {
  @IsString()
  to: string; // Phone number

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  template?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class SendTelegramDto {
  @IsString()
  chatId: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  template?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}

export class SendWhatsAppDto {
  @IsString()
  to: string; // Phone number

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  template?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}

export class SendPushDto {
  @IsString()
  to: string; // FCM token or user ID

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, string>;
}
