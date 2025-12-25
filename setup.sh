#!/bin/bash

# WiseReels Backend Setup Script
# This script sets up the development environment

set -e

echo "🚀 WiseReels Backend Setup"
echo "=========================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js >= 16"
    exit 1
fi

echo "✓ Node.js $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm"
    exit 1
fi

echo "✓ npm $(npm -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL is not installed. Please install PostgreSQL to use the database"
else
    echo "✓ PostgreSQL installed"
    
    # Create database if it doesn't exist
    echo ""
    echo "🗄️  Setting up PostgreSQL database..."
    
    if psql -U postgres -lqt | cut -d \| -f 1 | grep -qw wisereels; then
        echo "ℹ️  Database 'wisereels' already exists"
    else
        echo "Creating database 'wisereels'..."
        createdb -U postgres wisereels
        echo "✓ Database created"
    fi
    
    # Run schema
    echo "Setting up schema..."
    psql -U postgres -d wisereels -f database/schema.sql
    echo "✓ Schema created"
fi

# Check if Redis is installed
if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Redis is not installed. Please install Redis for caching"
else
    echo "✓ Redis installed"
fi

# Copy .env if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✓ .env created (please update with your configuration)"
else
    echo "ℹ️  .env file already exists"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update .env file with your configuration"
echo "2. Start PostgreSQL: brew services start postgresql"
echo "3. Start Redis: brew services start redis"
echo "4. Run development server: npm run dev"
echo ""
echo "Happy coding! 🎉"
