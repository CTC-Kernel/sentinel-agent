#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';

async function findFiles(dir, extensions) {
  const files = [];
  
  async function traverse(currentDir) {
    const entries = await readdir(currentDir);
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory() && !entry.includes('node_modules') && !entry.includes('dist')) {
        await traverse(fullPath);
      } else if (stats.isFile() && extensions.includes(extname(entry))) {
        files.push(fullPath);
      }
    }
  }
  
  await traverse(dir);
  return files;
}

async function main() {
  const files = await findFiles('src', ['.ts', '.tsx']);
  let totalRemoved = 0;

  files.forEach(filePath => {
    try {
      const content = readFileSync(filePath, 'utf8');
      
      // Remove console.log, console.warn, console.error but keep console.table for debugging
      const cleanedContent = content.replace(
        /console\.(log|warn|error)\([^)]*\);?\s*/g,
        ''
      );
      
      // Remove empty lines that might result from removal
      const finalContent = cleanedContent.replace(/\n\s*\n\s*\n/g, '\n\n');
      
      if (content !== finalContent) {
        writeFileSync(filePath, finalContent);
        const removed = (content.match(/console\.(log|warn|error)\([^)]*\)/g) || []).length;
        totalRemoved += removed;
        console.log(`✅ Cleaned ${filePath}: removed ${removed} console statements`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  });

  console.log(`\n🎯 Total console statements removed: ${totalRemoved}`);

  if (totalRemoved > 0) {
    console.log('📝 Running lint to fix formatting...');
    try {
      execSync('npm run lint:fix', { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️  Lint fix failed, but console logs were removed');
    }
  }
}

main().catch(console.error);
