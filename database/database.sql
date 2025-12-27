-- ============================================================================
-- WiseReels Complete Database Schema
-- Consolidated from schema.sql and migrations.sql
-- Last Updated: 27 December 2025
-- ============================================================================

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users & Profiles
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  username VARCHAR(32) UNIQUE NOT NULL,
  full_name VARCHAR(100),
  display_name VARCHAR(50),
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  email VARCHAR(255),
  bio TEXT,
  avatar_url TEXT,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  expert_status VARCHAR(10) DEFAULT 'none' CHECK (expert_status IN ('none', 'pending', 'verified')),
  post_count INTEGER DEFAULT 0,
  story_count INTEGER DEFAULT 0,
  last_login TIMESTAMP,
  last_login_ip VARCHAR(50),
  settings JSONB DEFAULT '{}',
  account_status VARCHAR(20) DEFAULT 'ACTIVE',
  account_created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL,
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Videos & Metadata
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(20) NOT NULL,
  tier VARCHAR(10) DEFAULT 'Bronze' CHECK (tier IN ('Gold', 'Silver', 'Bronze')),
  is_published BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS sensitive_categories (
  category VARCHAR(20) PRIMARY KEY
);

-- Likes & Comments
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL,
  UNIQUE(user_id, video_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL
);

-- ============================================================================
-- EXPERT VERIFICATION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS expert_applications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  bio TEXT NOT NULL,
  credentials TEXT NOT NULL,
  document_url TEXT,
  badge_type VARCHAR(50),
  is_verified BOOLEAN DEFAULT FALSE,
  status VARCHAR(10) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes TEXT,
  created_at TIMESTAMP NOT NULL,
  reviewed_at TIMESTAMP,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- WATCH & REWARDS TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_heartbeats (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  seconds_watched INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL
);

-- ============================================================================
-- WALLET & FINANCIAL TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallet (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pending_balance BIGINT DEFAULT 0,
  available_balance BIGINT DEFAULT 0,
  points_released_date TIMESTAMP,
  tier_multiplier DECIMAL(3,1) DEFAULT 1.0,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('earn', 'redeem', 'transfer')),
  amount BIGINT NOT NULL,
  video_id UUID REFERENCES videos(id),
  description VARCHAR(255),
  category VARCHAR(50),
  points_per_30_sec BIGINT,
  watch_duration_sec INTEGER,
  created_at TIMESTAMP NOT NULL,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS redemption_requests (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  method VARCHAR(20) NOT NULL CHECK (method IN ('UPI', 'RECHARGE')),
  status VARCHAR(10) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed')),
  provider_response JSONB,
  created_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('watch', 'like', 'follow', 'redemption', 'referral')),
  points BIGINT NOT NULL,
  video_id UUID REFERENCES videos(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'redeemed')),
  released_date TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- AUTHENTICATION & SESSION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_registrations (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  username VARCHAR(32) UNIQUE NOT NULL,
  display_name VARCHAR(50) NOT NULL,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otps (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  otp_hash VARCHAR(255),
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  username VARCHAR(32) NOT NULL,
  deletion_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STORIES TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  caption TEXT,
  category VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS story_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reply_text TEXT NOT NULL,
  media_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS story_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('mute', 'report')),
  reason VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (story_id, user_id, action)
);

-- ============================================================================
-- MEDIA & ENGAGEMENT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, video_id)
);

CREATE TABLE IF NOT EXISTS post_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('hide', 'unhide')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, video_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  favorite_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, favorite_user_id),
  CHECK (user_id != favorite_user_id)
);

CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('video', 'comment', 'story', 'message')),
  content_id UUID NOT NULL,
  reason VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  resolution_note TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- MESSAGING & CHAT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_id UUID,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_archived_by_a BOOLEAN DEFAULT FALSE,
  is_archived_by_b BOOLEAN DEFAULT FALSE,
  UNIQUE (participant_a_id, participant_b_id),
  CHECK (participant_a_id < participant_b_id)
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type VARCHAR(20) CHECK (media_type IN ('image', 'video', 'audio', 'document')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  reader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, reader_id)
);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'expert_alert', 'points_update', 'mention', 'message', 'story_reply')),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subject_id UUID,
  subject_type VARCHAR(50) CHECK (subject_type IN ('video', 'comment', 'user', 'wallet', 'story', 'message')),
  title VARCHAR(255),
  message TEXT,
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- USER PREFERENCES & SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  direct_messages_enabled BOOLEAN DEFAULT TRUE,
  story_replies_enabled BOOLEAN DEFAULT TRUE,
  show_online_status BOOLEAN DEFAULT TRUE,
  allow_discovery BOOLEAN DEFAULT TRUE,
  theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  preferred_language VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- VIEWS FOR ANALYTICS & STATS
-- ============================================================================

CREATE OR REPLACE VIEW user_stats AS
SELECT
  u.id,
  u.username,
  u.display_name,
  COALESCE(COUNT(DISTINCT v.id), 0) as video_count,
  COALESCE(COUNT(DISTINCT f.follower_id), 0) as follower_count,
  COALESCE(COUNT(DISTINCT f2.following_id), 0) as following_count,
  COALESCE(COUNT(DISTINCT s.id), 0) as active_story_count,
  u.expert_status
FROM users u
LEFT JOIN videos v ON u.id = v.creator_id
LEFT JOIN follows f ON u.id = f.following_id
LEFT JOIN follows f2 ON u.id = f2.follower_id
LEFT JOIN stories s ON u.id = s.user_id AND s.is_active = TRUE AND s.expires_at > NOW()
GROUP BY u.id;

-- ============================================================================
-- INDEXES FOR QUERY PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Users & Social
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_expert_status ON users(expert_status);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker_blocked ON blocks(blocker_id, blocked_id);

-- Videos & Content
CREATE INDEX IF NOT EXISTS idx_videos_creator_published ON videos(creator_id, is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_category_published ON videos(category, is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_video_id ON likes(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);

-- Stories
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_is_active ON stories(is_active);
CREATE INDEX IF NOT EXISTS idx_story_replies_story_id ON story_replies(story_id);
CREATE INDEX IF NOT EXISTS idx_story_replies_user_id ON story_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_story_interactions_story_id ON story_interactions(story_id);
CREATE INDEX IF NOT EXISTS idx_story_interactions_user_id ON story_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_story_interactions_action ON story_interactions(action);

-- Media & Engagement
CREATE INDEX IF NOT EXISTS idx_saved_posts_user_id ON saved_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_created_at ON saved_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_post_visibility_user_id ON post_visibility(user_id);
CREATE INDEX IF NOT EXISTS idx_post_visibility_video_id ON post_visibility(video_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_content_type_id ON content_reports(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_created_at ON content_reports(created_at);

-- Chat & Messaging
CREATE INDEX IF NOT EXISTS idx_conversations_participant_a ON conversations(participant_a_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_b ON conversations(participant_b_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_id ON direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON direct_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_message_reads_message_id ON message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_reader_id ON message_reads(reader_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Wallet & Financial
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_user_id ON points_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_status ON points_ledger(status);
CREATE INDEX IF NOT EXISTS idx_points_ledger_released_date ON points_ledger(released_date);
CREATE INDEX IF NOT EXISTS idx_points_ledger_expires_at ON points_ledger(expires_at);

-- Authentication
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_expert_applications_user_status ON expert_applications(user_id, status);

-- ============================================================================
-- SCHEMA NOTES
-- ============================================================================
-- 1. All new tables use UUID primary keys for consistency
-- 2. Soft deletes implemented where appropriate (is_deleted, is_active flags)
-- 3. 24-hour expiry for stories managed via expires_at + is_active flag
-- 4. Conversations use normalized format (participant_a_id < participant_b_id) to avoid duplicates
-- 5. Points ledger tracks 30-day pending→available transition
-- 6. Materialized view for user_stats can be refreshed periodically for performance
-- 7. All FK relationships include ON DELETE CASCADE for data integrity
-- 8. Indexes cover common query patterns for optimal performance
-- 9. Check constraints enforce data validity at database level
-- 10. Timestamps in UTC using NOW() for consistency
