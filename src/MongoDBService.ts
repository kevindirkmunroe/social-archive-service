import { MongoClient, ServerApiVersion } from 'mongodb';
import { uploadMediaToS3 } from './AWSService';
const username = encodeURIComponent('SocialArchive');
const password = encodeURIComponent('M1ll10nD0llar1dea');
const DB_NAME = 'Cluster0';
const ROOT_COLLECTION = 'SocialArchive';
const MONGO_DB_URI = `mongodb+srv://${username}:${password}@cluster0.pkkfyis.mongodb.net/?retryWrites=true&w=majority`;

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
      console.log(`[SocialArchive] MongoDB collection ${collection} ready.`);
    } catch (error) {
      if (!(error.codeName === 'NamespaceExists')) {
        console.log(
          `[SocialArchive] MongoDB init ERROR: ${JSON.stringify(error)}`,
        );
      } else {
        console.log(
          `\n[SocialArchive] MongoDB collection ${collection} ready.`,
        );
      }
    }
  }
  // Ensures that the client will close when you finish/error
  await client.close();
}

export async function insertPosts(
  userId: string,
  hashtag: string,
  posts: any[],
) {
  // Key: {userId, post.id}, Value: { post, ...hashtag }

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
    console.log(`[MongoDBService] ERROR ${JSON.stringify(error)}`);
  }

  //
  // Build up docs to insert
  //
  const mongoDocs = [];
  posts.forEach((post) => {
    mongoDocs.push({ _id: post.id, userId, hashtag, ...post });
    if (post.attachments) {
      console.log(`image link=${JSON.stringify(post.attachments)}`);
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
        console.log(
          `ATTACHMENT FOUND for ${doc.id}: ${doc.attachments.data[0].media.image.src}`,
        );
        await uploadMediaToS3(doc._id, doc.attachments.data[0].media.image.src);
      } else {
        await uploadMediaToS3(
          doc._id,
          `https://bronze-giant-social-archive.s3.us-west-1.amazonaws.com/default/facebook-3-128.jpg`,
        );
      }
      count++;
    }
    console.log(`\n[SocialArchive] Upserted ${count} posts.\n`);
  } catch (error) {
    console.log(
      `[SocialArchive] MongoDB insert ERROR: ${JSON.stringify(error)}`,
    );
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

export async function getPosts(userId: string, hashtag: string) {
  const client = new MongoClient(MONGO_DB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const query = { userId: userId, hashtag: hashtag };
    const results = await client
      .db(DB_NAME)
      .collection(ROOT_COLLECTION)
      .find(query)
      .toArray();

    console.log(`\n[SocialArchive] Got ${results.length} posts.\n`);
    return results;
  } catch (error) {
    console.log(`[SocialArchive] MongoDB get ERROR: ${JSON.stringify(error)}`);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
