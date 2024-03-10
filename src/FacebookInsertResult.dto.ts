import IFacebookInsertResult from './IFacebookInsertResult';

export class FacebookInsertResultDto implements IFacebookInsertResult {
  readonly count: number;
  readonly shareKey: string;
}
