// src/orchestrator.ts

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { mcpServersConfig } from './config/mcp.config.js';
import { codeQualityAnalyzer, testCoverageAnalyzer, refactoringSuggester } from './agents/index.js';
import { buildOrchestratorPrompt } from './prompts/index.js';
import { ReviewReportSchema, ReviewReportJSONSchema } from './types/report-types.js';
import type { ReviewReport } from './types/report-types.js';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
  maxTurns?: number;
  model?: string;
}

/**
 * Main Code Review Orchestrator
 * Coordinates subagents to analyze pull requests and generate comprehensive reports
 */
export class CodeReviewOrchestrator {
  private readonly maxTurns: number;
  private readonly model?: string;

  constructor(options: OrchestratorOptions = {}) {
    this.maxTurns = options.maxTurns ?? 60;
    this.model = options.model ?? process.env.ANTHROPIC_MODEL;
  }

  /**
   * Review a pull request using parallel subagent analysis
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const startTime = Date.now();
    const prompt = buildOrchestratorPrompt(owner, repo, prNumber);

    const queryOptions: Options = {
      mcpServers: mcpServersConfig,
      agents: {
        'code-quality-analyzer': codeQualityAnalyzer,
        'test-coverage-analyzer': testCoverageAnalyzer,
        'refactoring-suggester': refactoringSuggester,
      },
      allowedTools: [
        'Task',
        'Read',
        'Grep',
        'Glob',
        'Skill',
        // MCP tools are namespaced as mcp__<serverName>__<toolName> once servers connect
        // (e.g. mcp__github__get_pull_request). Prefixes below auto-allow every tool each
        // server exposes. If your SDK version requires exact names instead of prefixes,
        // run once, check the 'system' init message's `tools` array in the logs, and list
        // the exact mcp__github__* / mcp__eslint__* names here.
        'mcp__github',
        'mcp__eslint',
      ],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: this.maxTurns,
      ...(this.model ? { model: this.model } : {}),
      outputFormat: {
        type: 'json_schema',
        schema: ReviewReportJSONSchema,
      },
    };

    let structuredOutput: unknown;
    let lastError: string | undefined;

    for await (const message of query({ prompt, options: queryOptions })) {
      this.logMessage(message);

      if (message.type === 'result') {
        if (message.subtype === 'success') {
          structuredOutput = message.structured_output;
        } else {
          lastError = `Agent run ended with ${message.subtype}: ${
            message.errors?.join('; ') ?? 'unknown error'
          }`;
        }
      }
    }

    if (structuredOutput === undefined) {
      throw new Error(
        lastError ?? 'Orchestrator finished without producing a structured_output.'
      );
    }

    const parsed = ReviewReportSchema.safeParse(structuredOutput);

    if (!parsed.success) {
      throw new Error(`Final report failed schema validation: ${parsed.error.message}`);
    }

    // Fill in the real duration — the model can't know this itself.
    return {
      ...parsed.data,
      metadata: {
        ...parsed.data.metadata,
        duration: Date.now() - startTime,
      },
    };
  }

  private logMessage(message: SDKMessage): void {
    if (message.type === 'system') {
      console.log('[orchestrator] MCP servers connected:', message);
    }
    if (message.type === 'result') {
      console.log('[orchestrator] Result:', message.subtype);
    }
  }
}
