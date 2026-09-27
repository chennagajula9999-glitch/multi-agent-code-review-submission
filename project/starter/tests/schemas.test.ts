import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  CodeQualityResultSchema,
  TestCoverageResultSchema,
  RefactoringSuggestionSchema,
  CodeQualityResultJSONSchema,
  TestCoverageResultJSONSchema,
  RefactoringSuggestionJSONSchema,
} from '../src/types/analysis-results.js';
import { ReviewReportSchema, ReviewReportJSONSchema } from '../src/types/report-types.js';

describe('CodeQualityResultSchema', () => {
  const validResult = {
    file: 'src/example.ts',
    issues: [
      {
        line: 10,
        severity: 'high' as const,
        category: 'security' as const,
        description: 'Unsanitized input passed to eval()',
        suggestion: 'Remove eval() and parse input safely',
      },
    ],
    overallScore: 72,
    summary: 'A few notable issues found.',
  };

  it('accepts valid data', () => {
    expect(() => CodeQualityResultSchema.parse(validResult)).not.toThrow();
  });

  it('accepts an empty issues array', () => {
    expect(() => CodeQualityResultSchema.parse({ ...validResult, issues: [] })).not.toThrow();
  });

  it('accepts boundary scores of 0 and 100', () => {
    expect(() => CodeQualityResultSchema.parse({ ...validResult, overallScore: 0 })).not.toThrow();
    expect(() => CodeQualityResultSchema.parse({ ...validResult, overallScore: 100 })).not.toThrow();
  });

  it('rejects a score above 100', () => {
    expect(() => CodeQualityResultSchema.parse({ ...validResult, overallScore: 101 })).toThrow(ZodError);
  });

  it('rejects a score below 0', () => {
    expect(() => CodeQualityResultSchema.parse({ ...validResult, overallScore: -1 })).toThrow(ZodError);
  });

  it('rejects an invalid severity enum value', () => {
    const invalid = { ...validResult, issues: [{ ...validResult.issues[0], severity: 'catastrophic' }] };
    expect(() => CodeQualityResultSchema.parse(invalid)).toThrow(ZodError);
  });

  it('rejects an invalid category enum value', () => {
    const invalid = { ...validResult, issues: [{ ...validResult.issues[0], category: 'not-a-category' }] };
    expect(() => CodeQualityResultSchema.parse(invalid)).toThrow(ZodError);
  });

  it('rejects missing required fields', () => {
    const { summary, ...missingSummary } = validResult;
    expect(() => CodeQualityResultSchema.parse(missingSummary)).toThrow(ZodError);
  });

  it('rejects wrong types', () => {
    expect(() => CodeQualityResultSchema.parse({ ...validResult, overallScore: 'ninety' })).toThrow(ZodError);
  });
});

describe('TestCoverageResultSchema', () => {
  const validResult = {
    file: 'src/example.ts',
    hasTests: true,
    testFiles: ['src/example.test.ts'],
    untestedPaths: [
      {
        type: 'branch' as const,
        location: 'line 42',
        priority: 'high' as const,
        reasoning: 'Error branch is never exercised',
        suggestedTest: 'Test that an invalid input throws',
      },
    ],
    coverageEstimate: 65,
    summary: 'Reasonable coverage with one gap.',
  };

  it('accepts valid data', () => {
    expect(() => TestCoverageResultSchema.parse(validResult)).not.toThrow();
  });

  it('accepts empty testFiles and untestedPaths arrays', () => {
    expect(() =>
      TestCoverageResultSchema.parse({ ...validResult, testFiles: [], untestedPaths: [] })
    ).not.toThrow();
  });

  it('accepts boundary coverage of 0 and 100', () => {
    expect(() => TestCoverageResultSchema.parse({ ...validResult, coverageEstimate: 0 })).not.toThrow();
    expect(() => TestCoverageResultSchema.parse({ ...validResult, coverageEstimate: 100 })).not.toThrow();
  });

  it('rejects coverage outside 0-100', () => {
    expect(() => TestCoverageResultSchema.parse({ ...validResult, coverageEstimate: 150 })).toThrow(ZodError);
  });

  it('rejects an invalid untestedPaths type enum value', () => {
    const invalid = { ...validResult, untestedPaths: [{ ...validResult.untestedPaths[0], type: 'method' }] };
    expect(() => TestCoverageResultSchema.parse(invalid)).toThrow(ZodError);
  });

  it('rejects a non-boolean hasTests', () => {
    expect(() => TestCoverageResultSchema.parse({ ...validResult, hasTests: 'yes' })).toThrow(ZodError);
  });
});

describe('RefactoringSuggestionSchema', () => {
  const validResult = {
    file: 'src/example.ts',
    suggestions: [
      {
        type: 'extract-function' as const,
        location: 'processData()',
        impact: 'medium' as const,
        description: 'Function does too much',
        before: 'function processData() { /* 80 lines */ }',
        after: 'function processData() { validate(); transform(); save(); }',
        benefits: 'Improved readability and testability',
      },
    ],
    summary: 'One extraction opportunity found.',
  };

  it('accepts valid data', () => {
    expect(() => RefactoringSuggestionSchema.parse(validResult)).not.toThrow();
  });

  it('accepts an empty suggestions array', () => {
    expect(() => RefactoringSuggestionSchema.parse({ ...validResult, suggestions: [] })).not.toThrow();
  });

  it('rejects an invalid suggestion type enum value', () => {
    const invalid = { ...validResult, suggestions: [{ ...validResult.suggestions[0], type: 'delete-everything' }] };
    expect(() => RefactoringSuggestionSchema.parse(invalid)).toThrow(ZodError);
  });

  it('rejects an invalid impact enum value', () => {
    const invalid = { ...validResult, suggestions: [{ ...validResult.suggestions[0], impact: 'catastrophic' }] };
    expect(() => RefactoringSuggestionSchema.parse(invalid)).toThrow(ZodError);
  });
});

describe('ReviewReportSchema', () => {
  const validReport = {
    pullRequest: { owner: 'octocat', repo: 'Hello-World', number: 1 },
    fileReviews: [
      {
        file: 'README',
        codeQuality: { file: 'README', issues: [], overallScore: 80, summary: 'Fine.' },
        testCoverage: {
          file: 'README',
          hasTests: false,
          testFiles: [],
          untestedPaths: [],
          coverageEstimate: 0,
          summary: 'N/A',
        },
        refactorings: { file: 'README', suggestions: [], summary: 'N/A' },
      },
    ],
    summary: {
      totalFiles: 1,
      overallScore: 80,
      criticalIssues: 0,
      highPriorityTests: 0,
      refactoringOpportunities: 0,
    },
    recommendations: [
      { priority: 'medium' as const, category: 'Documentation', description: 'Improve formatting', files: ['README'] },
    ],
    metadata: {
      analyzedAt: new Date().toISOString(),
      duration: 1000,
      agentVersions: { 'code-quality-analyzer': '1.0.0' },
    },
  };

  it('accepts valid data', () => {
    expect(() => ReviewReportSchema.parse(validReport)).not.toThrow();
  });

  it('accepts empty fileReviews and recommendations arrays', () => {
    expect(() =>
      ReviewReportSchema.parse({ ...validReport, fileReviews: [], recommendations: [] })
    ).not.toThrow();
  });

  it('rejects an invalid recommendation priority', () => {
    const invalid = { ...validReport, recommendations: [{ ...validReport.recommendations[0], priority: 'urgent' }] };
    expect(() => ReviewReportSchema.parse(invalid)).toThrow(ZodError);
  });

  it('rejects a missing pullRequest field', () => {
    const { pullRequest, ...missing } = validReport;
    expect(() => ReviewReportSchema.parse(missing)).toThrow(ZodError);
  });

  it('rejects a nested fileReviews entry with invalid codeQuality', () => {
    const invalid = {
      ...validReport,
      fileReviews: [
        { ...validReport.fileReviews[0], codeQuality: { ...validReport.fileReviews[0].codeQuality, overallScore: 999 } },
      ],
    };
    expect(() => ReviewReportSchema.parse(invalid)).toThrow(ZodError);
  });
});

describe('JSON Schema export for structured outputs', () => {
  it('exports a valid, non-empty JSON schema object for CodeQualityResult', () => {
    expect(CodeQualityResultJSONSchema).toBeTypeOf('object');
    expect(Object.keys(CodeQualityResultJSONSchema).length).toBeGreaterThan(0);
  });

  it('exports a valid, non-empty JSON schema object for TestCoverageResult', () => {
    expect(TestCoverageResultJSONSchema).toBeTypeOf('object');
    expect(Object.keys(TestCoverageResultJSONSchema).length).toBeGreaterThan(0);
  });

  it('exports a valid, non-empty JSON schema object for RefactoringSuggestion', () => {
    expect(RefactoringSuggestionJSONSchema).toBeTypeOf('object');
    expect(Object.keys(RefactoringSuggestionJSONSchema).length).toBeGreaterThan(0);
  });

  it('exports a valid JSON schema for ReviewReport with required properties marked', () => {
    const schema = ReviewReportJSONSchema as Record<string, any>;
    expect(schema.properties).toBeDefined();
    expect(schema.properties.pullRequest).toBeDefined();
    expect(schema.properties.fileReviews).toBeDefined();
    expect(schema.properties.summary).toBeDefined();
    expect(schema.required).toEqual(
      expect.arrayContaining(['pullRequest', 'fileReviews', 'summary', 'recommendations', 'metadata'])
    );
  });
});
