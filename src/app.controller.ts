import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { AppService } from './app.service';
import { FacebookService } from './facebook.service';
import { FacebookPayloadDto } from './FacebookPayload.dto.js';
import { getPosts } from './MongoDBService';

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

  @Post()
  async putFacebookData(@Body() fbPayload: FacebookPayloadDto) {
    return this.facebookService.insertFacebookPosts(fbPayload);
  }
}
