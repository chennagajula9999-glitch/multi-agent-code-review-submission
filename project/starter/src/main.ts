// src/main.ts

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { CodeReviewOrchestrator } from './orchestrator.js';
import {
  ReportGenerator,
  logReviewStart,
  logReviewComplete,
  logReviewError,
  formatError
} from './utils/index.js';

dotenv.config();

function printUsageAndExit(message: string): never {
  console.error(`❌ ${message}\n`);
  console.error('Usage: npm run dev -- <owner> <repo> <pr-number>');
  console.error('Example: npm run dev -- octocat Hello-World 1');
  process.exit(1);
}

function validateArgs(
  owner: string | undefined,
  repo: string | undefined,
  prStr: string | undefined
): { owner: string; repo: string; prNumber: number } {
  if (!owner || !repo || !prStr) {
    printUsageAndExit('Missing required arguments: owner, repo, and pr-number are all required.');
  }

  const prNumber = Number(prStr);

  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    printUsageAndExit(`Invalid PR number "${prStr}": must be a positive integer.`);
  }

  return { owner, repo, prNumber };
}

function validateAuth(): void {
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasAwsCreds = !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;

  if (hasAwsCreds) {
    if (!process.env.AWS_REGION) {
      printUsageAndExit('AWS credentials found but AWS_REGION is not set. Set AWS_REGION in your .env file.');
    }
    console.log('🔐 Using AWS Bedrock authentication');
    return;
  }

  if (hasAnthropicKey) {
    console.log('�� Using Anthropic API authentication');
    return;
  }

  printUsageAndExit(
    'No authentication configured. Set either:\n' +
      '  - ANTHROPIC_API_KEY (for the Anthropic API), or\n' +
      '  - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION (for AWS Bedrock)'
  );
}

function validateModel(): void {
  if (!process.env.ANTHROPIC_MODEL) {
    printUsageAndExit(
      'ANTHROPIC_MODEL environment variable is required. Examples:\n' +
        '  - Anthropic API: ANTHROPIC_MODEL=claude-sonnet-4-5-20250929\n' +
        '  - AWS Bedrock:   ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0'
    );
  }
}

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev <owner> <repo> <pr-number>
 */
async function main() {
  const [ownerArg, repoArg, prStrArg] = process.argv.slice(2);
  const { owner, repo, prNumber } = validateArgs(ownerArg, repoArg, prStrArg);

  validateAuth();
  validateModel();

  logReviewStart(owner, repo, prNumber);
  const startTime = Date.now();

  try {
    const orchestrator = new CodeReviewOrchestrator();
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    const reportGenerator = new ReportGenerator();
    const reportsDir = path.resolve(process.cwd(), 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });

    const baseName = `${owner}_${repo}_${prNumber}`;
    const jsonPath = path.join(reportsDir, `${baseName}.json`);
    const mdPath = path.join(reportsDir, `${baseName}.md`);
    const htmlPath = path.join(reportsDir, `${baseName}.html`);

    fs.writeFileSync(jsonPath, reportGenerator.generateJSONReport(report), 'utf-8');
    fs.writeFileSync(mdPath, reportGenerator.generateMarkdownReport(report), 'utf-8');
    fs.writeFileSync(htmlPath, reportGenerator.generateHTMLReport(report), 'utf-8');

    const duration = Date.now() - startTime;
    logReviewComplete(owner, repo, prNumber, report.summary.overallScore, duration);

    console.log(`\n✅ Review complete! Overall score: ${report.summary.overallScore}/100`);
    console.log('📄 Reports saved to:');
    console.log(`   - ${jsonPath}`);
    console.log(`   - ${mdPath}`);
    console.log(`   - ${htmlPath}`);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logReviewError(owner, repo, prNumber, err);
    console.error(`\n❌ Review failed: ${formatError(error)}`);
    process.exit(1);
  }
}

main();
