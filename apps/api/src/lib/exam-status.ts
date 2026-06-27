// Exam time-window helpers and stale-exam deactivation.
import prisma from "@repo/database";

function calculateExamEndTime(startTime: Date, durationMin: number) {
  return new Date(startTime.getTime() + durationMin * 60_000);
}

function isExamCurrentlyActive(
  exam: { isActive: boolean; endTime: Date },
  now = new Date(),
) {
  return exam.isActive && exam.endTime > now;
}

async function deactivateExpiredExams(now = new Date()) {
  await prisma.exam.updateMany({
    where: {
      deletedAt: null,
      isActive: true,
      endTime: { lte: now },
    },
    data: { isActive: false },
  });
}

export { calculateExamEndTime, isExamCurrentlyActive, deactivateExpiredExams };
