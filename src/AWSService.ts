import 'dotenv/config.js';
import { Upload } from '@aws-sdk/lib-storage';
import { PassThrough } from 'stream';
import { S3Client } from '@aws-sdk/client-s3';
import axios from 'axios';

const S3_URL = process.env.S3_URL;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
const S3_REGION = process.env.S3_REGION;

const s3Client = new S3Client({
  endpoint: `https://${S3_URL}`,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  region: S3_REGION,
});
const MEDIA_BUCKET = process.env.S3_MEDIA_BUCKET;

export const uploadMediaToS3 = async (mediaName, mediaUrl) => {
  const stream = new PassThrough();
  const bucketName = `${MEDIA_BUCKET}`;
  const contentType = 'image/jpeg';
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketName,
      Key: `${mediaName}.jpg`,
      Body: stream,
      ContentType: contentType,
    },
  });

  let data = null;
  await axios
    .get(mediaUrl, {
      responseType: 'arraybuffer',
    })
    .then((response) => {
      data = response.data;
    });
  try {
    stream.write(data, (error) => {
      if (error) {
        console.log(`S3 Stream Write ERROR (1): ${error}`);
      }
    });
  } catch (error) {
    console.log(`S3 Stream Write ERROR (2): ${error}`);
  } finally {
    stream.end();
    await upload.done();
    console.log(`\n[SocialArchive] AWS S3 Upload complete: ${mediaUrl}`);
  }
};
