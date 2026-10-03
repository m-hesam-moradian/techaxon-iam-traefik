import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  constructor(private readonly config: ConfigService) {}

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');
    const from = this.config.get<string>('SMTP_FROM');
    const publicIamUrl = this.config.get<string>('IAM_PUBLIC_URL');
    const user = this.config.get<string>('SMTP_USER');
    const password = this.config.get<string>('SMTP_PASSWORD');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');

    if (!host || !from || !publicIamUrl || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new InternalServerErrorException('Email verification is not configured correctly');
    }

    if (Boolean(user) !== Boolean(password)) {
      throw new InternalServerErrorException(
        'SMTP credentials must include both user and password',
      );
    }

    let verificationUrl: URL;
    try {
      verificationUrl = new URL('/auth/verify-email', publicIamUrl);
    } catch {
      throw new InternalServerErrorException('IAM_PUBLIC_URL must be a valid URL');
    }

    if (
      !['http:', 'https:'].includes(verificationUrl.protocol) ||
      (this.config.get<string>('NODE_ENV') === 'production' &&
        verificationUrl.protocol !== 'https:')
    ) {
      throw new InternalServerErrorException('Email verification URL must use HTTPS in production');
    }

    verificationUrl.searchParams.set('token', token);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure:
        this.config.get<string>('SMTP_SECURE') === undefined
          ? port === 465
          : this.config.get<string>('SMTP_SECURE') === 'true',
      ...(user && password ? { auth: { user, pass: password } } : {}),
    });

    await transporter.sendMail({
      from,
      to,
      subject: 'Verify your TechAxon account',
      text: `Verify your email address: ${verificationUrl.toString()}`,
      html: `<p>Verify your email address by opening <a href="${verificationUrl.toString()}">this link</a>.</p>`,
    });
  }
}
