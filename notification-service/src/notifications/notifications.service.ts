import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  NotificationChannel,
  SendEmailDto,
  SendNotificationDto,
  SendPushDto,
  SendSmsDto,
  SendTelegramDto,
  SendWhatsAppDto,
} from './dto/notification.dto';

export interface NotificationResult {
  id: string;
  channel: NotificationChannel;
  status: 'sent' | 'failed';
  recipient: string;
  sentAt: Date;
  externalId?: string;
  error?: string;
}

export interface MultiChannelResponse {
  requestId: string;
  results: NotificationResult[];
  successCount: number;
  failureCount: number;
  totalChannels: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  /**
   * Универсальный метод отправки уведомлений через несколько каналов
   * (Единый интерфейс как в требованиях)
   */
  async send(dto: SendNotificationDto): Promise<MultiChannelResponse> {
    const requestId = uuidv4();
    const results: NotificationResult[] = [];

    this.logger.log(
      `Processing multi-channel notification request: ${requestId}`,
    );
    this.logger.log(
      `Channels: ${dto.channels.join(', ')}, Template: ${dto.template}, Recipient: ${dto.to}`,
    );

    for (const channel of dto.channels) {
      try {
        let result: NotificationResult;

        switch (channel) {
          case NotificationChannel.EMAIL:
            result = await this.sendEmailStub({
              to: dto.to,
              subject: `Notification: ${dto.template}`,
              template: dto.template,
              data: dto.data,
              tenantId: dto.tenantId,
            });
            break;

          case NotificationChannel.SMS:
            result = await this.sendSmsStub({
              to: dto.to,
              message: `${dto.template}: ${JSON.stringify(dto.data)}`,
              template: dto.template,
              data: dto.data,
              tenantId: dto.tenantId,
            });
            break;

          case NotificationChannel.TELEGRAM:
            result = await this.sendTelegramStub({
              chatId: dto.to,
              message: `${dto.template}: ${JSON.stringify(dto.data)}`,
              template: dto.template,
              data: dto.data,
            });
            break;

          case NotificationChannel.WHATSAPP:
            result = await this.sendWhatsAppStub({
              to: dto.to,
              message: `${dto.template}: ${JSON.stringify(dto.data)}`,
              template: dto.template,
              data: dto.data,
            });
            break;

          case NotificationChannel.PUSH:
            result = await this.sendPushStub({
              to: dto.to,
              title: dto.template,
              body: JSON.stringify(dto.data),
              data: dto.data,
            });
            break;

          default:
            throw new Error(`Unsupported channel: ${channel}`);
        }

        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed to send ${channel} notification:`,
          error.message,
        );
        results.push({
          id: uuidv4(),
          channel,
          status: 'failed',
          recipient: dto.to,
          sentAt: new Date(),
          error: error.message,
        });
      }
    }

    const response: MultiChannelResponse = {
      requestId,
      results,
      successCount: results.filter((r) => r.status === 'sent').length,
      failureCount: results.filter((r) => r.status === 'failed').length,
      totalChannels: dto.channels.length,
    };

    this.logger.log(
      `Multi-channel notification completed: ${response.successCount}/${response.totalChannels} sent`,
    );
    return response;
  }

  /**
   * EMAIL STUB - заглушка для email уведомлений
   */
  async sendEmailStub(dto: SendEmailDto): Promise<NotificationResult> {
    this.logger.log(`📧 [EMAIL STUB] Sending email to: ${dto.to}`);
    this.logger.log(`📧 [EMAIL STUB] Subject: ${dto.subject}`);
    this.logger.log(`📧 [EMAIL STUB] Template: ${dto.template}`);
    this.logger.log(`📧 [EMAIL STUB] Data: ${JSON.stringify(dto.data)}`);

    // Имитация задержки отправки
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Имитация успешной отправки (95% success rate)
    const isSuccess = Math.random() > 0.05;

    const result: NotificationResult = {
      id: uuidv4(),
      channel: NotificationChannel.EMAIL,
      status: isSuccess ? 'sent' : 'failed',
      recipient: dto.to,
      sentAt: new Date(),
      externalId: `email_${Date.now()}`, // Fake external ID
      ...(isSuccess ? {} : { error: 'Simulated email delivery failure' }),
    };

    this.logger.log(
      `📧 [EMAIL STUB] Result: ${result.status} (ID: ${result.id})`,
    );
    return result;
  }

  /**
   * SMS STUB - заглушка для SMS уведомлений
   */
  async sendSmsStub(dto: SendSmsDto): Promise<NotificationResult> {
    this.logger.log(`📱 [SMS STUB] Sending SMS to: ${dto.to}`);
    this.logger.log(
      `📱 [SMS STUB] Message: ${dto.message.substring(0, 50)}...`,
    );
    this.logger.log(`📱 [SMS STUB] Template: ${dto.template || 'none'}`);

    // Имитация задержки отправки
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Имитация успешной отправки (90% success rate)
    const isSuccess = Math.random() > 0.1;

    const result: NotificationResult = {
      id: uuidv4(),
      channel: NotificationChannel.SMS,
      status: isSuccess ? 'sent' : 'failed',
      recipient: dto.to,
      sentAt: new Date(),
      externalId: `sms_${Date.now()}`, // Fake external ID
      ...(isSuccess ? {} : { error: 'Simulated SMS delivery failure' }),
    };

    this.logger.log(
      `📱 [SMS STUB] Result: ${result.status} (ID: ${result.id})`,
    );
    return result;
  }

  /**
   * TELEGRAM STUB - заглушка для Telegram уведомлений
   */
  async sendTelegramStub(dto: SendTelegramDto): Promise<NotificationResult> {
    this.logger.log(`🤖 [TELEGRAM STUB] Sending to chat: ${dto.chatId}`);
    this.logger.log(
      `🤖 [TELEGRAM STUB] Message: ${dto.message.substring(0, 50)}...`,
    );

    await new Promise((resolve) => setTimeout(resolve, 80));

    const result: NotificationResult = {
      id: uuidv4(),
      channel: NotificationChannel.TELEGRAM,
      status: 'sent', // Telegram rarely fails
      recipient: dto.chatId,
      sentAt: new Date(),
      externalId: `tg_${Date.now()}`,
    };

    this.logger.log(
      `🤖 [TELEGRAM STUB] Result: ${result.status} (ID: ${result.id})`,
    );
    return result;
  }

  /**
   * WHATSAPP STUB - заглушка для WhatsApp уведомлений
   */
  async sendWhatsAppStub(dto: SendWhatsAppDto): Promise<NotificationResult> {
    this.logger.log(`💬 [WHATSAPP STUB] Sending to: ${dto.to}`);
    this.logger.log(
      `💬 [WHATSAPP STUB] Message: ${dto.message.substring(0, 50)}...`,
    );

    await new Promise((resolve) => setTimeout(resolve, 120));

    const isSuccess = Math.random() > 0.15; // 85% success rate

    const result: NotificationResult = {
      id: uuidv4(),
      channel: NotificationChannel.WHATSAPP,
      status: isSuccess ? 'sent' : 'failed',
      recipient: dto.to,
      sentAt: new Date(),
      externalId: `wa_${Date.now()}`,
      ...(isSuccess ? {} : { error: 'Simulated WhatsApp delivery failure' }),
    };

    this.logger.log(
      `💬 [WHATSAPP STUB] Result: ${result.status} (ID: ${result.id})`,
    );
    return result;
  }

  /**
   * PUSH STUB - заглушка для Push уведомлений
   */
  async sendPushStub(dto: SendPushDto): Promise<NotificationResult> {
    this.logger.log(`🔔 [PUSH STUB] Sending push to: ${dto.to}`);
    this.logger.log(`🔔 [PUSH STUB] Title: ${dto.title}`);
    this.logger.log(`🔔 [PUSH STUB] Body: ${dto.body}`);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const result: NotificationResult = {
      id: uuidv4(),
      channel: NotificationChannel.PUSH,
      status: 'sent',
      recipient: dto.to,
      sentAt: new Date(),
      externalId: `push_${Date.now()}`,
    };

    this.logger.log(
      `🔔 [PUSH STUB] Result: ${result.status} (ID: ${result.id})`,
    );
    return result;
  }

  /**
   * Получение статуса уведомления (заглушка)
   */
  async getNotificationStatus(id: string): Promise<NotificationResult | null> {
    this.logger.log(`📊 [STATUS STUB] Getting status for notification: ${id}`);

    // Заглушка - возвращаем фиктивный результат
    return {
      id,
      channel: NotificationChannel.EMAIL,
      status: 'sent',
      recipient: 'stub@example.com',
      sentAt: new Date(),
      externalId: `stub_${id}`,
    };
  }
}
