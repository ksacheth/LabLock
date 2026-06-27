// Weighted per-question scoring.
import type { StoredTestCaseResult, ExecutionSubmissionStatus } from "../types.ts";

function calculateWeightedQuestionScore(
  questionMarks: number,
  weightedCases: Array<{ id: string; weight: number }>,
  storedResults: StoredTestCaseResult[],
  executionStatus: ExecutionSubmissionStatus,
): number {
  if (weightedCases.length === 0) return 0;
  if (executionStatus === "COMPILE_ERROR") return 0;
  const totalWeight = weightedCases.reduce((s, t) => s + t.weight, 0);
  if (totalWeight <= 0) return 0;
  let earnedWeight = 0;
  for (const tc of weightedCases) {
    const r = storedResults.find((x) => x.testCaseId === tc.id);
    if (r?.passed) earnedWeight += tc.weight;
  }
  return (earnedWeight / totalWeight) * questionMarks;
}

export { calculateWeightedQuestionScore };
