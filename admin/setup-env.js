#!/usr/bin/env node

/**
 * Setup script to copy environment variables from parent speech-app
 * 
 * Usage: node setup-env.js
 */

const fs = require('fs');
const path = require('path');

const parentEnvPath = path.join(__dirname, '..', '.env.local');
const adminEnvPath = path.join(__dirname, '.env.local');

console.log('🔧 Setting up admin environment variables...\n');

// Check if parent .env.local exists
if (!fs.existsSync(parentEnvPath)) {
  console.error('❌ Parent .env.local not found at:', parentEnvPath);
  console.error('   Please create it first in the speech-app directory');
  process.exit(1);
}

// Read parent env file
const parentEnv = fs.readFileSync(parentEnvPath, 'utf8');

// Extract required variables
const requiredVars = [
  'EXPO_PUBLIC_APPWRITE_ENDPOINT',
  'EXPO_PUBLIC_APPWRITE_PROJECT_ID',
  'APPWRITE_API_KEY',
  'EXPO_PUBLIC_APPWRITE_DATABASE_ID',
  'EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID',
  'EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID',
];

const envVars = {};
const lines = parentEnv.split('\n');

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=');
    if (key && value) {
      envVars[key.trim()] = value.trim();
    }
  }
}

// Check if all required variables are present
const missing = requiredVars.filter(v => !envVars[v]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables in parent .env.local:');
  missing.forEach(v => console.error(`   - ${v}`));
  process.exit(1);
}

// Create admin .env.local
let adminEnvContent = '# Appwrite Configuration (Auto-generated from parent)\n';
adminEnvContent += '# Last updated: ' + new Date().toISOString() + '\n\n';

requiredVars.forEach(varName => {
  adminEnvContent += `${varName}=${envVars[varName]}\n`;
});

fs.writeFileSync(adminEnvPath, adminEnvContent);

console.log('✅ Environment variables copied successfully!');
console.log('📝 Created:', adminEnvPath);
console.log('\n📋 Copied variables:');
requiredVars.forEach(v => {
  const value = envVars[v];
  const displayValue = v.includes('KEY') ? '***' : value;
  console.log(`   ✓ ${v}=${displayValue}`);
});

console.log('\n🚀 You can now run: npm run dev');
