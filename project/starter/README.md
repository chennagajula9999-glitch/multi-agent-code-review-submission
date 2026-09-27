# Multi-Agent Code Review System

A production-ready, multi-agent PR code review system built with the Claude Agent SDK. A main
orchestrator fetches pull request data via the GitHub MCP server, dispatches three specialized
subagents to analyze the changed files in parallel, and aggregates their findings into a validated,
structured report — output as JSON, Markdown, and HTML.

## Architecture
