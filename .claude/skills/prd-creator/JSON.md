# Implementation Task Generation Framework

This comprehensive guide provides a structured workflow for converting a completed PRD into actionable development tasks in JSON format.

## Core Purpose

The framework transforms feature specifications into verifiable implementation tasks that developers (human or AI) can execute systematically. It establishes a two-level hierarchy: a root task index and detailed specifications for each task.

## Workflow Overview

The process follows these checkpoints:
- Analyze the complete PRD document
- Generate task index in `PROJECT_ROOT/.agent/tasks.json`
- Generate detailed specs for each task in individual JSON files
- Present complete list to user for review

## Task Structure Requirements

**Root Index Format** (`tasks.json`):
Each entry contains: unique ID, descriptive title, category classification, path to specification file, and completion status (initially `false`).

**Individual Task Spec** (`TASK-${ID}.json`):
Comprehensive details including: description, verifiable acceptance criteria, sequential implementation steps, task dependencies, complexity estimation, and technical notes.

## Key Field Specifications

**Acceptance Criteria** must be specific, verifiable, independent, and collectively complete. They define what constitutes task completion.

**Steps** should be sequential, detailed, atomic, and trackable. Each step includes: number, brief description, comprehensive implementation details, and pass status.

**Dependencies** establish task ordering prerequisites. Use when tasks require functionality from others or build on shared data structures.

## Task Categories

Seven primary classifications organize work:

1. **functional** - Core feature implementation
2. **ui-ux** - User interface and experience
3. **data-model** - Database schemas and relationships
4. **api-endpoint** - Backend API routes and responses
5. **integration** - Third-party service connections
6. **security** - Authentication, authorization, and protection mechanisms
7. **documentation** - Technical guides and API references

## Critical Generation Principles

Initialize all tasks with `"passes": false`. Never mark tasks complete during generation. Break down features into small, manageable tasks. Ensure steps are verifiable through specific, measurable actions. Generate comprehensive coverage of entire PRD without truncating steps. Present tasks sequentially for user review, avoiding parallel processing or background agents.
