import { MongoClient, ServerApiVersion } from 'mongodb';
import { GridFsStorage } from 'multer-gridfs-storage';
import * as multer from 'multer';
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

  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    await client.db(DB_NAME).createCollection(ROOT_COLLECTION);
    console.log(
      `\n[SocialArchive] MongoDB collection ${ROOT_COLLECTION} ready.\n`,
    );
  } catch (error) {
    if (!(error.codeName === 'NamespaceExists')) {
      console.log(
        `[SocialArchive] MongoDB init ERROR: ${JSON.stringify(error)}`,
      );
    } else {
      console.log(
        `\n[SocialArchive] MongoDB collection ${ROOT_COLLECTION} ready.\n`,
      );
    }
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

export async function insertPosts(
  userId: string,
  hashtag: string,
  posts: any[],
) {
  // Key: {userId, post.id}, Value: { post, ...hashtag }

  // Create a storage object with a given configuration
  const url = `${MONGO_DB_URI}/${DB_NAME}`;
  const storage = new GridFsStorage({
    url,
    file: (req, file) => {
      if (file.mimetype === 'image/jpeg') {
        return {
          bucketName: 'photos',
        };
      } else {
        return 'default-photos';
      }
    },
  });
  // Set multer storage engine to the newly created object
  const upload = multer({ storage });

  // console.log(
  //   `\n****\n****DEBUG: inserting posts:\n\n${JSON.stringify(posts)}`,
  // );
  const mongoDocs = [];
  posts.forEach((post) => {
    mongoDocs.push({ _id: post.id, userId, hashtag, ...post });
    if (post.attachments) {
      console.log(`image link=${JSON.stringify(post.attachments)}`);
      upload.single(post.attachments.data[0].media.image.src);
    }
  });

  const client = new MongoClient(MONGO_DB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  try {
    await client.connect();
    let count = 0;
    for (const doc of mongoDocs) {
      await client
        .db(DB_NAME)
        .collection(ROOT_COLLECTION)
        .replaceOne({ _id: doc._id }, doc, { upsert: true });
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
