import { Injectable } from '@nestjs/common';
import pino from 'pino';
import axios from 'axios';

import IFacebookPayload from './IFacebookPayload';
import {
  deleteHashtag,
  insertPosts,
  insertSharedHashtag,
  getShareableHashtagId,
  getShareableHashtagDetails,
} from './MongoDBService';
import {
  deleteMediaFromS3
} from './AWSService';

import { SharedHashtagDto } from './SharedHashtag.dto';
import IFacebookInsertResult from './IFacebookInsertResult';

const LOGGER = pino(  { timestamp: pino.stdTimeFunctions.isoTime});

@Injectable()
export class FacebookService {
  static VERSION = 'v18.0';


  filterPostsByHashtag(data: any[], hashtag: string) {
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
      const count = await deleteHashtag(fbPayload.id, fbPayload.hashtag);
      return await deleteMediaFromS3(fbPayload.id, fbPayload.hashtag);
    } catch (error) {
      LOGGER.info(
        `[FacebookService] facebookService error deleting hashtag ${fbPayload.hashtag}: ${error}`,
      );
    }
  }

  async insertFacebookPosts(
    fbPayload: IFacebookPayload,
  ): Promise<IFacebookInsertResult> {
    let WTF = { name: 'WTF' };
    const getGraphAPIDataFromFacebook = async (nextUrl): Promise<any> => {
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

    const addAttachmentsToPost = async (post) => {
      const postUrl = `https://graph.facebook.com/${FacebookService.VERSION}/${post.id}/attachments`;
      await axios
        .get(postUrl, {
          headers: {
            Authorization: `Bearer ${fbPayload.accessToken}`,
          },
        })
        .then((response) => {
          post['attachments'] = response.data.data;
        });
    };

    let next = `https://graph.facebook.com/${FacebookService.VERSION}/${fbPayload.id}/posts?fields=id,created_time,message`;
    let result = [];
    let atOldestPost = false;
    let totalCount = 0;
    while (next !== null && !atOldestPost) {
      LOGGER.info(`\nInsertFacebookPosts NEXT URL=${next}`);
      let posts = await getGraphAPIDataFromFacebook(next);
      posts = WTF;

      if (posts && posts.data) {
        LOGGER.info(`${posts.data.length} raw posts`);
        totalCount += posts.data.length;
        const { filteredPosts, oldestDate } = this.filterPostsByHashtag(
          posts.data,
          fbPayload.hashtag,
        );
        LOGGER.info(`\n\ngot ${filteredPosts.length} filtered posts`);

        filteredPosts.forEach((post) => {
          addAttachmentsToPost(post);
        });

        result = result.concat(filteredPosts);
        LOGGER.info(`result length now ${result.length}`);
        LOGGER.info(
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
    LOGGER.info(
      `[FacebookService] Archived ${result.length} out of ${totalCount} posts.`,
    );

    const sharedHashtag: SharedHashtagDto = {
      userName: fbPayload.userName,
      userId: fbPayload.id,
      hashtag: fbPayload.hashtag,
    };

    const shareKey = await this.createSharedHashtag(sharedHashtag);
    return {
      count: result.length,
      shareKey: shareKey.toString(),
    };
  }

  async createSharedHashtag(sharedHashtag: SharedHashtagDto) {
    const key =
      Math.floor(Math.random() * (9999999999 - 1000000000 + 1)) + 1000000000;
    await insertSharedHashtag(key, sharedHashtag);
    LOGGER.info(`[FacebookService] created shared hashtag ${key}`);
    return key;
  }

  async getShareableHashtagId(userId, hashtag) {
    return await getShareableHashtagId(userId, hashtag);
  }

  async getShareableHashtagDetails(shareableHashtagId) {
    return await getShareableHashtagDetails(shareableHashtagId);
  }
}
