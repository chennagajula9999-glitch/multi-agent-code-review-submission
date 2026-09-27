// src/agents/code-quality-analyzer.ts

import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt.js';

export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Analyzes a source code file for security vulnerabilities, performance issues, and ' +
    'maintainability concerns. Use this agent whenever a changed file needs a code quality review, ' +
    'especially before merging or after significant logic changes.',
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  model: 'inherit',
};
