import { Controller, Get, Render, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('login')
  @Render('login')
  getLogin(
    @Query('client_id') clientId?: string,
    @Query('redirect_uri') redirectUri?: string,
    @Query('state') state?: string,
  ) {
    return {
      clientId: clientId || 'TechAxon App',
      redirectUri: redirectUri || '',
      state: state || '',
    };
  }
}
