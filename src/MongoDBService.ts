import { MongoClient, ServerApiVersion } from 'mongodb';

const username = encodeURIComponent('SocialArchive');
const password = encodeURIComponent('M1ll10nD0llar1dea');
const DB_NAME = 'Cluster0';
const ROOT_COLLECTION = 'SocialArchive';
const uri = `mongodb+srv://${username}:${password}@cluster0.pkkfyis.mongodb.net/?retryWrites=true&w=majority`;

export async function mongoDBInit() {
  const client = new MongoClient(uri, {
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

  const mongoDocs = [];
  posts.forEach((post) => {
    mongoDocs.push({ _id: post.id, userId, hashtag, ...post });
  });

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  try {
    // Connect the client to the server	(optional starting in v4.7)
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
  const client = new MongoClient(uri, {
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
