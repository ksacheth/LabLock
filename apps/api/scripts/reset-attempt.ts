import prisma from "@repo/database";

const STUDENT_EMAIL = "student1@nitk.edu.in";
const APPLY = process.argv.includes("--apply");

const student = await prisma.user.findUnique({
  where: { email: STUDENT_EMAIL },
});
if (!student) throw new Error(`No user ${STUDENT_EMAIL}`);

const attempts = await prisma.examAttempt.findMany({
  where: { userId: student.id },
  include: {
    exam: { select: { title: true } },
    logs: true,
  },
  orderBy: { startedAt: "desc" },
});

for (const a of attempts) {
  console.log(
    `attempt ${a.id} | exam="${a.exam.title}" | status=${a.status} | completedAt=${a.completedAt?.toISOString() ?? "null"} | logs=${a.logs.length}`,
  );
  for (const l of a.logs)
    console.log(`   log ${l.violationType} @ ${l.timestamp.toISOString()}`);
}

const disq = attempts.filter((a) => a.status === "DISQUALIFIED");
if (disq.length === 0) {
  console.log("\nNo DISQUALIFIED attempts to reset.");
} else if (!APPLY) {
  console.log(
    `\n[dry-run] would reset ${disq.length} attempt(s) to IN_PROGRESS and delete their proctoring logs. Re-run with --apply.`,
  );
} else {
  for (const a of disq) {
    await prisma.proctoringLog.deleteMany({ where: { attemptId: a.id } });
    await prisma.examAttempt.update({
      where: { id: a.id },
      data: { status: "IN_PROGRESS", completedAt: null },
    });
    console.log(`\nreset attempt ${a.id} -> IN_PROGRESS, logs cleared.`);
  }
}

await prisma.$disconnect();
