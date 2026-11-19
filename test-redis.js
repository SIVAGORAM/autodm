import Redis from "ioredis";

const redis = new Redis(
  "rediss://default:gQAAAAAAATG5AAIncDJkMjM4ZmJkYjg3ZDk0MWU4YmU0ZDJiMzY3YThjNWViMXAyNzgyNjU@allowing-grackle-78265.upstash.io:6379"
);

async function test() {
  await redis.set("test", "hello");
  const value = await redis.get("test");
  console.log("Redis Value:", value);
  process.exit(0);
}

test();