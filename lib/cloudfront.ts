import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

interface CloudFrontProps extends cdk.StackProps{
    bucket: s3.IBucket;
    authBucket: s3.IBucket;
    oai: cloudfront.OriginAccessIdentity;
    authApi: apigw.RestApi;
}

export class CloudFront{
    constructor(scope: Construct, props: CloudFrontProps) {
        // CloudFront KeyGroup
        const publicKeyString = ssm.StringParameter.valueForStringParameter(scope, 'get-signed-cookies-sample-public-key');
        const publicKey = new cloudfront.PublicKey(scope, 'get-signed-cookies-sample-public-key', {
            encodedKey: publicKeyString,
        });
        const keyGroup = new cloudfront.KeyGroup(scope, 'key-group', {
            items: [
                publicKey,
            ],
        });

        // CloudFront Custom Origin Request Policy
        const authOriginRequestPolicy = new cloudfront.OriginRequestPolicy(scope, 'auth-origin-request-policy', {
            cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
            headerBehavior: cloudfront.OriginRequestHeaderBehavior.none(),
            queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.none(),
        });

        // Create a Cloudfront distribution
        const distribution = new cloudfront.Distribution(scope, 'cloudfront-distribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(props.bucket, {
                    originAccessIdentity: props.oai,
                    originPath: '/',
                }),
                cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                trustedKeyGroups: [
                    keyGroup,
                ],
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            additionalBehaviors: {
                'auth/*': {
                    origin: new origins.S3Origin(props.authBucket, {
                        originAccessIdentity: props.oai,
                        originPath: '/',
                    }),
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                },
                'auth-api/*': {
                    origin: new origins.RestApiOrigin(props.authApi),
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: authOriginRequestPolicy,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                },
            },
            defaultRootObject: 'index.html',
            priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
        });

        new ssm.StringParameter(scope, 'cloudfront-key-pair-id-parameter', {
            parameterName: '/get-signed-cookies-sample/CLOUDFRONT_KEY_PAIR_ID',
            stringValue: publicKey.publicKeyId,
        });
        new ssm.StringParameter(scope, 'cloudfront-domain-parameter', {
            parameterName: '/get-signed-cookies-sample/CLOUDFRONT_DOMAIN',
            stringValue: distribution.distributionDomainName,
        });

        new cdk.CfnOutput(scope, 'distribution-domain-name', {
            value: `https://${distribution.distributionDomainName}`,
        });
    }
}
