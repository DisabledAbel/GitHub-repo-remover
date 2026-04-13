#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const DOC_URL = 'https://docs.github.com/en/repositories/creating-and-managing-repositories/restoring-a-deleted-repository';
const ROOT = process.cwd();
const TARGETS = [
  {
    file: 'app.js',
    pattern: /const RESTORE_DAYS = \d+;/,
    replacement: (days) => `const RESTORE_DAYS = ${days};`
  },
  {
    file: 'README.md',
    pattern: /- Enforced restore window: \d+ days/,
    replacement: (days) => `- Enforced restore window: ${days} days`
  },
  {
    file: 'app.js',
    pattern: /Added to \d+-day restore queue\./,
    replacement: (days) => `Added to ${days}-day restore queue.`
  }
];

function parseDaysFromHtml(html) {
  const phraseMatch = html.match(/restore[^.]{0,120}within\s+(\d+)\s+days/i);
  if (phraseMatch) return Number(phraseMatch[1]);

  const genericMatch = html.match(/(\d+)\s+days/i);
  if (genericMatch) return Number(genericMatch[1]);

  throw new Error('Could not find restore-days value in GitHub documentation response.');
}

async function fetchRestoreDays() {
  const res = await fetch(DOC_URL, {
    headers: {
      'User-Agent': 'github-repo-remover-restore-days-checker'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch docs (HTTP ${res.status}).`);
  }

  const html = await res.text();
  const days = parseDaysFromHtml(html);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw new Error(`Parsed restore-days value is invalid: ${days}`);
  }

  return days;
}

function applyUpdates(days) {
  let changedFiles = 0;

  for (const target of TARGETS) {
    const filePath = path.join(ROOT, target.file);
    const original = fs.readFileSync(filePath, 'utf8');
    const updated = original.replace(target.pattern, target.replacement(days));

    if (updated !== original) {
      fs.writeFileSync(filePath, updated, 'utf8');
      changedFiles += 1;
      console.log(`Updated ${target.file}`);
    }
  }

  return changedFiles;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const daysArgIndex = process.argv.indexOf('--days');
  const daysFromArg = daysArgIndex > -1 ? Number(process.argv[daysArgIndex + 1]) : null;
  const days = Number.isInteger(daysFromArg) && daysFromArg > 0 ? daysFromArg : await fetchRestoreDays();
  console.log(`Detected GitHub restore window: ${days} days`);

  if (dryRun) {
    process.exit(0);
  }

  const changedFiles = applyUpdates(days);
  if (changedFiles === 0) {
    console.log('No updates needed.');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
