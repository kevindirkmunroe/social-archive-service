import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { FacebookService } from './facebook.service';
import { FacebookPayloadDto } from './FacebookPayload.dto.js';
import { getPosts, getHashtags } from './MongoDBService';

@Controller('social-archive')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly facebookService: FacebookService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('facebook/posts')
  getFacebookPosts(@Query() params: any): any {
    return getPosts(params.userId, params.hashtag);
  }

  @Get('facebook/hashtags')
  getFacebookHashtags(): any {
    return getHashtags();
  }

  @Post()
  async putFacebookData(@Body() fbPayload: FacebookPayloadDto) {
    return this.facebookService.insertFacebookPosts(fbPayload);
  }
}
