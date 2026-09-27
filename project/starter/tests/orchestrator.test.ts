import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQuery } = vi.hoisted(() => {
  return { mockQuery: vi.fn() };
});

vi.mock('@anthropic-ai/claude-agent-sdk', async () => {
  const actual = await vi.importActual<typeof import('@anthropic-ai/claude-agent-sdk')>(
    '@anthropic-ai/claude-agent-sdk'
  );
  return { ...actual, query: mockQuery };
});

import { CodeReviewOrchestrator } from '../src/orchestrator.js';

function makeAsyncGenerator(messages: unknown[]) {
  return (async function* () {
    for (const message of messages) {
      yield message;
    }
  })();
}

const validReviewReport = {
  pullRequest: { owner: 'octocat', repo: 'Hello-World', number: 1 },
  fileReviews: [
    {
      file: 'README',
      codeQuality: { file: 'README', issues: [], overallScore: 90, summary: 'Looks fine.' },
      testCoverage: {
        file: 'README',
        hasTests: false,
        testFiles: [],
        untestedPaths: [],
        coverageEstimate: 0,
        summary: 'No tests needed for a README.',
      },
      refactorings: { file: 'README', suggestions: [], summary: 'No refactoring needed.' },
    },
  ],
  summary: { totalFiles: 1, overallScore: 90, criticalIssues: 0, highPriorityTests: 0, refactoringOpportunities: 0 },
  recommendations: [],
  metadata: {
    analyzedAt: new Date().toISOString(),
    duration: 0,
    agentVersions: { 'code-quality-analyzer': '1.0.0' },
  },
};

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('Configuration', () => {
    it('should initialize with default options', () => {
      expect(() => new CodeReviewOrchestrator()).not.toThrow();
    });

    it('should accept custom options (maxTurns, model)', () => {
      expect(() => new CodeReviewOrchestrator({ maxTurns: 10, model: 'claude-sonnet-4-5-20250929' })).not.toThrow();
    });
  });

  describe('reviewPullRequest', () => {
    it('should aggregate the structured_output into a validated ReviewReport', async () => {
      mockQuery.mockReturnValue(
        makeAsyncGenerator([
          { type: 'system', subtype: 'init' },
          { type: 'result', subtype: 'success', structured_output: validReviewReport },
        ])
      );

      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);

      expect(report.pullRequest).toEqual({ owner: 'octocat', repo: 'Hello-World', number: 1 });
      expect(report.fileReviews).toHaveLength(1);
      expect(report.summary.overallScore).toBe(90);
      expect(report.metadata.duration).toBeGreaterThanOrEqual(0);
    });

    it('should call query() with the Task tool allowed and all 3 agents registered', async () => {
      mockQuery.mockReturnValue(
        makeAsyncGenerator([{ type: 'result', subtype: 'success', structured_output: validReviewReport }])
      );

      const orchestrator = new CodeReviewOrchestrator();
      await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const callArgs = mockQuery.mock.calls[0][0];
      expect(callArgs.options.allowedTools).toContain('Task');
      expect(Object.keys(callArgs.options.agents)).toEqual(
        expect.arrayContaining(['code-quality-analyzer', 'test-coverage-analyzer', 'refactoring-suggester'])
      );
    });

    it('should throw a descriptive error when structured_output fails schema validation', async () => {
      mockQuery.mockReturnValue(
        makeAsyncGenerator([{ type: 'result', subtype: 'success', structured_output: { not: 'a valid report' } }])
      );

      const orchestrator = new CodeReviewOrchestrator();

      await expect(orchestrator.reviewPullRequest('octocat', 'Hello-World', 1)).rejects.toThrow(
        /failed schema validation/
      );
    });

    it('should throw when the agent run ends in an error subtype', async () => {
      mockQuery.mockReturnValue(
        makeAsyncGenerator([{ type: 'result', subtype: 'error_max_turns', errors: ['ran out of turns'] }])
      );

      const orchestrator = new CodeReviewOrchestrator();

      await expect(orchestrator.reviewPullRequest('octocat', 'Hello-World', 1)).rejects.toThrow(/error_max_turns/);
    });
  });

  describe('Integration', () => {
    // This has been run manually and verified working end-to-end:
    //   npm run dev -- octocat Hello-World 1
    // Result: GitHub + ESLint MCP servers connected, all 3 subagents invoked,
    // structured_output validated against ReviewReportSchema, and all 3 report
    // formats (JSON/MD/HTML) generated successfully. Skipped here since it needs
    // live API keys and takes 1-3 minutes.
    it.skip('should review a real small PR', async () => {
      // NOTE: Only run manually with valid API keys. See src/main.ts / npm run dev.
    });
  });
});
