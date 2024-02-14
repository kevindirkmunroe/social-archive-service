import { Upload } from '@aws-sdk/lib-storage';
import { PassThrough } from 'stream';
import { S3Client } from '@aws-sdk/client-s3';
import axios from 'axios';

const S3_URL = `s3.us-west-1.amazonaws.com`;
const S3_ACCESS_KEY = `AKIA6ODU6YSMY2643QXQ`;
const S3_SECRET_KEY = `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`;
const S3_REGION = `us-west-1`;

const s3Client = new S3Client({
  endpoint: `https://${S3_URL}`,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  region: S3_REGION,
});
const MEDIA_BUCKET = 'bronze-giant-social-archive';

export const uploadMediaToS3 = async (
  mediaName,
  mediaUrl,
  socialMediaSource,
) => {
  const stream = new PassThrough();
  const bucketName = `s3://${MEDIA_BUCKET}/${socialMediaSource}`;
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketName,
      Key: mediaName,
      Body: stream,
    },
  });

  console.log(`\nS3 bucket: ${bucketName}`);

  let data = null;
  await axios.get(mediaUrl).then((response) => {
    data = response.data;
  });
  try {
    stream.write(data, (error) => {
      console.log(`S3 Stream Write ERROR: ${error}`);
    });
  } catch (error) {
    console.log(`S3 ERROR: ${error}`);
  }

  stream.end();
  await upload.done();
  console.log(`[SocialArchive] ${mediaUrl} AWS S3 Upload complete`);
};
