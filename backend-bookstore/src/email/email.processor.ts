import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { Logger, OnModuleInit } from '@nestjs/common';

@Processor('email')
export class EmailProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter;

  async onModuleInit() {
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      this.logger.log('No SMTP config found, generating Ethereal test account...');
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      this.logger.log(`Ethereal test account created: ${testAccount.user}`);
    }
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    try {
      if (job.name === 'welcome-email') {
        const { email, name } = job.data;
        const info = await this.transporter.sendMail({
          from: '"BookStore 2026" <noreply@bookstore.com>',
          to: email,
          subject: 'Chào mừng bạn đến với BookStore 2026!',
          text: `Xin chào ${name},\n\nChào mừng bạn đã trở thành thành viên của BookStore 2026. Chúc bạn có những trải nghiệm mua sắm tuyệt vời!\n\nTrân trọng,\nĐội ngũ BookStore 2026`,
          html: `<h3>Xin chào ${name},</h3><p>Chào mừng bạn đã trở thành thành viên của <strong>BookStore 2026</strong>. Chúc bạn có những trải nghiệm mua sắm tuyệt vời!</p><p>Trân trọng,<br>Đội ngũ BookStore 2026</p>`,
        });
        this.logger.log(`Welcome email sent: ${nodemailer.getTestMessageUrl(info) || info.messageId}`);
      } else if (job.name === 'invoice-email') {
        const { email, name, orderData } = job.data;
        
        let formatPrice = (price: any) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(price));

        const info = await this.transporter.sendMail({
          from: '"BookStore 2026" <noreply@bookstore.com>',
          to: email,
          subject: `Xác nhận đơn hàng #${orderData.order_code}`,
          text: `Xin chào ${name},\n\nCảm ơn bạn đã mua hàng. Đơn hàng ${orderData.order_code} của bạn đã được ghi nhận.\n\nTổng thanh toán: ${formatPrice(orderData.total_amount)}\n\nChúng tôi sẽ sớm giao hàng đến bạn.\n\nTrân trọng,\nĐội ngũ BookStore 2026`,
          html: `<h3>Xin chào ${name},</h3><p>Cảm ơn bạn đã mua sắm tại BookStore 2026!</p><p>Mã đơn hàng: <strong style="color: #4f46e5">${orderData.order_code}</strong></p><p>Tổng thanh toán: <strong style="color: #e11d48">${formatPrice(orderData.total_amount)}</strong></p><p>Chúng tôi sẽ xử lý và giao hàng cho bạn trong thời gian sớm nhất.</p><br><p>Trân trọng,<br>Đội ngũ BookStore 2026</p>`,
        });
        this.logger.log(`Invoice email sent: ${nodemailer.getTestMessageUrl(info) || info.messageId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send email for job ${job.id}: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }
}
