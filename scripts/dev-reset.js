#!/usr/bin/env node

/**
 * Development reset script to handle common dev issues
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔧 Resetting development environment...');

// Clean dist directories
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  console.log('🧹 Cleaning dist directory...');
  fs.rmSync(distPath, { recursive: true, force: true });
}

// Rebuild everything
console.log('🔨 Building project...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build completed successfully');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

console.log('🚀 Ready for development!');
console.log('Run: npm run dev:devvit');
