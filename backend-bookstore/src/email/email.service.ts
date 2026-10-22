import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  async sendWelcomeEmail(email: string, name: string) {
    this.logger.log(`Queueing welcome email for ${email}`);
    await this.emailQueue.add('welcome-email', {
      email,
      name,
    });
  }

  async sendInvoiceEmail(email: string, name: string, orderData: any) {
    this.logger.log(`Queueing invoice email for ${email}`);
    await this.emailQueue.add('invoice-email', {
      email,
      name,
      orderData,
    });
  }
}
