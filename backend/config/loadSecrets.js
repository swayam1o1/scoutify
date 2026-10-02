const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function loadSecrets() {
  // Local development: use .env only (already loaded by dotenv in server.js)
  if (process.env.USE_AWS_SECRETS === 'false') {
    console.log('Skipping AWS Secrets Manager; using local .env');
    return;
  }

  try {
    const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-south-2' });
    const command = new GetSecretValueCommand({
      SecretId: process.env.AWS_SECRET_ID || 'scoutify/dev/backend-secrets'
    });
    const response = await client.send(command);
    const secrets = JSON.parse(response.SecretString);

    Object.keys(secrets).forEach((key) => {
      process.env[key] = secrets[key];
    });

    console.log('Loaded secrets from AWS Secrets Manager');
  } catch (err) {
    // On EC2 with IAM role this should succeed. Locally there are usually no AWS creds.
    if (process.env.USE_AWS_SECRETS === 'true') {
      throw err;
    }

    console.warn(
      'AWS Secrets Manager unavailable, falling back to local .env:',
      err.message
    );
  }
}

module.exports = loadSecrets;
