import 'dotenv/config.js';
import { MongoClient, ServerApiVersion } from 'mongodb';
import pino from 'pino';

import { deleteMediaFromS3, uploadMediaToS3 } from './AWSService';

const username = encodeURIComponent(process.env.MONGODB_USERNAME);
const password = encodeURIComponent(process.env.MONGODB_PASSWORD);
const DB_NAME = process.env.MONGODB_DB_NAME;
const ROOT_COLLECTION = process.env.MONGODB_ROOT_COLLECTION;
const SHARED_HASHTAG_COLLECTION = process.env.MONGODB_SHARED_HASHTAG_COLLECTION;
const MONGO_DB_URI = `mongodb+srv://${username}:${password}@cluster0.pkkfyis.mongodb.net/?retryWrites=true&w=majority`;
const S3_DEFAULT_IMAGE = process.env.S3_DEFAULT_IMAGE;
const LOGGER = pino(  { timestamp: pino.stdTimeFunctions.isoTime});

export async function mongoDBInit() {
  const client = new MongoClient(MONGO_DB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  const mongoCollections = [ROOT_COLLECTION];
  for (const collection of mongoCollections) {
    try {
      // Connect the client to the server	(optional starting in v4.7)
      await client.connect();
      await client.db(DB_NAME).createCollection(collection);
      LOGGER.info(`[MongoDBService] MongoDB collection ${collection} ready.`);
    } catch (error) {
      if (!(error.codeName === 'NamespaceExists')) {
        LOGGER.error(
          `[MongoDBService] MongoDB init ERROR: ${JSON.stringify(error)}`,
        );
      } else {
        LOGGER.info(
          `\n[MongoDBService] MongoDB collection ${collection} ready.`,
        );
      }
    }
  }
  // Ensures that the client will close when you finish/error
  await client.close();
}

const openMongoDBClient = async () => {
  //
  // Initialize Mongo Client
  //
  const client = new MongoClient(MONGO_DB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  try {
    await client.connect();
  } catch (error) {
    LOGGER.error(`[MongoDBService] ERROR ${JSON.stringify(error)}`);
  }
  return client;
};

export async function insertPosts(
  userId: string,
  hashtag: string,
  posts: any[],
) {
  // Key: {userId, post.id}, Value: { post, ...hashtag }

  const client = await openMongoDBClient();
  //
  // Build up docs to insert
  //
  const mongoDocs = [];
  posts.forEach((post) => {
    mongoDocs.push({ _id: post.id, userId, hashtag, ...post });
    if (post.attachments) {
      LOGGER.info(`[MongoDBService] image link=${JSON.stringify(post.attachments)}`);
    }
  });
  try {
    let count = 0;
    for (const doc of mongoDocs) {
      //
      // Upsert post
      //
      await client
        .db(DB_NAME)
        .collection(ROOT_COLLECTION)
        .replaceOne({ _id: doc._id }, doc, { upsert: true });

      //
      // Archive image bytes
      //
      if (doc.attachments) {
        const attachmentData = doc.attachments.data;
        attachmentData.map(async (media) => {
          const { media: media2 } = media;
          await uploadMediaToS3(doc._id, media2.image.src);
        });
      } else {
        await uploadMediaToS3(doc._id, S3_DEFAULT_IMAGE);
      }
      count++;
    }
    LOGGER.info(`\n[MongoDBService] Upserted ${count} posts.\n`);
  } catch (error) {
    LOGGER.error(
      `[MongoDBService] MongoDB insert ERROR: ${JSON.stringify(error)}`,
    );
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

export async function getPosts(userId: string, hashtag: string) {
  let client = null;
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client = await openMongoDBClient();
    const query =
      userId !== null
        ? { userId: userId, hashtag: hashtag }
        : { hashtag: hashtag };
    LOGGER.info(`[MongoDBService] getPosts query=${JSON.stringify(query)}`);
    const results = await client
      .db(DB_NAME)
      .collection(ROOT_COLLECTION)
      .find(query)
      .toArray();

    LOGGER.info(`\n[MongoDBService] Got ${results.length} posts.\n`);
    return results;
  } catch (error) {
    LOGGER.error(`[MongoDBService] MongoDB get ERROR: ${JSON.stringify(error)}`);
  } finally {
    // Ensures that the client will close when you finish/error
    if (client) {
      await client.close();
    }
  }
}

export async function getHashtags(userId) {
  const client = new MongoClient(MONGO_DB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: false,
      deprecationErrors: true,
    },
  });

  //
  // TODO: now that there's SocialArhiveShares, this query is obsolete
  //
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const results = await client
      .db(DB_NAME)
      .collection(SHARED_HASHTAG_COLLECTION)
      .find({ 'sharedHashtag.userId': userId })
      .toArray();

    LOGGER.info(
      `\n[MongoDBService] Got ${results.length} hashtags`,
    );
    return results.map((result) => {
      return { shareableId: result._id, hashtag: result };
    });
  } catch (error) {
    LOGGER.error(
      `[MongoDBService] MongoDB get hashtags ERROR: ${JSON.stringify(error)}`,
    );
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

export async function deleteHashtag(userId: string, hashtag: string) {
  //
  // Initialize Mongo Client
  //
  let client = null;
  try {
    client = await openMongoDBClient();
  } catch (error) {
    LOGGER.error(
      `[MongoDBService] ERROR opening MongoDB client: ${JSON.stringify(error)}`,
    );
    return;
  }

  const session = client.startSession();
  const imagesToDelete = [];

  try {
    await session.withTransaction(async () => {
      //
      // Delete from MongoDB
      //
      try {
        await client
          .db(DB_NAME)
          .collection(ROOT_COLLECTION)
          .deleteMany({ hashtag: hashtag }, { session: session });
      } catch (err) {
        throw err;
      }

      //
      // Delete from S3
      //

      // TODO: find a way to get the image ids without fetching posts first
      try {
        const posts = await getPosts(userId, hashtag);
        posts.forEach((post) => {
          imagesToDelete.push(`${post.id}.jpg`);
        });
      } catch (err) {
        throw err;
      }

      try {
        await deleteMediaFromS3(imagesToDelete);
        LOGGER.info(
          `\n[MongoDBService] Deleted ${imagesToDelete.length} posts.\n`,
        );
      } catch (err) {
        throw err;
      }
    });
    return imagesToDelete.length;
  } catch (error) {
    LOGGER.error(
      `[MongoDBService] Error deleting hashtag ${hashtag}: ${JSON.stringify(
        error,
      )}`,
    );
  } finally {
    await session.endSession();
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

export async function insertSharedHashtag(upsertTag) {
  let client;
  try {
    client = await openMongoDBClient();

    // if sharedHashtag exists do nothing
    const exists = await client
      .db(DB_NAME)
      .collection(SHARED_HASHTAG_COLLECTION)
      .find({'sharedHashtag.hashtag' : upsertTag})
      .toArray();

    LOGGER.debug(`[MongoDBService] insertSharedHashtag array returned= ${exists}`);
    if(!exists){
      await client
        .db(DB_NAME)
        .collection(SHARED_HASHTAG_COLLECTION)
        .replaceOne({ 'sharedHashtag.hashtag'  : upsertTag }, upsertTag, { upsert: true });

      LOGGER.info(
        `[MongoDBService] upsert shared hashtag ${upsertTag.id} COMPLETE`,
      );
    }else{
      LOGGER.info(`[MongoDBService] shared hashtag ${upsertTag.id} ALREADY EXISTS`);
    }

  } catch (error) {
      LOGGER.error(
      `[MongoDBService] insert shared hashtag ERROR: ${JSON.stringify(error)}`,
    );
  } finally {
    if (client) {
      client.close();
    }
  }
}

export async function getShareableHashtagId(userId, hashtag) {
  let client;
  try {
    client = await openMongoDBClient();
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const results = await client
      .db(DB_NAME)
      .collection(SHARED_HASHTAG_COLLECTION)
      .find({ userId, hashtag });

    LOGGER.info(
      `\n[MongoDBService] Got ${
        results.length
      } shareable hashtags: ${JSON.stringify(results)})}.\n`,
    );
    return results;
  } catch (error) {
    LOGGER.error(
      `[MongoDBService] MongoDB get hashtags ERROR: ${JSON.stringify(error)}`,
    );
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

export async function getShareableHashtagDetails(shareableHashtagId) {
  let client;
  try {
    client = await openMongoDBClient();
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const query = { _id: Number(shareableHashtagId) };

    const results = await client
      .db(DB_NAME)
      .collection(SHARED_HASHTAG_COLLECTION)
      .find(query)
      .toArray();

    LOGGER.info(
      `\n[MongoDBService] getShareableHashtagDetails for ${shareableHashtagId} Got ${
        results.length
      } shareable hashtags: ${JSON.stringify(results)})}.\n`,
    );
    return results;
  } catch (error) {
    LOGGER.error(
      `[MongoDBService] MongoDB get hashtags ERROR: ${JSON.stringify(error)}`,
    );
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
