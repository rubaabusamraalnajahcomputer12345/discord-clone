<!--
Sync Impact Report
Version change: [TEMPLATE] → 1.0.0
Modified principles: N/A (initial ratification)
Added sections:
  - Core Principles: I. Simplicity First, II. Real-Time Correctness,
    III. Type Safety End-to-End, IV. Security Basics,
    V. Incremental Delivery, VI. Testable Seams
  - Development Constraints (SECTION_2)
  - Development Workflow (SECTION_3)
  - Governance
Removed sections: none (all placeholder tokens resolved)
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (no changes needed — Constitution
    Check gate already reads from this file generically)
  - .specify/templates/spec-template.md ✅ (no changes needed — generic)
  - .specify/templates/tasks-template.md ✅ (no changes needed — generic)
  - .claude/skills/speckit-*/* ✅ (reviewed, no agent-specific references
    requiring updates)
Follow-up TODOs:
  - TODO(RATIFICATION_DATE): original adoption date not supplied by user;
    set to today's date as the effective ratification date since this is
    the first authored version of the constitution.
-->

# Discord Clone Constitution
<!-- Student-built real-time chat and video application -->

## Core Principles

### I. Simplicity First
Prefer the smallest solution that satisfies the spec. No speculative
abstractions, no design patterns introduced "just in case," and no
libraries or dependencies beyond those named in the implementation plan.
If a task can be solved with a function, it MUST NOT become a class,
factory, or plugin system. Any deviation (a new dependency, a new layer
of indirection) MUST be justified in the plan's Complexity Tracking table
before it is written.
**Rationale**: As a student project, the biggest risk is not missing
features but unmaintainable complexity. Every abstraction has a learning
and maintenance cost that must be paid back by demonstrated need.

### II. Real-Time Correctness
The UI MUST reflect server state via reactive subscriptions (e.g.
live queries/websocket-driven updates). Manual polling, "refresh"
buttons, or full page reloads to see new data are NOT permitted for
any feature that involves live data (messages, presence, call state).
If the underlying platform cannot push updates, the feature is
incomplete, not fine-as-is.
**Rationale**: Chat and video are inherently live experiences; stale UI
that requires a refresh breaks the core value proposition of the app.

### III. Type Safety End-to-End
TypeScript strict mode is enabled and enforced across the entire
codebase — client, server, and shared code. `any` is not permitted
except where required by a third-party type declaration gap and
localized behind a clearly named boundary. All database reads and
writes MUST go through typed schema definitions (generated or
hand-written types tied to the schema); raw untyped queries or
untyped payloads crossing the client/server boundary are prohibited.
**Rationale**: End-to-end types catch schema drift and integration bugs
at compile time, which matters most when the team is learning the
domain and cannot rely on tribal knowledge to avoid mistakes.

### IV. Security Basics
Every backend function MUST validate that the caller is authenticated
before doing any work, and MUST verify the caller is authorized for the
specific resource being read or mutated (e.g. channel membership, message
ownership, call participancy). There is no "trusted client" — all
authorization checks happen server-side, never solely in UI logic.
**Rationale**: A chat/video app handles other users' messages and media;
skipping authorization checks turns a class project into a data-leak
liability even at small scale.

### V. Incremental Delivery
The application MUST build and run successfully after each user story is
completed. The main branch MUST NOT be left in a broken (non-building,
non-running) state at any commit boundary. Work lands story-by-story, and
each story is a working increment — not a partial slice that depends on
a future story to become functional.
**Rationale**: Small, working increments let the team demo progress at any
point and prevent the common student-project failure mode of a long-lived
broken branch that never gets integrated.

### VI. Testable Seams
Business logic MUST be separated from UI rendering so it can be tested
without a browser (e.g. message formatting, permission checks, call
state transitions live outside components/pages). Critical user flows —
at minimum sending a message and joining a call — MUST have at least one
smoke test that exercises the real seam, not a mock of it.
**Rationale**: Without this separation, regressions in core flows are only
caught by manual clicking, which does not scale as the app grows.

## Development Constraints

- **Stack discipline**: Only dependencies explicitly named in an
  approved implementation plan may be added; introducing a new library
  mid-implementation requires updating the plan first.
- **Schema-first data access**: All persistent data access is mediated
  by generated or explicitly maintained schema types; no ad-hoc queries
  that bypass the schema layer.
- **No silent auth bypass**: Authorization logic MUST NOT be duplicated
  ad hoc per function; shared, testable authorization helpers are
  preferred once more than one function needs the same check.

## Development Workflow

- **Definition of done per story**: implemented, builds cleanly under
  strict TypeScript, passes the smoke test(s) for any critical flow it
  touches, and leaves main in a running state.
- **Review checklist**: every change is checked against Simplicity First
  (no unjustified new abstractions/dependencies), Real-Time Correctness
  (no polling/refresh introduced), and Security Basics (auth + authorization
  checks present) before merge.
- **Complexity justification**: any exception to a principle is recorded
  in the relevant plan's Complexity Tracking table with the specific
  reason simpler alternatives were rejected.

## Governance

This constitution supersedes any conflicting practice, template default,
or convenience shortcut. Amendments require: (1) a written proposal
describing the change and rationale, (2) an update to this file with a
version bump per the policy below, and (3) propagation of any resulting
changes to dependent templates (plan, spec, tasks) in the same change.

**Versioning policy**: semantic versioning applies to this document —
MAJOR for backward-incompatible governance or principle removals/
redefinitions, MINOR for new principles or materially expanded guidance,
PATCH for clarifications and wording fixes.

**Compliance review**: every `/speckit-plan` run MUST pass the
Constitution Check gate against the principles above before Phase 0
research begins, and again after Phase 1 design; unresolved violations
must be justified in Complexity Tracking or the plan must be revised.

**Version**: 1.0.0 | **Ratified**: 2026-07-14 | **Last Amended**: 2026-07-14
