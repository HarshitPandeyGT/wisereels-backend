"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = exports.UserService = void 0;
const database_1 = require("../config/database");
class UserService {
    async getUserById(userId) {
        return database_1.db.queryOne('SELECT * FROM users WHERE id = $1', [userId]);
    }
    async getUserByUsername(username) {
        return database_1.db.queryOne('SELECT * FROM users WHERE username = $1', [username]);
    }
    async updateUserProfile(userId, fields) {
        const updates = [];
        const values = [];
        let idx = 1;
        for (const key of Object.keys(fields)) {
            updates.push(`${key} = $${idx++}`);
            values.push(fields[key]);
        }
        updates.push(`updated_at = $${idx}`);
        values.push(new Date());
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx + 1} RETURNING *`;
        values.push(userId);
        const updated = await database_1.db.queryOne(query, values);
        if (!updated)
            throw new Error('Profile update failed');
        return updated;
    }
}
exports.UserService = UserService;
exports.userService = new UserService();
