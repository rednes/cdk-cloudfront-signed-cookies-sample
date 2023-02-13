#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkCloudfrontSignedCookiesSampleStack } from '../lib/cdk-cloudfront-signed-cookies-sample-stack';

const app = new cdk.App();
new CdkCloudfrontSignedCookiesSampleStack(app, 'CdkCloudfrontSignedCookiesSampleStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION
    },
});