import { Injectable } from '@nestjs/common';
import IFacebookPayload from './IFacebookPayload';
import { insertPosts } from './MongoDBService';

@Injectable()
export class FacebookService {
  static VERSION = 'v18.0';

  getPostsByHashtag(data: any[], hashtag: string) {
    const result = [];
    data.forEach((post) => {
      if (post.message && post.message.includes(`#${hashtag}`)) {
        result.push(post);
      }
    });

    return result;
  }
  async insertFacebookPosts(fbPayload: IFacebookPayload): Promise<number> {
    const getPostsAction = async (userId) => {
      const response = await fetch(
        `https://graph.facebook.com/${FacebookService.VERSION}/${userId}/posts`,
        {
          headers: {
            Authorization: `Bearer ${fbPayload.accessToken}`,
          },
        },
      );
      return await response.json(); //extract JSON from the http response
    };

    const posts = await getPostsAction(fbPayload.id);
    const result = this.getPostsByHashtag(posts.data, fbPayload.hashtag);

    await insertPosts(fbPayload.id, fbPayload.hashtag, result);
    console.log(`[SocialArchive] Archived ${result.length} posts.`);
    return result.length;
  }
}
