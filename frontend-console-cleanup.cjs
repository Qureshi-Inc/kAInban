#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Patterns to remove (debug/info logs)
const removePatterns = [
  /^\s*console\.log\(['"`][^\[]*\[App\][^'"`]*['"`][^;]*\);?\s*$/gm,
  /^\s*console\.log\(['"`][^\[]*\[OpenAI\][^'"`]*['"`][^;]*\);?\s*$/gm,
  /^\s*console\.log\(['"`][^\[]*\[AnalyticsDashboard\][^'"`]*['"`][^;]*\);?\s*$/gm,
  /^\s*console\.log\(['"`][^\[]*\[Store\][^'"`]*['"`][^;]*\);?\s*$/gm,
  /^\s*console\.log\(['"`][^\[]*\[TaskDetailModal\][^'"`]*['"`][^;]*\);?\s*$/gm,
  /^\s*console\.log\(['"`][^\[]*\[Settings\][^'"`]*['"`][^;]*\);?\s*$/gm,
  /^\s*console\.log\(['"`][^\[]*\[AudioControls\][^'"`]*['"`][^;]*\);?\s*$/gm,
  /^\s*console\.log\(['"`][^\[]*\[PasteText\][^'"`]*['"`][^;]*\);?\s*$/gm,

  // Remove specific debug patterns
  /^\s*console\.log\(['"`].*Rendering\.\.\.['"`]\);?\s*$/gm,
  /^\s*console\.log\(['"`].*Window location:['"`][^;]*\);?\s*$/gm,
  /^\s*console\.log\(['"`].*Configuring OpenAI service['"`]\);?\s*$/gm,
  /^\s*console\.log\(['"`].*Backend initialization successful['"`]\);?\s*$/gm,
  /^\s*console\.log\(['"`].*Initialization returned undefined['"`]\);?\s*$/gm,
  /^\s*console\.log\(['"`].*Current database settings:['"`][^;]*\);?\s*$/gm,
  /^\s*console\.log\(['"`].*Environment variables:['"`][^;]*\);?\s*$/gm,
  /^\s*console\.log\(['"`].*Loaded from \.env:['"`][^;]*\);?\s*$/gm,
  /^\s*console\.log\(['"`].*Settings updated with \.env values['"`]\);?\s*$/gm,
  /^\s*console\.log\(['"`].*Component unmounting['"`]\);?\s*$/gm,
  /^\s*console\.log\(['"`].*Post-login initialization complete['"`]\);?\s*$/gm,
  /^\s*console\.log\(['"`].*Selected Project ID:['"`][^;]*\);?\s*$/gm,
  /^\s*console\.log\(['"`].*Validating config\.\.\.['"`'][^;]*\);?\s*$/gm,
  /^\s*console\.log\(['"`].*Configured:['"`'][^;]*\);?\s*$/gm,

  // Remove object/data logging patterns
  /^\s*console\.log\([^'"]*\{[^}]*hasEndpoint:[^}]*\}[^;]*\);?\s*$/gm,
  /^\s*console\.log\([^'"]*\{[^}]*baseUrl:[^}]*\}[^;]*\);?\s*$/gm,
];

// Patterns to keep (errors, warnings, important info)
const keepPatterns = [
  /console\.error/,
  /console\.warn/,
  /console\.info.*error/i,
  /console\.info.*warning/i,
  /console\.info.*failed/i,
];

function shouldKeepLine(line) {
  return keepPatterns.some(pattern => pattern.test(line));
}

function cleanupFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let cleanedContent = content;
  let removedCount = 0;

  // Apply removal patterns
  for (const pattern of removePatterns) {
    const matches = cleanedContent.match(pattern) || [];
    if (matches.length > 0) {
      // Check each match to see if we should keep it
      const linesToRemove = matches.filter(match => !shouldKeepLine(match));
      removedCount += linesToRemove.length;

      // Remove the lines
      for (const lineToRemove of linesToRemove) {
        cleanedContent = cleanedContent.replace(lineToRemove, '');
      }
    }
  }

  // Clean up extra blank lines
  cleanedContent = cleanedContent.replace(/\n\n\n+/g, '\n\n');

  if (removedCount > 0) {
    fs.writeFileSync(filePath, cleanedContent);
    console.log(`✓ ${path.basename(filePath)}: Removed ${removedCount} debug logs`);
  }

  return removedCount;
}

function findJSFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      files.push(...findJSFiles(fullPath));
    } else if (item.endsWith('.js') || item.endsWith('.jsx')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Main execution
const srcDir = path.join(__dirname, 'src');
const jsFiles = findJSFiles(srcDir);

console.log(`🧹 Frontend Console Cleanup`);
console.log(`📁 Scanning ${jsFiles.length} JS/JSX files...`);

let totalRemoved = 0;
let filesModified = 0;

for (const file of jsFiles) {
  const removed = cleanupFile(file);
  if (removed > 0) {
    filesModified++;
    totalRemoved += removed;
  }
}

console.log(`\n✅ Cleanup Complete!`);
console.log(`📊 Files modified: ${filesModified}`);
console.log(`🗑️  Debug logs removed: ${totalRemoved}`);

if (totalRemoved > 0) {
  console.log(`\n⚠️  Note: Error logs and warnings were preserved`);
}