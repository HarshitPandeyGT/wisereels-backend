"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const redis_1 = require("redis");
const logger_1 = require("../utils/logger");
class RedisClient {
    constructor() {
        this.client = null;
    }
    async connect() {
        try {
            this.client = (0, redis_1.createClient)({
                socket: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379'),
                },
                password: process.env.REDIS_PASSWORD || undefined,
            });
            await this.client.connect();
            logger_1.logger.info('Redis connected successfully');
        }
        catch (error) {
            logger_1.logger.error('Redis connection failed', error);
            throw error;
        }
    }
    async get(key) {
        if (!this.client)
            throw new Error('Redis not connected');
        return await this.client.get(key);
    }
    async set(key, value, expirySeconds) {
        if (!this.client)
            throw new Error('Redis not connected');
        if (expirySeconds) {
            await this.client.setEx(key, expirySeconds, value);
        }
        else {
            await this.client.set(key, value);
        }
    }
    async del(key) {
        if (!this.client)
            throw new Error('Redis not connected');
        await this.client.del(key);
    }
    async incr(key) {
        if (!this.client)
            throw new Error('Redis not connected');
        return await this.client.incr(key);
    }
    async close() {
        if (this.client) {
            await this.client.quit();
            logger_1.logger.info('Redis connection closed');
        }
    }
}
exports.redis = new RedisClient();
