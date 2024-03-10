import ISharedHashtag from './ISharedHashtag';

export class SharedHashtagDto implements ISharedHashtag {
  readonly userName: string;
  readonly userId: string;
  readonly hashtag: string;
}
