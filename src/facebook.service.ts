import { Injectable } from '@nestjs/common';
import IFacebookPayload from './IFacebookPayload';
import { deleteHashtag, insertPosts } from './MongoDBService';
import axios from 'axios';

@Injectable()
export class FacebookService {
  static VERSION = 'v18.0';

  getPostsByHashtag(data: any[], hashtag: string) {
    let oldestDate = null;
    const filteredPosts = [];
    data.forEach((post) => {
      if (post.message && post.message.includes(`#${hashtag}`)) {
        filteredPosts.push(post);
      }
      const testDate = new Date(post.created_time);
      if (oldestDate == null) {
        oldestDate = testDate;
      } else {
        oldestDate = oldestDate > testDate ? testDate : oldestDate;
      }
    });

    return { filteredPosts, oldestDate };
  }

  async deleteFacebookPosts(fbPayload: IFacebookPayload): Promise<number> {
    try {
      return await deleteHashtag(fbPayload.id, fbPayload.hashtag);
    } catch (error) {
      console.log(
        `[SocialArchive] facebookService error deleting hashtag ${fbPayload.hashtag}: ${error}`,
      );
    }
  }

  async insertFacebookPosts(fbPayload: IFacebookPayload): Promise<number> {
    let WTF = { name: 'WTF' };
    const getPostsFromFacebookAction = async (nextUrl): Promise<any> => {
      await axios
        .get(nextUrl, {
          headers: {
            Authorization: `Bearer ${fbPayload.accessToken}`,
          },
        })
        .then((response) => {
          WTF = response.data;
          return response.data; //extract JSON from the http response
        });
    };

    let next = `https://graph.facebook.com/${FacebookService.VERSION}/${fbPayload.id}/posts?fields=id,created_time,message,attachments{media}`;
    let result = [];
    let atOldestPost = false;
    let totalCount = 0;
    while (next !== null && !atOldestPost) {
      console.log(`\nInsertFacebookPosts NEXT URL=${next}`);
      let posts = await getPostsFromFacebookAction(next);
      posts = WTF;

      if (posts && posts.data) {
        console.log(`${posts.data.length} raw posts`);
        totalCount += posts.data.length;
        const { filteredPosts, oldestDate } = this.getPostsByHashtag(
          posts.data,
          fbPayload.hashtag,
        );
        console.log(`\n\ngot ${filteredPosts.length} filtered posts`);
        result = result.concat(filteredPosts);
        console.log(`result length now ${result.length}`);
        console.log(
          `oldestDate: ${oldestDate.getFullYear()} oldestYear: ${
            fbPayload.oldestYear
          }`,
        );
        if (oldestDate.getFullYear() < fbPayload.oldestYear) {
          atOldestPost = true;
        }
        next = posts.paging.next;
      } else {
        next = null;
      }
    }

    await insertPosts(fbPayload.id, fbPayload.hashtag, result);
    console.log(
      `[SocialArchive] Archived ${result.length} out of ${totalCount} posts.`,
    );
    return result.length;
  }
}
