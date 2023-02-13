import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { S3 } from './s3';
import { CloudFront } from './cloudfront';
import { AuthApi } from './auth-api';

export class CdkCloudfrontSignedCookiesSampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const s3 = new S3(this, props);

    const authApi = new AuthApi(this, props);

    new CloudFront(this, {
      bucket: s3.bucket,
      authBucket: s3.authBucket,
      oai: s3.oai,
      authApi: authApi.api,
      ...props,
    });
  }
}
