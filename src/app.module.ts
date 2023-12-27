import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FacebookService } from './facebook.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, FacebookService],
})
export class AppModule {}
