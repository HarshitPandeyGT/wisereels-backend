import { db } from '../config/database';
import { User } from '../models/user.model';

export class UserService {
  async getUserById(userId: string): Promise<User | null> {
    return db.queryOne<User>('SELECT * FROM users WHERE id = $1', [userId]);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return db.queryOne<User>('SELECT * FROM users WHERE username = $1', [username]);
  }

  async updateUserProfile(userId: string, fields: Partial<User>): Promise<User> {
    const updates = [];
    const values = [];
    let idx = 1;
    for (const key of Object.keys(fields)) {
      updates.push(`${key} = $${idx++}`);
      values.push((fields as any)[key]);
    }
    updates.push(`updated_at = $${idx}`);
    values.push(new Date());
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx + 1} RETURNING *`;
    values.push(userId);
    const updated = await db.queryOne<User>(query, values);
    if (!updated) throw new Error('Profile update failed');
    return updated;
  }
}

export const userService = new UserService();
