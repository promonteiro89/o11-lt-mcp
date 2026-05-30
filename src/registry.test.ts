/**
 * Registry integrity tests — run with `npm test`.
 *
 * Uses the Node.js built-in test runner (node:test) so there are no extra
 * dependencies. The pure `findRegistryProblems` function lets us assert the
 * real registry is consistent and that each failure mode is detected.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { AxiosInstance } from "axios";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { HandlerMap } from "./types.js";
import { buildRegistry, findRegistryProblems } from "./registry.js";

// Handler factories only capture the api reference; they don't call it at
// build time, so a bare stub is enough to construct the registry.
const stubApi = {} as AxiosInstance;

const tool = (name: string): Tool => ({
  name,
  description: "",
  inputSchema: { type: "object", properties: {} },
});

const noopHandler: HandlerMap[string] = async () => ({ content: [] });

test("the real registry is internally consistent", () => {
  const { tools, handlers } = buildRegistry(stubApi);
  assert.deepEqual(findRegistryProblems(tools, handlers), []);
});

test("the real registry exposes the expected LifeTime tool count", () => {
  const { tools } = buildRegistry(stubApi);
  assert.equal(tools.length, 66);
});

test("flags a tool that has no handler", () => {
  const problems = findRegistryProblems([tool("ghost")], {});
  assert.equal(problems.length, 1);
  assert.match(problems[0], /ghost/);
  assert.match(problems[0], /missing a handler/);
});

test("flags a handler that backs no tool", () => {
  const problems = findRegistryProblems([], { orphan: noopHandler });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /orphan/);
  assert.match(problems[0], /no tool definition/);
});

test("flags duplicate tool names", () => {
  const problems = findRegistryProblems(
    [tool("dup"), tool("dup")],
    { dup: noopHandler }
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Duplicate/);
  assert.match(problems[0], /dup/);
});

test("a healthy hand-built registry reports no problems", () => {
  const problems = findRegistryProblems(
    [tool("a"), tool("b")],
    { a: noopHandler, b: noopHandler }
  );
  assert.deepEqual(problems, []);
});
