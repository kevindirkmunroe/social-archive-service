import 'dotenv/config.js';
import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import axios from 'axios';
import pino from 'pino';


const S3_URL = process.env.S3_URL;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
const S3_REGION = process.env.S3_REGION;
const S3_MEDIA_BUCKET = process.env.S3_MEDIA_BUCKET;
const LOGGER = pino(  { timestamp: pino.stdTimeFunctions.isoTime});

const s3Client = new S3Client({
  endpoint: `https://${S3_URL}`,
  forcePathStyle: false,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  region: S3_REGION,
});

export const uploadMediaToS3 = async (mediaName, mediaUrl) => {
  const downloadFile = async (downloadUrl: string): Promise<any> => {
    return axios.get(downloadUrl, {
      responseType: 'stream',
    });
  };

  // March2024DinnerParty

  try {
    const responseStream = await downloadFile(mediaUrl);
    const result = await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_MEDIA_BUCKET,
        Key: `${mediaName}.jpg`,
        Body: responseStream.data,
        ContentType: 'img/jpeg',
      }),
    );
    LOGGER.info('Response obtained', result);
  } catch (error) {
    LOGGER.error(`[AWSService] Error in S3 upload: ${JSON.stringify(error)}`);
  }
};

export const deleteMediaFromS3 = async (imagesToDelete) => {
  const keyedImages = imagesToDelete.map((image) => {
    return {
      Key: image,
    };
  });

  const command = new DeleteObjectsCommand({
    Bucket: `${S3_MEDIA_BUCKET}`,
    Delete: {
      Objects: keyedImages,
    },
  });

  try {
    LOGGER.info(
      `[AWSService]  deleting items: ${JSON.stringify(
        keyedImages,
      )}`,
    );
    const { Deleted } = await s3Client.send(command);
    LOGGER.info(
      `[AWSService] Successfully deleted ${Deleted.length} objects from S3 bucket. Deleted objects:`,
    );
    LOGGER.info(Deleted.map((d) => ` • ${d.Key}`).join('\n'));
  } catch (err) {
    LOGGER.error(`[AWSService] delete error: ${err}`);
  }
};
