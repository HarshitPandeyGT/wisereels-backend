export interface User {
  id: string;
  username: string;
  full_name: string;
  bio?: string;
  avatar_url?: string;
  follower_count: number;
  following_count: number;
  expert_status: 'none' | 'pending' | 'verified';
  settings?: any;
  created_at: Date;
  updated_at: Date;
}
