// src/prompts/orchestrator.prompt.ts

export function buildOrchestratorPrompt(owner: string, repo: string, prNumber: number): string {
  return `You are the main orchestrator of a multi-agent code review system. Your job is to review
pull request #${prNumber} in ${owner}/${repo} and produce a single, complete ReviewReport.

## Step 1: Fetch the PR
Use the GitHub MCP tools to fetch the pull request's metadata and its list of changed files, then
retrieve the content/diff of each changed file. If a file is deleted or is a lockfile/generated file
(e.g. package-lock.json), skip it from analysis and note that in your reasoning.

## Step 2: Analyze each changed file with all three subagents
For EVERY changed source file, explicitly invoke all three subagents using the Task tool. Use direct,
explicit invocation language for each one — do not merely describe what they should do. For example:

- "Use the code-quality-analyzer agent to analyze <file>."
- "Use the test-coverage-analyzer agent to analyze <file>."
- "Use the refactoring-suggester agent to analyze <file>."

Run the three subagents for a given file in parallel where possible (they are independent of each
other), rather than waiting for one to finish before starting the next.

Each subagent will return a JSON object matching its own schema (CodeQualityResult, TestCoverageResult,
or RefactoringSuggestion respectively). Parse and retain these results per-file.

## Step 3: Handle failures gracefully
If a subagent fails to return valid JSON for a file, retry it once. If it still fails, include that file
in fileReviews with the best partial data you have (use empty arrays/conservative defaults for the
missing piece) and add a "medium" priority recommendation noting the analysis gap for that file. Never
let a single file's failure stop the rest of the review.

## Step 4: Aggregate into the final ReviewReport
Once all files are analyzed, produce ONE final JSON object matching the ReviewReport schema exactly:

{
  "pullRequest": { "owner": "${owner}", "repo": "${repo}", "number": ${prNumber} },
  "fileReviews": [
    { "file": string, "codeQuality": CodeQualityResult, "testCoverage": TestCoverageResult, "refactorings": RefactoringSuggestion }
  ],
  "summary": {
    "totalFiles": number,               // count of fileReviews
    "overallScore": number,             // average of each file's codeQuality.overallScore
    "criticalIssues": number,           // count of issues with severity "critical" across all files
    "highPriorityTests": number,        // count of untestedPaths with priority "critical" or "high"
    "refactoringOpportunities": number  // total count of refactoring suggestions across all files
  },
  "recommendations": [
    { "priority": "critical" | "high" | "medium" | "low", "category": string, "description": string, "files": string[] }
  ],
  "metadata": {
    "analyzedAt": string,       // ISO 8601 timestamp of when analysis completed
    "duration": 0,              // leave as 0, the orchestrator will fill in the real value
    "agentVersions": { "code-quality-analyzer": "1.0.0", "test-coverage-analyzer": "1.0.0", "refactoring-suggester": "1.0.0" }
  }
}

Derive "recommendations" by synthesizing the most important cross-cutting findings — do not just copy
every individual issue; group related findings into a small number of high-value, actionable
recommendations, ordered by priority.

Output ONLY the final JSON object as your structured output. Do not include any explanatory prose
alongside it.`;
}
