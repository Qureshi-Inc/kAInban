#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Patterns to remove (debug/verbose logging)
const REMOVE_PATTERNS = [
  /console\.log\([^)]*\[.*?\].*?(?:Starting|Calling|Found|Loading|Saving|Updated|Added|Deleted|Success|Complete|Processing|Analyzing|Generated|Extracted|Cached|Restored|✓|✗)[^)]*\)/g,
  /console\.log\([^)]*\[.*?\].*?(?:tasks?|projects?|meetings?|insights?|cache|auth|store|database)[^)]*\)/gi,
  /console\.log\([^)]*(?:projectsVersion|analytics|cache|debug|verbose)[^)]*\)/gi,
  // Remove analytics console logs specifically
  /console\.log\('\[AnalyticsDashboard\][^']*'\)/g,
  /console\.log\('\[Analytics\][^']*'\)/g,
  /console\.log\('\[Store\][^']*'\)/g,
  /console\.log\('\[TaskDetailModal\][^']*'\)/g,
  /console\.log\('\[Database\][^']*'\)/g,
  // Remove repetitive state logging
  /console\.log\([^)]*(?:state|projects|tasks|meetings)\.length[^)]*\)/gi,
  /console\.log\([^)]*(?:current|last|found|loading|loaded)[^)]*\)/gi
]

// Keep patterns (important logs we want to preserve)
const KEEP_PATTERNS = [
  /console\.error/,
  /console\.warn/,
  /console\.log.*(?:error|Error|ERROR)/,
  /console\.log.*(?:failed|Failed|FAILED)/,
  /console\.log.*(?:Migration|migration)/,
  /console\.log.*(?:Server|PORT|listening)/,
  /console\.log.*(?:Created storage directory)/,
  /console\.log.*(?:Database.*Initialized)/
]

function shouldKeepLog(line) {
  return KEEP_PATTERNS.some(pattern => pattern.test(line))
}

function cleanupFile(filePath) {
  console.log(`Cleaning up: ${filePath}`)

  let content = fs.readFileSync(filePath, 'utf8')
  let originalLength = content.length
  let removedLines = 0

  // Split into lines for better control
  let lines = content.split('\n')
  let cleanedLines = []

  for (let line of lines) {
    let shouldRemove = false

    // Check if this line should be kept first
    if (shouldKeepLog(line)) {
      cleanedLines.push(line)
      continue
    }

    // Check if this line matches removal patterns
    for (let pattern of REMOVE_PATTERNS) {
      if (pattern.test(line)) {
        console.log(`  Removing: ${line.trim()}`)
        shouldRemove = true
        removedLines++
        break
      }
    }

    if (!shouldRemove) {
      cleanedLines.push(line)
    }
  }

  let cleanedContent = cleanedLines.join('\n')

  if (cleanedContent !== content) {
    fs.writeFileSync(filePath, cleanedContent)
  } else {
    console.log(`  No changes needed in ${filePath}`)
  }
}

function findFilesToClean(dir, extensions = ['.js', '.jsx']) {
  let files = []

  function walkDir(currentPath) {
    const items = fs.readdirSync(currentPath)

    for (const item of items) {
      const fullPath = path.join(currentPath, item)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        // Skip node_modules and other unwanted directories
        if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
          walkDir(fullPath)
        }
      } else if (stat.isFile()) {
        const ext = path.extname(item)
        if (extensions.includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  }

  walkDir(dir)
  return files
}

// Main execution

const filesToClean = findFilesToClean(__dirname)

for (const file of filesToClean) {
  try {
    cleanupFile(file)
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message)
  }
}
