import { z } from "zod";

export const AdminUpdateUserSchema = z
  .object({
    role: z.enum(["STUDENT", "FACULTY", "ADMIN"]).optional(),
    departmentId: z
      .string()
      .uuid("departmentId must be a valid UUID")
      .nullish(),
    batchId: z.string().uuid("batchId must be a valid UUID").nullish(),
    rollNumber: z
      .string()
      .min(1, "rollNumber cannot be empty")
      .max(20, "rollNumber must be at most 20 characters")
      .nullish(),
  })
  .refine(
    (data) => {
      // If role is changing to FACULTY or ADMIN, batchId and departmentId must not be set
      if (
        (data.role === "FACULTY" || data.role === "ADMIN") &&
        (data.batchId || data.departmentId || data.rollNumber)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "FACULTY and ADMIN users must not have a batchId, departmentId, or rollNumber",
      path: ["role"],
    },
  );

export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserSchema>;

export const DepartmentSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name must be at most 100 characters"),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(10, "Code must be at most 10 characters")
    .toUpperCase(),
  isActive: z.boolean().default(true),
});

export type DepartmentInput = z.infer<typeof DepartmentSchema>;

export const BatchSchema = z.object({
  departmentId: z.string().uuid("departmentId must be a valid UUID"),
  yearOfStudy: z
    .number({ message: "yearOfStudy must be a number" })
    .int("yearOfStudy must be an integer")
    .min(1, "yearOfStudy must be between 1 and 5")
    .max(5, "yearOfStudy must be between 1 and 5"),
  intakeYear: z
    .number({ message: "intakeYear must be a number" })
    .int("intakeYear must be an integer")
    .min(2000, "intakeYear seems too far in the past")
    .max(new Date().getFullYear() + 1, "intakeYear cannot be in the future"),
  label: z
    .string()
    .min(3, "Label must be at least 3 characters")
    .max(100, "Label must be at most 100 characters"),
  isActive: z.boolean().default(true),
});

export type BatchInput = z.infer<typeof BatchSchema>;

export const ExamSchema = z
  .object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title must be at most 200 characters"),
    description: z
      .string()
      .max(2000, "Description must be at most 2000 characters")
      .optional(),
    startTime: z.coerce.date({ message: "startTime must be a valid date" }),
    endTime: z.coerce
      .date({ message: "endTime must be a valid date" })
      .optional(),
    durationMin: z
      .number({ message: "durationMin must be a number" })
      .int("durationMin must be an integer")
      .positive("durationMin must be positive"),
    batchId: z.string().uuid("batchId must be a valid UUID"),
    isActive: z.boolean().default(false),
    accessCode: z
      .string()
      .max(50, "Access code must be at most 50 characters")
      .optional(),
  })
  .refine((data) => !data.endTime || data.endTime > data.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export type ExamInput = z.infer<typeof ExamSchema>;

export const UpdateExamSchema = z
  .object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title must be at most 200 characters")
      .optional(),
    description: z
      .string()
      .max(2000, "Description must be at most 2000 characters")
      .optional(),
    startTime: z.coerce
      .date({ message: "startTime must be a valid date" })
      .optional(),
    endTime: z.coerce
      .date({ message: "endTime must be a valid date" })
      .optional(),
    durationMin: z
      .number({ message: "durationMin must be a number" })
      .int("durationMin must be an integer")
      .positive("durationMin must be positive")
      .optional(),
    isActive: z.boolean().optional(),
    accessCode: z
      .string()
      .max(50, "Access code must be at most 50 characters")
      .optional(),
  })
  .refine(
    (data) => !data.startTime || !data.endTime || data.endTime > data.startTime,
    {
      message: "endTime must be after startTime",
      path: ["endTime"],
    },
  );

export type UpdateExamInput = z.infer<typeof UpdateExamSchema>;

export const QuestionSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters"),
  description: z.string().min(1, "Description is required"),
  marks: z
    .number({ message: "marks must be a number" })
    .positive("marks must be positive")
    .default(10.0),
  timeLimitMs: z
    .number({ message: "timeLimitMs must be a number" })
    .int("timeLimitMs must be an integer")
    .positive("timeLimitMs must be positive")
    .default(2000),
  memoryLimitKb: z
    .number({ message: "memoryLimitKb must be a number" })
    .int("memoryLimitKb must be an integer")
    .positive("memoryLimitKb must be positive")
    .default(256000),
  // If omitted, the endpoint auto-calculates it as (existing question count + 1)
  orderIndex: z
    .number({ message: "orderIndex must be a number" })
    .int("orderIndex must be an integer")
    .min(1, "orderIndex must be at least 1")
    .optional(),
});

export type QuestionInput = z.infer<typeof QuestionSchema>;

export const UpdateQuestionSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters")
    .optional(),
  description: z.string().min(1, "Description cannot be empty").optional(),
  marks: z.number().positive("marks must be positive").optional(),
  timeLimitMs: z
    .number()
    .int("timeLimitMs must be an integer")
    .positive("timeLimitMs must be positive")
    .optional(),
  memoryLimitKb: z
    .number()
    .int("memoryLimitKb must be an integer")
    .positive("memoryLimitKb must be positive")
    .optional(),
  orderIndex: z
    .number()
    .int("orderIndex must be an integer")
    .min(1, "orderIndex must be at least 1")
    .optional(),
});

export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;

export const TestCaseSchema = z.object({
  input: z.string().min(1, "Input is required"),
  expectedOutput: z.string().min(1, "Expected output is required"),
  isHidden: z.boolean().default(true),
  weight: z
    .number({ message: "weight must be a number" })
    .positive("weight must be positive")
    .default(1.0),
});

export type TestCaseInput = z.infer<typeof TestCaseSchema>;

export const UpdateTestCaseSchema = z.object({
  input: z.string().min(1, "Input cannot be empty").optional(),
  expectedOutput: z
    .string()
    .min(1, "Expected output cannot be empty")
    .optional(),
  isHidden: z.boolean().optional(),
  weight: z.number().positive("weight must be positive").optional(),
});

export type UpdateTestCaseInput = z.infer<typeof UpdateTestCaseSchema>;

export const UserSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .endsWith("@nitk.edu.in", "Email must be a NITK email"),
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(50, "Name must be at most 50 characters"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(50, "Password must be at most 50 characters"),
  departmentId: z.string().uuid("departmentId must be a valid UUID").optional(),
  batchId: z.string().uuid("batchId must be a valid UUID").optional(),
  rollNumber: z
    .string()
    .min(1, "Roll number cannot be empty")
    .max(20, "Roll number must be at most 20 characters")
    .optional(),
});
