import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdanodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class AuthApi {
    public readonly api: apigw.RestApi;

    constructor(scope: Construct, props?: cdk.StackProps) {
        const privateKeySecret = secretsmanager.Secret.fromSecretNameV2(scope, 'get-signed-cookies-sample-private-key', 'get-signed-cookies-sample-private-key');
        const getSignedCookiesFunction = new lambdanodejs.NodejsFunction(scope, 'get-signed-cookies-lambda', {
            entry: path.join(__dirname, './function/src/index.ts'),
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'handler',
            logRetention: logs.RetentionDays.ONE_WEEK,
            environment: {
                'PRIVATE_KEY_NAME': privateKeySecret.secretName,
                'CLOUDFRONT_KEY_PAIR_ID_NAME': '/get-signed-cookies-sample/CLOUDFRONT_KEY_PAIR_ID',
                'CLOUDFRONT_DOMAIN_NAME': '/get-signed-cookies-sample/CLOUDFRONT_DOMAIN',
            },
        });
        privateKeySecret.grantRead(getSignedCookiesFunction);
        getSignedCookiesFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['ssm:GetParameter'],
            effect: iam.Effect.ALLOW,
            resources: [
                `arn:aws:ssm:${props?.env?.region}:${props?.env?.account}:parameter/get-signed-cookies-sample/CLOUDFRONT_KEY_PAIR_ID`,
                `arn:aws:ssm:${props?.env?.region}:${props?.env?.account}:parameter/get-signed-cookies-sample/CLOUDFRONT_DOMAIN`,
            ],
        }));

        const getSignedCookiesIntegration = new apigw.LambdaIntegration(getSignedCookiesFunction);

        this.api = new apigw.RestApi(scope, 'auth-api', {});
        this.api.root.addResource('auth-api').addResource('get-signed-cookies').addMethod('POST', getSignedCookiesIntegration);
    }
}
