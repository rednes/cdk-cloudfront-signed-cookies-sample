import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export class S3 {
    public readonly bucket: s3.IBucket;
    public readonly authBucket: s3.IBucket;
    public readonly oai: cloudfront.OriginAccessIdentity;

    constructor(scope: Construct, props?: cdk.StackProps) {
        this.oai = new cloudfront.OriginAccessIdentity(scope, 's3-oai');

        this.bucket = new s3.Bucket(scope, 'web-host-s3', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
        });

        const bucketPolicy = new iam.PolicyStatement({
            actions: ['s3:GetObject'],
            effect: iam.Effect.ALLOW,
            principals: [
                new iam.CanonicalUserPrincipal(this.oai.cloudFrontOriginAccessIdentityS3CanonicalUserId)
            ],
            resources: [`${this.bucket.bucketArn}/*`],
        });
        this.bucket.addToResourcePolicy(bucketPolicy);

        new s3deploy.BucketDeployment(scope, 'deploy-s3', {
            sources: [s3deploy.Source.asset(path.join(__dirname, `./website/contents`))],
            destinationBucket: this.bucket,
            retainOnDelete: false,
        });

        this.authBucket = new s3.Bucket(scope, 'auth-s3', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
        });

        const authBucketPolicy = new iam.PolicyStatement({
            actions: ['s3:GetObject'],
            effect: iam.Effect.ALLOW,
            principals: [
                new iam.CanonicalUserPrincipal(this.oai.cloudFrontOriginAccessIdentityS3CanonicalUserId)
            ],
            resources: [`${this.authBucket.bucketArn}/*`],
        });
        this.authBucket.addToResourcePolicy(authBucketPolicy);

        new s3deploy.BucketDeployment(scope, 'deploy-auth-s3', {
            sources: [s3deploy.Source.asset(path.join(__dirname, `./website/auth`))],
            destinationBucket: this.authBucket,
            retainOnDelete: false,
        });
    }
}
