// src/agents/refactoring-suggester.ts

import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt.js';

export const refactoringSuggester: AgentDefinition = {
  description:
    'Identifies structural and stylistic improvement opportunities in a source file — extract-method ' +
    'candidates, modernization, simplification, and design pattern improvements. Use this agent whenever ' +
    'a changed file should be reviewed for refactoring opportunities, independent of correctness issues.',
  tools: ['Read', 'Grep', 'Glob'],
  prompt: REFACTORING_SUGGESTER_PROMPT,
  model: 'inherit',
};
