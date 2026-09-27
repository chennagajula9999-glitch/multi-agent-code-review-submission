// src/agents/test-coverage-analyzer.ts

import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt.js';

export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Evaluates test completeness for a source file by comparing it against existing test files, ' +
    'identifies untested functions/branches/edge-cases, and suggests specific test cases. Use this ' +
    'agent whenever a changed file needs a test coverage assessment.',
  tools: ['Read', 'Grep', 'Glob'],
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  model: 'inherit',
};
