const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function loadSecrets() {
  const client = new SecretsManagerClient({ region: 'ap-south-2' });
  const command = new GetSecretValueCommand({ SecretId: 'scoutify/dev/backend-secrets' });
  const response = await client.send(command);
  const secrets = JSON.parse(response.SecretString);

  Object.keys(secrets).forEach((key) => {
    process.env[key] = secrets[key];
  });
}

module.exports = loadSecrets;
