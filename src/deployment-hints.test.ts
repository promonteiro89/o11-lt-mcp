/**
 * Tests for the "plan still validating" hint added to deployment errors
 * (see GitHub issue #3) — run with `npm test`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { addValidationHint, VALIDATION_HINT } from "./tools/deployments.js";

test("adds the hint to the 'Invalid status change ... Validating' error", () => {
  const errors = [
    "There was an error calculating outdated apps for deployment with key 'k': " +
      "Invalid status change: trying to change Staging with id '9781' from " +
      "'Validating' to 'Calculating apps to redeploy'.",
  ];
  assert.deepEqual(addValidationHint(errors), [...errors, VALIDATION_HINT]);
});

test("adds the hint when 'start' can't be executed", () => {
  const errors = ["Command 'start' can't be executed for deployment 'k'."];
  assert.deepEqual(addValidationHint(errors, "start"), [...errors, VALIDATION_HINT]);
});

test("leaves unrelated errors untouched", () => {
  const errors = ["Invalid user permissions."];
  assert.equal(addValidationHint(errors, "start"), errors);
});

test("does not flag non-start commands that can't be executed", () => {
  const errors = ["Command 'continue' can't be executed for deployment 'k'."];
  assert.equal(addValidationHint(errors, "continue"), errors);
});
