import IFacebookPayload from './IFacebookPayload';

export class FacebookPayloadDto implements IFacebookPayload {
  readonly id: string;
  readonly userName: string;
  readonly accessToken: string;
  readonly hashtag: string;
  readonly oldestYear: number;
}
