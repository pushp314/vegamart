# Repository Recovery Playbook

Version: 1.0

Status:
Mandatory

This document MUST be followed before implementing any new feature.

No feature implementation is allowed until the recovery workflow is completed.

---

# Objective

The current repository already contains a significant amount of implementation.

However,

existing implementation does NOT imply correct implementation.

The goal is NOT to rewrite the repository.

The goal is to recover, stabilize and simplify the repository.

Every modification must improve

• Maintainability

• Readability

• Performance

• Security

• Testability

without changing business behaviour.

---

# Recovery Principles

Always

Recover

before

Implement.

Always

Refactor

before

Rewrite.

Always

Reuse

before

Create.

Always

Delete

before

Duplicate.

---

# Recovery Workflow

Every task must follow these phases.

Repository Audit

↓

Dependency Analysis

↓

Architecture Analysis

↓

Duplicate Detection

↓

Dead Code Detection

↓

Business Validation

↓

Recovery Plan

↓

Implementation

↓

Testing

↓

Documentation

---

# Phase 1

Repository Audit

The AI must inspect

Backend

Frontend

Database

Tests

Documentation

The audit answers

What exists?

What works?

What is incomplete?

What is duplicated?

What is obsolete?

What is experimental?

What violates architecture?

Nothing should be modified yet.

---

# Phase 2

Dependency Analysis

Inspect

package.json

imports

exports

module usage

unused dependencies

unused files

unused utilities

unused services

unused repositories

unused hooks

unused contexts

unused components

Output

Dependency Graph

Unused File Report

Unused Package Report

---

# Phase 3

Architecture Analysis

Review architecture.

Controllers

Services

Repositories

Validators

Routes

Utilities

Middlewares

Config

Database

Every module receives

Healthy

Needs Refactor

Needs Rewrite

Deprecated

---

# Phase 4

Duplicate Detection

Search entire repository.

Examples

Duplicate services

Duplicate validators

Duplicate APIs

Duplicate DTOs

Duplicate utility methods

Duplicate repositories

Duplicate hooks

Duplicate React components

Duplicate business logic

Every duplicate must be documented.

Never delete immediately.

---

# Phase 5

Dead Code Detection

Identify

Unused imports

Unused exports

Unused routes

Unused controllers

Unused services

Unused repositories

Unused pages

Unused components

Unused migrations

Unused Prisma models

Unused enums

Unused npm packages

Unused tests

Unused documentation

Each item

Keep

Remove

Merge

Refactor

---

# Phase 6

Business Validation

Compare implementation against

Approved Requirement Document

Every feature becomes

Approved

Extra

Missing

Incomplete

Broken

Only Approved features may remain.

---

# Recovery Decision Matrix

Every file receives one label.

KEEP

The implementation is correct.

REFACTOR

Logic is correct.

Code quality is poor.

MERGE

Multiple implementations exist.

REMOVE

Unused.

Deprecated.

Outside project scope.

REWRITE

Fundamental architectural issue.

---

# Recovery Rules

Never delete immediately.

Instead

Document

Reason

Replacement

Migration

Risk

Only then remove.

---

# Recovery Report

Every recovery task produces

/recovery/

AUDIT.md

DEPENDENCIES.md

DUPLICATES.md

DEAD_CODE.md

FEATURE_MATRIX.md

RECOVERY_PLAN.md

IMPLEMENTATION_LOG.md

---

# Implementation Rules

After recovery

Only modify files related to current feature.

Never modify unrelated modules.

If another module requires changes

Document it.

Do not modify it automatically.

---

# Existing Code Policy

Before writing

Search repository.

If similar code exists

Reuse it.

If reusable with refactoring

Refactor it.

If obsolete

Replace it.

Never create parallel implementations.

---

# Refactoring Policy

Refactoring should preserve behaviour.

Allowed

Rename

Extract methods

Extract classes

Split services

Improve validation

Improve error handling

Improve typing

Improve logging

Improve tests

Improve documentation

Not Allowed

Business behaviour changes

API breaking changes

Database breaking changes

without explicit approval.

---

# Deletion Policy

Delete

Unused components

Unused pages

Unused routes

Unused services

Unused repositories

Unused validators

Unused hooks

Unused utilities

Unused migrations

Unused models

Unused enums

Unused packages

Never comment code.

Delete it.

Git already stores history.

---

# Naming Standard

One business concept

One implementation

Examples

GOOD

OrderService

BAD

OrderManager

OrderHelper

OrderUtility

OrderProcessor

OrderEngine

Only one implementation.

---

# Recovery Acceptance Criteria

Recovery phase completes only when

No duplicate services

No duplicate repositories

No duplicate validators

No duplicate APIs

No duplicate components

No duplicate hooks

No dead routes

No dead pages

No dead imports

No dead exports

No unused packages

No architecture violations

Business requirements synchronized

Tests passing

TypeScript passing

ESLint passing

Documentation updated

Only then may the repository proceed to feature implementation.

---

# Golden Rule

Every new feature should make the repository simpler than it was before.

If complexity increases,

the implementation is considered a failure.