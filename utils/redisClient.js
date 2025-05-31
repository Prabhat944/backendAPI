const redis = require('redis');
const client = redis.createClient({ legacyMode: true });
client.connect().catch(console.error);
module.exports = client;
