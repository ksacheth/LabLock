export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const TEACHER_REQUIRED_ROLE = "FACULTY";
export const FACULTY_PENDING_APPROVAL_CODE = "FACULTY_PENDING_APPROVAL";

export function getDashboardPathForRole(role: string) {
  if (role === "STUDENT") return "/student/dashboard";
  if (role === "FACULTY") return "/teacher/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  return "/auth";
}
