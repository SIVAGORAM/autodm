const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("Set REDIS_URL before running this connectivity check.");
}

const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });

async function test() {
  try {
    await redis.connect();
    console.log("Redis ping:", await redis.ping());
  } finally {
    await redis.quit();
  }
}

test().catch((error) => {
  console.error("Redis connectivity check failed:", error.message);
  process.exitCode = 1;
});
