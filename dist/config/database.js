"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const pg_1 = require("pg");
const logger_1 = require("../utils/logger");
class Database {
    constructor() {
        this.pool = new pg_1.Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'wisereels',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
        });
        this.pool.on('error', (err) => {
            logger_1.logger.error('Unexpected error on idle client', err);
        });
    }
    async connect() {
        try {
            const client = await this.pool.connect();
            client.release();
            logger_1.logger.info('Database connected successfully');
        }
        catch (error) {
            logger_1.logger.error('Database connection failed', error);
            throw error;
        }
    }
    async query(text, params) {
        try {
            const result = await this.pool.query(text, params);
            return result.rows;
        }
        catch (error) {
            logger_1.logger.error('Database query error', { text, error });
            throw error;
        }
    }
    async queryOne(text, params) {
        const results = await this.query(text, params);
        return results.length > 0 ? results[0] : null;
    }
    async getClient() {
        return this.pool.connect();
    }
    async close() {
        await this.pool.end();
        logger_1.logger.info('Database connection closed');
    }
}
exports.db = new Database();
