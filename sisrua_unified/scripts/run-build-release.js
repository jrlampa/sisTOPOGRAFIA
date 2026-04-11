#!/usr/bin/env node

/**
 * Cross-platform build release runner
 * Automatically selects PowerShell (Windows) or Bash (Unix) script
 * 
 * Item 30: Scripts de Build Duplicados - Agora com suporte cross-platform
 */

const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const isWindows = os.platform() === 'win32';
const scriptsDir = path.join(__dirname);

console.log(`\n📦 Building for platform: ${os.platform()}\n`);

try {
  if (isWindows) {
    console.log('Using PowerShell script (Windows)...\n');
    const psScript = path.join(scriptsDir, 'build_release.ps1');
    const cmd = `powershell -ExecutionPolicy Bypass -File "${psScript}"`;
    execSync(cmd, { stdio: 'inherit' });
  } else {
    console.log('Using Bash script (Unix/Linux/macOS)...\n');
    const bashScript = path.join(scriptsDir, 'build_release.sh');
    
    // Make script executable
    fs.chmodSync(bashScript, '0755');
    
    const cmd = `bash "${bashScript}"`;
    execSync(cmd, { stdio: 'inherit' });
  }
  
  console.log('\n✅ Build completed successfully!\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Build failed!\n');
  process.exit(1);
}
