#!/usr/bin/env node

/**
 * Quick Start Guide for WiseReels Backend
 * 
 * This script provides a checklist for getting started with the backend
 */

const fs = require('fs');
const path = require('path');

const steps = [
  {
    step: 1,
    title: 'Install Dependencies',
    command: 'npm install',
    description: 'Install all required Node packages'
  },
  {
    step: 2,
    title: 'Setup Environment',
    command: 'cp .env.example .env && nano .env',
    description: 'Create and configure environment variables'
  },
  {
    step: 3,
    title: 'Create Database',
    command: 'createdb wisereels',
    description: 'Create PostgreSQL database'
  },
  {
    step: 4,
    title: 'Run Database Schema',
    command: 'psql -U postgres -d wisereels -f database/schema.sql',
    description: 'Create all tables and indexes'
  },
  {
    step: 5,
    title: 'Start Redis',
    command: 'redis-server',
    description: 'Start Redis in background or new terminal'
  },
  {
    step: 6,
    title: 'Start Development Server',
    command: 'npm run dev',
    description: 'Run the server in development mode'
  },
  {
    step: 7,
    title: 'Test Server',
    command: 'curl http://localhost:3000/health',
    description: 'Verify server is running'
  },
];

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║         WiseReels Backend - Quick Start Guide              ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('📋 Setup Checklist:\n');

steps.forEach(item => {
  console.log(`${item.step}. ${item.title}`);
  console.log(`   Description: ${item.description}`);
  console.log(`   Command: $ ${item.command}`);
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════\n');

console.log('🧪 Test API Endpoints:\n');

const endpoints = [
  {
    method: 'POST',
    path: '/api/auth/register',
    body: '{"phoneNumber":"+919876543210","displayName":"TestUser"}',
    description: 'Register new user'
  },
  {
    method: 'GET',
    path: '/health',
    description: 'Check server health'
  },
];

endpoints.forEach(ep => {
  console.log(`${ep.method.padEnd(6)} ${ep.path}`);
  console.log(`      ${ep.description}`);
  if (ep.body) {
    console.log(`      Body: ${ep.body}`);
  }
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════\n');

console.log('📁 Project Structure:\n');
console.log(`src/
├── config/           (Database, Redis, JWT config)
├── services/         (Business logic)
├── controllers/      (Request handlers)
├── routes/          (API endpoints)
├── middleware/      (Auth, validation, errors)
├── utils/           (Helpers, logger, validators)
└── index.ts         (Server entry point)

database/
└── schema.sql       (PostgreSQL schema)

docs/
├── API_DOCUMENTATION.md
├── README_BACKEND.md
├── IMPLEMENTATION_GUIDE.md
└── WISEREELS_ARCHITECTURE.md
`);

console.log('═══════════════════════════════════════════════════════════\n');

console.log('💡 Useful Tips:\n');
console.log('• Use Postman to test API endpoints');
console.log('• Check logs in console for debugging');
console.log('• Update .env for different environments');
console.log('• Run tests with: npm test');
console.log('• Build for production: npm run build');
console.log('• Start production: npm start');

console.log('\n📚 Documentation:\n');
console.log('• API Docs: See API_DOCUMENTATION.md');
console.log('• Backend Setup: See README_BACKEND.md');
console.log('• Full Guide: See IMPLEMENTATION_GUIDE.md');
console.log('• Architecture: See WISEREELS_ARCHITECTURE.md');

console.log('\n═══════════════════════════════════════════════════════════\n');
console.log('Happy coding! 🎉\n');
