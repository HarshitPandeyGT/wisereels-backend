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
  settings JSONB DEFAULT '{}',
  account_status VARCHAR(20) DEFAULT 'ACTIVE',
  account_created_at TIMESTAMP NOT NULL DEFAULT NOW(),
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
  created_at TIMESTAMP NOT NULL
);

-- Expert Verification
CREATE TABLE IF NOT EXISTS expert_applications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  status VARCHAR(10) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes TEXT,
  created_at TIMESTAMP NOT NULL,
  reviewed_at TIMESTAMP
);

-- Watch Heartbeat & Rewards
CREATE TABLE IF NOT EXISTS video_heartbeats (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  seconds_watched INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL
);

-- Wallet & Ledger
CREATE TABLE IF NOT EXISTS wallet (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pending_balance BIGINT DEFAULT 0,
  available_balance BIGINT DEFAULT 0,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('earn', 'redeem', 'transfer')),
  amount BIGINT NOT NULL,
  video_id UUID REFERENCES videos(id),
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
