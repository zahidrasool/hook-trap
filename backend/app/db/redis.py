import redis.asyncio as aioredis

from app.config import get_settings


class RedisClient:
    def __init__(self):
        self._redis = None

    async def initialize(self):
        settings = get_settings()
        self._redis = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
        )

    async def close(self):
        if self._redis:
            await self._redis.close()

    @property
    def client(self):
        if self._redis is None:
            raise RuntimeError("Redis not initialized. Call initialize() first.")
        return self._redis

    async def publish(self, channel: str, message: str):
        await self.client.publish(channel, message)

    async def get(self, key: str):
        return await self.client.get(key)

    async def setex(self, key: str, seconds: int, value: str):
        await self.client.setex(key, seconds, value)


redis_client = RedisClient()
