# llms.txt Design

## Overview

Add `llms.txt` (concise) and `llms-full.txt` (comprehensive) to the repo root, following the llms.txt convention. Target audience: LLMs helping developers integrate the MCP server and jsondb.cloud SDK.

## Files

### llms.txt

Quick orientation: what this is, install, config, tool list with one-line descriptions, pointer to llms-full.txt.

### llms-full.txt

Complete API reference: every tool with full parameters (name, type, required/optional), return formats, error codes, filter operators, code examples, plan limits.

## Source of Truth

All content extracted from `src/tools/*.ts` tool registrations and `README.md`.
