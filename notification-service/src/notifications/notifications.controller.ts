import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  SendEmailDto,
  SendNotificationDto,
  SendPushDto,
  SendSmsDto,
  SendTelegramDto,
  SendWhatsAppDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Универсальный endpoint для отправки уведомлений через несколько каналов
   * Точно как в требованиях:
   * await notificationService.send({
   *   to: 'user@example.com',
   *   channels: ['email', 'telegram', 'sms'],
   *   template: 'opportunity_created',
   *   data: { opportunityName: 'Big Deal' }
   * });
   */
  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendMultiChannel(@Body() dto: SendNotificationDto) {
    const result = await this.notificationsService.send(dto);

    return {
      success: true,
      data: result,
      message: `Notification sent via ${result.successCount}/${result.totalChannels} channels`,
    };
  }

  /**
   * Отправка только email уведомлений (заглушка)
   */
  @Post('email')
  @HttpCode(HttpStatus.OK)
  async sendEmail(@Body() dto: SendEmailDto) {
    const result = await this.notificationsService.sendEmailStub(dto);

    return {
      success: result.status === 'sent',
      data: result,
      message:
        result.status === 'sent'
          ? 'Email sent successfully'
          : 'Email sending failed',
    };
  }

  /**
   * Отправка только SMS уведомлений (заглушка)
   */
  @Post('sms')
  @HttpCode(HttpStatus.OK)
  async sendSms(@Body() dto: SendSmsDto) {
    const result = await this.notificationsService.sendSmsStub(dto);

    return {
      success: result.status === 'sent',
      data: result,
      message:
        result.status === 'sent'
          ? 'SMS sent successfully'
          : 'SMS sending failed',
    };
  }

  /**
   * Отправка Telegram уведомлений (заглушка)
   */
  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  async sendTelegram(@Body() dto: SendTelegramDto) {
    const result = await this.notificationsService.sendTelegramStub(dto);

    return {
      success: result.status === 'sent',
      data: result,
      message:
        result.status === 'sent'
          ? 'Telegram message sent successfully'
          : 'Telegram sending failed',
    };
  }

  /**
   * Отправка WhatsApp уведомлений (заглушка)
   */
  @Post('whatsapp')
  @HttpCode(HttpStatus.OK)
  async sendWhatsApp(@Body() dto: SendWhatsAppDto) {
    const result = await this.notificationsService.sendWhatsAppStub(dto);

    return {
      success: result.status === 'sent',
      data: result,
      message:
        result.status === 'sent'
          ? 'WhatsApp message sent successfully'
          : 'WhatsApp sending failed',
    };
  }

  /**
   * Отправка Push уведомлений (заглушка)
   */
  @Post('push')
  @HttpCode(HttpStatus.OK)
  async sendPush(@Body() dto: SendPushDto) {
    const result = await this.notificationsService.sendPushStub(dto);

    return {
      success: result.status === 'sent',
      data: result,
      message:
        result.status === 'sent'
          ? 'Push notification sent successfully'
          : 'Push sending failed',
    };
  }

  /**
   * Получение статуса уведомления
   */
  @Get('status/:id')
  async getNotificationStatus(@Param('id') id: string) {
    const result = await this.notificationsService.getNotificationStatus(id);

    if (!result) {
      return {
        success: false,
        error: 'Notification not found',
      };
    }

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Информация о поддерживаемых каналах
   */
  @Get('channels')
  getChannels() {
    return {
      success: true,
      data: {
        channels: ['email', 'sms', 'telegram', 'whatsapp', 'push'],
        status: 'All channels are currently running in STUB mode',
        features: [
          'Multi-channel sending',
          'Template support',
          'Delivery tracking',
          'Error handling',
        ],
      },
    };
  }
}
