import {
    APIGatewayEvent,
    APIGatewayProxyResult,
    Context
} from 'aws-lambda';
import {
    SecretsManagerClient,
    GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import {
    SSMClient,
    GetParameterCommand,
} from '@aws-sdk/client-ssm'
import { getSignedCookies } from '@aws-sdk/cloudfront-signer';

interface Parameters {
    privateKey: string
    keyPairId: string
    cloudFrontDomain: string
}

const getParameters = async (): Promise<Parameters> => {
    const region = process.env.AWS_REGION;
    const secretsManagerClient = new SecretsManagerClient({region});
    const ssmClient = new SSMClient({region});

    const privateKeyName = process.env.PRIVATE_KEY_NAME;
    const keyPairIdName = process.env.CLOUDFRONT_KEY_PAIR_ID_NAME;
    const cloudFrontDomainName = process.env.CLOUDFRONT_DOMAIN_NAME;

    let privateKeyNameResponse;
    let keyPairIdResponse;
    let cloudFrontDomainResponse;

    try {
        privateKeyNameResponse = await secretsManagerClient.send(
            new GetSecretValueCommand({
                SecretId: privateKeyName,
                VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
            })
        );
        keyPairIdResponse = await ssmClient.send(
            new GetParameterCommand({
                Name: keyPairIdName,
            })
        );
        cloudFrontDomainResponse = await ssmClient.send(
            new GetParameterCommand({
                Name: cloudFrontDomainName,
            })
        );
    } catch (error) {
        console.log(error.message);
        // For a list of exceptions thrown, see
        // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
        throw error;
    }

    return {
        privateKey: privateKeyNameResponse.SecretString,
        keyPairId: keyPairIdResponse.Parameter.Value,
        cloudFrontDomain: cloudFrontDomainResponse.Parameter.Value,
    }
}

export const handler = async (event: APIGatewayEvent, context: Context) => {
    // eventからパラメータを取得
    const params = new URLSearchParams(event.body);

    // パラメータを配列からオブジェクトに変換
    const data = {};
    for (const [key, value] of params) {
        data[key] = value;
    }
    console.log(data);

    // TODO: 認証ロジックを作り込む
    if (data['password'] == '') {
        return {
            statusCode: 401,
            headers: {
                'Content-Type': 'text/html; charset=UTF-8',
            },
            body: '401 Unauthorized',
        };
    }

    const {privateKey, keyPairId, cloudFrontDomain} = await getParameters();

    // 現在の日付データを取得
    const date1 = new Date();

    // 1分後の日付データを作成
    date1.setTime(date1.getTime() + 60*1000);

    const cloudfrontDistributionDomain = `https://${cloudFrontDomain}`;
    // ワイルドカードで複数のファイルを見られるようにした
    const s3ObjectKey = "*";
    const url = `${cloudfrontDistributionDomain}/${s3ObjectKey}`;
    // UTC形式に変換して変数dateLessThanに格納する
    const dateLessThan = date1.toUTCString();
    // これを指定することでカスタムポリシーと解釈される
    const dateGreaterThan = "2000-01-01";

    const cookies = getSignedCookies({
        url,
        keyPairId,
        dateLessThan,
        dateGreaterThan,
        privateKey,
    });

    const body: string = `Set following cookies:</br>
    * CloudFront-Key-Pair-Id=${cookies['CloudFront-Key-Pair-Id']}</br>
    * CloudFront-Signature=${cookies['CloudFront-Signature']}</br>
    * CloudFront-Policy=${cookies['CloudFront-Policy']}
    `

    const result: APIGatewayProxyResult = {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/html; charset=UTF-8',
        },
        multiValueHeaders: {
            'Set-Cookie': [
                `CloudFront-Key-Pair-Id=${cookies['CloudFront-Key-Pair-Id']};expires=${dateLessThan};path=/`,
                `CloudFront-Signature=${cookies['CloudFront-Signature']};expires=${dateLessThan};path=/`,
                `CloudFront-Policy=${cookies['CloudFront-Policy']};expires=${dateLessThan};path=/`,
            ],
        },
        body: body,
    };

    return result;
};
