# GymNotes — Proposed Contribution Tasks

This section is formatted for direct copy into the existing project Google document.

## Objective

Complete six focused improvements discovered during repository onboarding. The work strengthens
developer setup, workout-data integrity, error visibility, measurement correctness, and template
planning without restructuring the application or adding dependencies.

## 1. Standardize Node.js 22 LTS

**Problem:** The README states Node.js 18+, while Next.js 16.4 and Clerk 7.9 require Node.js
20.9 or newer. Jest 30 supports Node 22 but not Node 23. This mismatch blocked initial setup.

**Proposed change:** Declare Node 22 in `package.json`, add `.nvmrc`, update setup instructions,
and use `npm ci` for reproducible installs.

**Expected outcome:** New contributors select a supported runtime immediately and install the
same dependency graph used by the project.

## 2. Make completed workout history immutable

**Problem:** The UI disables editing after completion, but direct API requests can still add,
change, or delete exercises and sets in completed or abandoned sessions.

**Proposed change:** Require the owned parent session to have `status = 'in_progress'` in every
session-exercise and set mutation SQL guard.

**Expected outcome:** Historical results cannot be silently rewritten after a workout finishes,
matching the documented synchronization conflict policy.

## 3. Enforce nested API URL integrity

**Problem:** Set update/delete handlers use the set and session-exercise IDs but previously ignored
the session ID in the URL.

**Proposed change:** Scope each nested set mutation through the URL session ID as well as the
session-exercise ID, owner, and active status.

**Expected outcome:** Mismatched nested resource URLs return 404 and cannot mutate data.

## 4. Surface template mutation errors

**Problem:** Rename, reorder, and remove actions reload the template even when the API rejects the
operation, making a failure appear successful or unexplained.

**Proposed change:** Use one client mutation helper that reads API errors, preserves the current UI,
and reloads only after success.

**Expected outcome:** Users receive actionable feedback and do not lose context after a failed save.

## 5. Normalize mixed-unit workout volume

**Problem:** History sums numeric kg and lb values directly and labels the result as kilograms.

**Proposed change:** Convert every counted working-set weight to the requested display unit before
multiplying by repetitions and summing. Keep stored measurements unchanged.

**Expected outcome:** kg-only, lb-only, and mixed-unit sessions produce physically correct totals.

## 6. Expose complete template exercise targets

**Problem:** The API and schema support sets, repetition range, target weight, and rest duration,
but the editor only exposes target sets.

**Proposed change:** Add compact mobile-first fields for all supported targets with validation and a
clear save action.

**Expected outcome:** Users can fully plan exercises using capabilities already present in the data
model, with no schema migration or new dependency.

## Verification plan

- Add regression tests for completed-session guards and mismatched nested resource IDs.
- Add unit tests for kg/lb conversion and mixed-unit volume.
- Run the complete Jest suite.
- Run `npx next build` under Node.js 22.
- Manually verify the template editor at mobile and desktop widths.

## Delivery

Deliver all six changes through a short-lived feature branch and a pull request to `main`. The PR
will explain the problem, implementation, expected outcomes, verification results, and known limits.
