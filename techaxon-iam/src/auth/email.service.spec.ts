jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

import { EmailService } from './email.service';

describe('EmailService', () => {
  const sendMail = jest.fn().mockResolvedValue(undefined);
  const createTransport = nodemailer.createTransport as jest.Mock;
  let service: EmailService;

  const configValues: Record<string, string> = {
    SMTP_HOST: 'smtp.example.com',
    SMTP_FROM: 'TechAxon <no-reply@example.com>',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'smtp-user',
    SMTP_PASSWORD: 'smtp-password',
    IAM_PUBLIC_URL: 'https://idp.example.com',
    NODE_ENV: 'development',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    createTransport.mockReturnValue({ sendMail });
    service = new EmailService(new ConfigService(configValues));
  });

  it('sends a verification link without exposing the token elsewhere', async () => {
    await service.sendVerificationEmail('user@example.com', 'signed.token');

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'smtp-user', pass: 'smtp-password' },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'TechAxon <no-reply@example.com>',
        to: 'user@example.com',
        subject: 'Verify your TechAxon account',
        text: expect.stringContaining('token=signed.token'),
      }),
    );
  });

  it('rejects missing SMTP configuration without attempting delivery', async () => {
    service = new EmailService(new ConfigService({ ...configValues, SMTP_HOST: '' }));

    await expect(service.sendVerificationEmail('user@example.com', 'signed.token')).rejects.toThrow(
      'Email verification is not configured correctly',
    );
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('rejects an HTTP verification URL in production', async () => {
    service = new EmailService(
      new ConfigService({
        ...configValues,
        IAM_PUBLIC_URL: 'http://idp.example.com',
        NODE_ENV: 'production',
      }),
    );

    await expect(service.sendVerificationEmail('user@example.com', 'signed.token')).rejects.toThrow(
      'Email verification URL must use HTTPS in production',
    );
    expect(createTransport).not.toHaveBeenCalled();
  });
});
