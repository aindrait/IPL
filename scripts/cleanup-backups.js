#!/usr/bin/env node

/**
 * Script untuk membersihkan file backup setelah migration
 */

const fs = require('fs');
const path = require('path');

// Function untuk mencari file backup secara recursive
function findBackupFiles(dir) {
  let files = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules dan .git
        if (item !== 'node_modules' && item !== '.git' && item !== '.next') {
          files = files.concat(findBackupFiles(fullPath));
        }
      } else if (stat.isFile() && item.endsWith('.backup')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return files;
}

// Function untuk menghapus file backup
function deleteBackupFile(filePath) {
  try {
    fs.unlinkSync(filePath);
    console.log(`Deleted: ${filePath}`);
  } catch (error) {
    console.error(`Error deleting ${filePath}:`, error.message);
  }
}

// Main execution
function main() {
  console.log('Starting backup cleanup...');
  
  const srcDir = path.join(__dirname, '..', 'src');
  const backupFiles = findBackupFiles(srcDir);
  
  console.log(`Found ${backupFiles.length} backup files to delete`);
  
  if (backupFiles.length === 0) {
    console.log('No backup files found');
    return;
  }
  
  // Ask for confirmation
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question(`Are you sure you want to delete ${backupFiles.length} backup files? (y/N): `, (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      backupFiles.forEach(deleteBackupFile);
      console.log('Backup cleanup completed!');
    } else {
      console.log('Backup cleanup cancelled');
    }
    rl.close();
  });
}

if (require.main === module) {
  main();
}
