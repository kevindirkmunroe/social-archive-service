import { Injectable } from '@nestjs/common';
import IFacebookPayload from './IFacebookPayload';
import { insertPosts } from './MongoDBService';
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
          // console.log(`\n\nAXIOS response=${JSON.stringify(response.data)}`);
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
      // console.log(`\nAYYYYY got response ${JSON.stringify(WTF)}`);
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
