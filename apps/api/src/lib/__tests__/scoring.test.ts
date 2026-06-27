import { test, expect } from "bun:test";
import { calculateWeightedQuestionScore } from "../scoring.ts";

const weightedCases = [
  { id: "a", weight: 1 },
  { id: "b", weight: 1 },
];

test("a SYSTEM_ERROR question scores 0 regardless of case results", () => {
  // Even if the stored results look like passes, an infrastructure failure
  // must never award marks — it is a re-run, not a graded attempt.
  const passingResults = [
    { testCaseId: "a", passed: true, actualOutput: "ok", executionTimeMs: 1, memoryUsedKb: null },
    { testCaseId: "b", passed: true, actualOutput: "ok", executionTimeMs: 1, memoryUsedKb: null },
  ];

  const score = calculateWeightedQuestionScore(
    10,
    weightedCases,
    passingResults,
    "SYSTEM_ERROR",
  );

  expect(score).toBe(0);
});
