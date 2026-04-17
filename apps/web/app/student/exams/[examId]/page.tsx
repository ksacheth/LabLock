"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, UIEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import axios, { AxiosError } from "axios";

import {
  buildStudentExamInstructionsPath,
  hasExamEntryConsent,
} from "../entry-access";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const REQUIRED_ROLE = "STUDENT";

function getDashboardPathForRole(role: string) {
  if (role === "STUDENT") return "/student/dashboard";
  if (role === "FACULTY") return "/teacher/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  return "/auth";
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatTimeLimit(timeLimitMs: number) {
  if (timeLimitMs % 1000 === 0) {
    return `${timeLimitMs / 1000}s`;
  }

  return `${timeLimitMs}ms`;
}

type SupportedLanguage = "C" | "CPP" | "PYTHON3" | "JAVA";

const languageOptions: Array<{ value: SupportedLanguage; label: string }> = [
  { value: "C", label: "C" },
  { value: "CPP", label: "C++" },
  { value: "PYTHON3", label: "Python" },
  { value: "JAVA", label: "Java" },
];
const EDITOR_TAB = "    ";

const starterCodeByLanguage: Record<SupportedLanguage, string> = {
  C: `#include <stdio.h>

int main() {
    return 0;
}
`,
  CPP: `#include <bits/stdc++.h>
using namespace std;

int main() {
    return 0;
}
`,
  PYTHON3: `def solve():
    pass


if __name__ == "__main__":
    solve()
`,
  JAVA: `import java.util.*;

public class Main {
    public static void main(String[] args) {
    }
}
`,
};

type SyntaxTokenType =
  | "comment"
  | "decorator"
  | "directive"
  | "function"
  | "keyword"
  | "number"
  | "string"
  | "type";

const syntaxTokenClassByType: Record<SyntaxTokenType, string> = {
  comment: "text-slate-500",
  decorator: "text-violet-300",
  directive: "text-rose-300",
  function: "text-cyan-300",
  keyword: "text-sky-300",
  number: "text-fuchsia-300",
  string: "text-amber-300",
  type: "text-emerald-300",
};

const genericQuotedStringPattern =
  "\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'";
const pythonQuotedStringPattern =
  "'''[\\s\\S]*?'''|\"\"\"[\\s\\S]*?\"\"\"|" + genericQuotedStringPattern;
const cLikeCommentPattern = "//.*$|/\\*[\\s\\S]*?\\*/";
const pythonCommentPattern = "#.*$";
const numericLiteralPattern =
  "\\b(?:0[xX][\\da-fA-F]+|\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)\\b";
const functionPattern = "\\b[A-Za-z_]\\w*(?=\\s*\\()";

function createWordPattern(words: string[]) {
  return `\\b(?:${words.join("|")})\\b`;
}

const syntaxPatternByLanguage: Record<SupportedLanguage, RegExp> = {
  C: new RegExp(
    [
      `(?<comment>${cLikeCommentPattern})`,
      `(?<directive>^\\s*#(?:include|define|ifdef|ifndef|endif|if|else|elif|pragma)\\b.*$)`,
      `(?<string>${genericQuotedStringPattern})`,
      `(?<keyword>${createWordPattern([
        "auto",
        "break",
        "case",
        "const",
        "continue",
        "default",
        "do",
        "else",
        "enum",
        "extern",
        "for",
        "goto",
        "if",
        "register",
        "return",
        "sizeof",
        "static",
        "struct",
        "switch",
        "typedef",
        "union",
        "volatile",
        "while",
      ])})`,
      `(?<type>${createWordPattern([
        "bool",
        "char",
        "double",
        "float",
        "int",
        "long",
        "short",
        "signed",
        "size_t",
        "unsigned",
        "void",
      ])})`,
      `(?<number>${numericLiteralPattern})`,
      `(?<function>${functionPattern})`,
    ].join("|"),
    "gm",
  ),
  CPP: new RegExp(
    [
      `(?<comment>${cLikeCommentPattern})`,
      `(?<directive>^\\s*#(?:include|define|ifdef|ifndef|endif|if|else|elif|pragma)\\b.*$)`,
      `(?<string>${genericQuotedStringPattern})`,
      `(?<keyword>${createWordPattern([
        "auto",
        "break",
        "case",
        "catch",
        "class",
        "const",
        "continue",
        "default",
        "delete",
        "do",
        "else",
        "explicit",
        "for",
        "if",
        "namespace",
        "new",
        "override",
        "private",
        "protected",
        "public",
        "return",
        "switch",
        "template",
        "this",
        "throw",
        "try",
        "typename",
        "using",
        "virtual",
        "while",
      ])})`,
      `(?<type>${createWordPattern([
        "bool",
        "char",
        "double",
        "float",
        "int",
        "long",
        "nullptr",
        "short",
        "signed",
        "size_t",
        "std",
        "string",
        "unsigned",
        "void",
      ])})`,
      `(?<number>${numericLiteralPattern})`,
      `(?<function>${functionPattern})`,
    ].join("|"),
    "gm",
  ),
  PYTHON3: new RegExp(
    [
      `(?<comment>${pythonCommentPattern})`,
      "(?<decorator>@[A-Za-z_]\\w*(?:\\.\\w+)*)",
      `(?<string>${pythonQuotedStringPattern})`,
      `(?<keyword>${createWordPattern([
        "and",
        "as",
        "break",
        "class",
        "continue",
        "def",
        "elif",
        "else",
        "except",
        "False",
        "finally",
        "for",
        "from",
        "if",
        "import",
        "in",
        "is",
        "lambda",
        "None",
        "not",
        "or",
        "pass",
        "raise",
        "return",
        "True",
        "try",
        "while",
        "with",
        "yield",
      ])})`,
      `(?<type>${createWordPattern([
        "bool",
        "dict",
        "float",
        "int",
        "list",
        "set",
        "str",
        "tuple",
      ])})`,
      `(?<number>${numericLiteralPattern})`,
      `(?<function>${functionPattern})`,
    ].join("|"),
    "gm",
  ),
  JAVA: new RegExp(
    [
      `(?<comment>${cLikeCommentPattern})`,
      `(?<string>${genericQuotedStringPattern})`,
      `(?<keyword>${createWordPattern([
        "abstract",
        "break",
        "case",
        "catch",
        "class",
        "continue",
        "else",
        "extends",
        "final",
        "finally",
        "for",
        "if",
        "implements",
        "import",
        "interface",
        "new",
        "package",
        "private",
        "protected",
        "public",
        "return",
        "static",
        "switch",
        "throw",
        "throws",
        "try",
        "while",
      ])})`,
      `(?<type>${createWordPattern([
        "ArrayList",
        "boolean",
        "char",
        "Collections",
        "double",
        "float",
        "HashMap",
        "HashSet",
        "int",
        "Integer",
        "List",
        "long",
        "Map",
        "Set",
        "String",
        "void",
      ])})`,
      `(?<number>${numericLiteralPattern})`,
      `(?<function>${functionPattern})`,
    ].join("|"),
    "gm",
  ),
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildHighlightedCodeHtml(code: string, language: SupportedLanguage) {
  if (!code) {
    return '<span class="text-slate-500">Write your solution here...</span>';
  }

  const htmlParts: string[] = [];
  const matcher = new RegExp(
    syntaxPatternByLanguage[language].source,
    syntaxPatternByLanguage[language].flags,
  );
  let lastIndex = 0;
  let match = matcher.exec(code);

  while (match) {
    const matchStart = match.index;
    const matchValue = match[0];

    if (matchStart > lastIndex) {
      htmlParts.push(escapeHtml(code.slice(lastIndex, matchStart)));
    }

    const matchedTokenType = (Object.entries(match.groups ?? {}).find(
      ([, group]) => group !== undefined,
    )?.[0] ?? null) as SyntaxTokenType | null;

    if (matchedTokenType) {
      htmlParts.push(
        `<span class="${syntaxTokenClassByType[matchedTokenType]}">${escapeHtml(matchValue)}</span>`,
      );
    } else {
      htmlParts.push(escapeHtml(matchValue));
    }

    lastIndex = matchStart + matchValue.length;
    match = matcher.exec(code);
  }

  if (lastIndex < code.length) {
    htmlParts.push(escapeHtml(code.slice(lastIndex)));
  }

  return htmlParts.join("");
}

interface EditorCodeChange {
  code: string;
  selectionStart: number;
  selectionEnd: number;
}

function getSelectedBlockBounds(
  code: string,
  selectionStart: number,
  selectionEnd: number,
) {
  const blockStart =
    code.lastIndexOf("\n", Math.max(selectionStart - 1, 0)) + 1;
  const adjustedSelectionEnd =
    selectionEnd > selectionStart && code[selectionEnd - 1] === "\n"
      ? selectionEnd - 1
      : selectionEnd;
  const nextLineBreakIndex = code.indexOf("\n", adjustedSelectionEnd);
  const blockEnd = nextLineBreakIndex === -1 ? code.length : nextLineBreakIndex;

  return { blockStart, blockEnd };
}

function getLeadingIndentWidth(line: string) {
  if (line.startsWith("\t")) return 1;
  const leadingSpaceMatch = line.match(/^ {1,4}/);
  return leadingSpaceMatch?.[0].length ?? 0;
}

function countAffectedLines(block: string, offset: number) {
  return block.slice(0, Math.max(offset, 0)).split("\n").length;
}

function mapOffsetAfterOutdent(
  lines: string[],
  removedIndentWidths: number[],
  offset: number,
) {
  let lineStartOffset = 0;
  let removedBeforeOffset = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const lineEndOffset = lineStartOffset + line.length;
    const lineBreakOffset =
      lineEndOffset + (lineIndex < lines.length - 1 ? 1 : 0);

    if (offset <= lineEndOffset) {
      removedBeforeOffset += Math.min(
        removedIndentWidths[lineIndex] ?? 0,
        Math.max(offset - lineStartOffset, 0),
      );
      return offset - removedBeforeOffset;
    }

    removedBeforeOffset += removedIndentWidths[lineIndex] ?? 0;
    if (offset < lineBreakOffset) {
      return offset - removedBeforeOffset;
    }

    lineStartOffset = lineBreakOffset;
  }

  return offset - removedBeforeOffset;
}

function indentEditorText(
  code: string,
  selectionStart: number,
  selectionEnd: number,
): EditorCodeChange {
  if (selectionStart === selectionEnd) {
    return {
      code:
        code.slice(0, selectionStart) + EDITOR_TAB + code.slice(selectionEnd),
      selectionStart: selectionStart + EDITOR_TAB.length,
      selectionEnd: selectionEnd + EDITOR_TAB.length,
    };
  }

  const { blockStart, blockEnd } = getSelectedBlockBounds(
    code,
    selectionStart,
    selectionEnd,
  );
  const block = code.slice(blockStart, blockEnd);
  const lines = block.split("\n");
  const nextBlock = lines.map((line) => `${EDITOR_TAB}${line}`).join("\n");
  const endLineCount = countAffectedLines(block, selectionEnd - blockStart);

  return {
    code: code.slice(0, blockStart) + nextBlock + code.slice(blockEnd),
    selectionStart: selectionStart + EDITOR_TAB.length,
    selectionEnd: selectionEnd + EDITOR_TAB.length * endLineCount,
  };
}

function outdentEditorText(
  code: string,
  selectionStart: number,
  selectionEnd: number,
): EditorCodeChange {
  const { blockStart, blockEnd } = getSelectedBlockBounds(
    code,
    selectionStart,
    selectionEnd,
  );
  const block = code.slice(blockStart, blockEnd);
  const lines = block.split("\n");
  const removedIndentWidths = lines.map(getLeadingIndentWidth);
  const nextBlock = lines
    .map((line, index) => line.slice(removedIndentWidths[index] ?? 0))
    .join("\n");
  const startOffset = selectionStart - blockStart;
  const endOffset = selectionEnd - blockStart;

  return {
    code: code.slice(0, blockStart) + nextBlock + code.slice(blockEnd),
    selectionStart:
      blockStart +
      mapOffsetAfterOutdent(lines, removedIndentWidths, startOffset),
    selectionEnd:
      blockStart + mapOffsetAfterOutdent(lines, removedIndentWidths, endOffset),
  };
}

function formatSavedTime(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSubmissionStatusLabel(status: string) {
  switch (status) {
    case "ACCEPTED":
      return "Accepted";
    case "WRONG_ANSWER":
      return "Wrong Answer";
    case "COMPILE_ERROR":
      return "Compile Error";
    case "RUNTIME_ERROR":
      return "Runtime Error";
    case "TIME_LIMIT_EXCEEDED":
      return "Time Limit Exceeded";
    case "PENDING":
      return "Pending";
    default:
      return status.replaceAll("_", " ");
  }
}

function getSubmissionStatusClasses(status: string) {
  switch (status) {
    case "ACCEPTED":
      return "bg-emerald-100 text-emerald-700";
    case "WRONG_ANSWER":
      return "bg-amber-100 text-amber-700";
    case "COMPILE_ERROR":
    case "RUNTIME_ERROR":
    case "TIME_LIMIT_EXCEEDED":
      return "bg-red-100 text-red-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface RoomQuestion {
  id: string;
  title: string;
  description: string;
  marks: number;
  orderIndex: number;
  timeLimitMs: number;
  memoryLimitKb: number;
  draft: {
    id: string;
    code: string;
    language: SupportedLanguage;
    submittedAt: string;
  } | null;
}

interface ExamRoomData {
  serverTime: string;
  exam: {
    id: string;
    title: string;
    description: string | null;
    startTime: string;
    endTime: string;
    durationMin: number;
    questions: RoomQuestion[];
  };
  attempt: {
    id: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    retakeNumber: number;
  };
}

interface QuestionDraftState {
  code: string;
  language: SupportedLanguage;
  lastSavedAt: string | null;
  saveState: "idle" | "saving" | "saved" | "error";
}

interface RunTestCaseResult {
  testCaseId: string;
  passed: boolean;
  input: string | null;
  expectedOutput: string | null;
  actualOutput: string | null;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  error: string | null;
}

interface RunCodeResult {
  submissionId: string;
  status: string;
  passedCount: number;
  totalCount: number;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  stdErr: string | null;
  submittedAt: string;
  testCaseResults: RunTestCaseResult[];
}

function createDraftState(question: RoomQuestion): QuestionDraftState {
  const language = question.draft?.language ?? "CPP";

  return {
    code: question.draft?.code ?? starterCodeByLanguage[language],
    language,
    lastSavedAt: question.draft?.submittedAt ?? null,
    saveState: question.draft ? "saved" : "idle",
  };
}

export default function StudentExamRoomPage() {
  const params = useParams<Record<string, string | string[]>>();
  const router = useRouter();
  const examIdParam = params.examId;
  const examId = Array.isArray(examIdParam) ? examIdParam[0] : examIdParam;

  const [roomData, setRoomData] = useState<ExamRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());
  const [draftsByQuestionId, setDraftsByQuestionId] = useState<
    Record<string, QuestionDraftState>
  >({});
  const [editorNotice, setEditorNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [runningCode, setRunningCode] = useState(false);
  const [runResult, setRunResult] = useState<RunCodeResult | null>(null);
  const editorHighlightRef = useRef<HTMLPreElement | null>(null);
  const editorLineNumberRef = useRef<HTMLPreElement | null>(null);
  const editorTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!examId) {
      setError("Exam room not found.");
      setLoading(false);
      return;
    }

    const token = getToken();
    if (!token) {
      router.replace("/auth/student/login");
      return;
    }

    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsedUser = JSON.parse(stored) as User;
        if (parsedUser.role !== REQUIRED_ROLE) {
          router.replace(getDashboardPathForRole(parsedUser.role));
          return;
        }
      } catch {
        localStorage.removeItem("user");
      }
    }

    if (!hasExamEntryConsent(examId)) {
      router.replace(buildStudentExamInstructionsPath(examId));
      return;
    }

    let isActive = true;

    async function enterExamRoom() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [meRes, roomRes] = await Promise.all([
          axios.get<User>(`${API_URL}/api/me`, { headers }),
          axios.post<ExamRoomData>(
            `${API_URL}/api/student/exams/${examId}/enter`,
            {},
            { headers },
          ),
        ]);

        if (!isActive) return;

        if (meRes.data.role !== REQUIRED_ROLE) {
          router.replace(getDashboardPathForRole(meRes.data.role));
          return;
        }

        setRoomData(roomRes.data);
        const serverTimeMs = Date.parse(roomRes.data.serverTime);
        setCurrentTimeMs(
          Number.isNaN(serverTimeMs) ? Date.now() : serverTimeMs,
        );
        setSelectedQuestionIndex(0);
      } catch (err) {
        if (!isActive) return;
        if (err instanceof AxiosError) {
          setError(
            err.response?.data?.error ?? "Failed to enter the exam room.",
          );
        } else {
          setError("Failed to enter the exam room.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    enterExamRoom();

    return () => {
      isActive = false;
    };
  }, [examId, router]);

  useEffect(() => {
    if (!roomData) return;

    const intervalId = window.setInterval(() => {
      setCurrentTimeMs((current) => current + 1000);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [roomData]);

  useEffect(() => {
    if (!roomData) return;

    setDraftsByQuestionId(
      Object.fromEntries(
        roomData.exam.questions.map((question) => [
          question.id,
          createDraftState(question),
        ]),
      ),
    );
  }, [roomData]);

  const questions = roomData?.exam.questions ?? [];
  const activeQuestion = questions[selectedQuestionIndex] ?? null;
  const activeDraft = activeQuestion
    ? draftsByQuestionId[activeQuestion.id]
    : null;
  const deferredEditorCode = useDeferredValue(activeDraft?.code ?? "");
  const totalMarks = questions.reduce(
    (sum, question) => sum + question.marks,
    0,
  );
  const remainingMs = roomData
    ? Math.max(new Date(roomData.exam.endTime).getTime() - currentTimeMs, 0)
    : 0;
  const roomEnded = roomData ? remainingMs === 0 : false;
  const highlightedEditorHtml = activeDraft
    ? buildHighlightedCodeHtml(deferredEditorCode, activeDraft.language)
    : "";
  const editorLineNumbers = Array.from(
    { length: Math.max(deferredEditorCode.split("\n").length, 1) },
    (_, index) => index + 1,
  );

  useEffect(() => {
    setEditorNotice(null);
    setRunResult(null);

    if (editorTextareaRef.current) {
      editorTextareaRef.current.scrollTop = 0;
      editorTextareaRef.current.scrollLeft = 0;
    }

    if (editorHighlightRef.current) {
      editorHighlightRef.current.scrollTop = 0;
      editorHighlightRef.current.scrollLeft = 0;
    }

    if (editorLineNumberRef.current) {
      editorLineNumberRef.current.style.transform = "translateY(0px)";
    }
  }, [activeQuestion?.id]);

  const updateDraftState = (
    questionId: string,
    updater: (current: QuestionDraftState) => QuestionDraftState,
  ) => {
    setDraftsByQuestionId((current) => {
      const existing = current[questionId];
      if (!existing) return current;

      return {
        ...current,
        [questionId]: updater(existing),
      };
    });
  };

  const handleLanguageChange = (
    questionId: string,
    nextLanguage: SupportedLanguage,
  ) => {
    setRunResult(null);
    updateDraftState(questionId, (current) => ({
      ...current,
      language: nextLanguage,
      code:
        current.lastSavedAt === null &&
        current.code === starterCodeByLanguage[current.language]
          ? starterCodeByLanguage[nextLanguage]
          : current.code,
      saveState: "idle",
    }));
  };

  const handleCodeChange = (questionId: string, nextCode: string) => {
    setRunResult(null);
    updateDraftState(questionId, (current) => ({
      ...current,
      code: nextCode,
      saveState: "idle",
    }));
  };

  const handleEditorScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    if (!editorHighlightRef.current) return;

    editorHighlightRef.current.scrollTop = event.currentTarget.scrollTop;
    editorHighlightRef.current.scrollLeft = event.currentTarget.scrollLeft;

    if (editorLineNumberRef.current) {
      editorLineNumberRef.current.style.transform = `translateY(-${event.currentTarget.scrollTop}px)`;
    }
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Tab" || !activeQuestion || !activeDraft || roomEnded) {
      return;
    }

    event.preventDefault();

    const textarea = event.currentTarget;
    const nextChange = event.shiftKey
      ? outdentEditorText(
          activeDraft.code,
          textarea.selectionStart,
          textarea.selectionEnd,
        )
      : indentEditorText(
          activeDraft.code,
          textarea.selectionStart,
          textarea.selectionEnd,
        );

    updateDraftState(activeQuestion.id, (current) => ({
      ...current,
      code: nextChange.code,
      saveState: "idle",
    }));
    setEditorNotice(null);

    window.requestAnimationFrame(() => {
      if (!editorTextareaRef.current) return;
      editorTextareaRef.current.focus();
      editorTextareaRef.current.setSelectionRange(
        nextChange.selectionStart,
        nextChange.selectionEnd,
      );
    });
  };

  const runCode = async () => {
    if (!examId || !activeQuestion || !activeDraft || roomEnded) return;

    const token = getToken();
    if (!token) {
      router.replace("/auth/student/login");
      return;
    }

    setEditorNotice(null);
    setRunningCode(true);

    try {
      const { data } = await axios.post<RunCodeResult>(
        `${API_URL}/api/student/exams/${examId}/questions/${activeQuestion.id}/run`,
        {
          code: activeDraft.code,
          language: activeDraft.language,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setRunResult(data);
      updateDraftState(activeQuestion.id, (current) => ({
        ...current,
        lastSavedAt: data.submittedAt,
        saveState: "saved",
      }));
    } catch (err) {
      setRunResult(null);
      const message =
        err instanceof AxiosError
          ? (err.response?.data?.error ?? "Failed to run code.")
          : "Failed to run code.";

      setEditorNotice({
        type: "error",
        message,
      });
    } finally {
      setRunningCode(false);
    }
  };

  const saveDraft = async () => {
    if (!examId || !activeQuestion || !activeDraft || roomEnded) return;

    const token = getToken();
    if (!token) {
      router.replace("/auth/student/login");
      return;
    }

    setEditorNotice(null);
    updateDraftState(activeQuestion.id, (current) => ({
      ...current,
      saveState: "saving",
    }));

    try {
      const { data } = await axios.put<{
        submittedAt: string;
      }>(
        `${API_URL}/api/student/exams/${examId}/questions/${activeQuestion.id}/draft`,
        {
          code: activeDraft.code,
          language: activeDraft.language,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      updateDraftState(activeQuestion.id, (current) => ({
        ...current,
        lastSavedAt: data.submittedAt,
        saveState: "saved",
      }));
      setEditorNotice({
        type: "success",
        message: "Code draft saved.",
      });
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? (err.response?.data?.error ?? "Failed to save code draft.")
          : "Failed to save code draft.";

      updateDraftState(activeQuestion.id, (current) => ({
        ...current,
        saveState: "error",
      }));
      setEditorNotice({
        type: "error",
        message,
      });
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-[#f8fafc] text-slate-900">
      <header className="shrink-0 border-b border-primary/10 bg-white px-2">
        <div className="mx-auto flex max-w-[1920px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black text-primary md:text-2xl">
              {roomData?.exam.title ?? "Exam Room"}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {roomData ? (
              <div className="flex flex-col items-end">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Time Left
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={`material-symbols-outlined ${roomEnded ? "text-red-500" : "text-emerald-500"} animate-pulse text-sm`}
                  >
                    timer
                  </span>
                  <p
                    className={`font-mono text-xl font-black ${
                      roomEnded ? "text-red-600" : "text-slate-800"
                    }`}
                  >
                    {formatCountdown(remainingMs)}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col overflow-auto p-4 lg:overflow-hidden lg:p-6">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">
              progress_activity
            </span>
          </div>
        ) : error ? (
          <div className="mx-auto w-full max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm mt-10">
            <span className="material-symbols-outlined text-4xl text-red-500">
              error
            </span>
            <h2 className="mt-4 text-xl font-bold text-slate-900">
              Unable to enter exam room
            </h2>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button
              onClick={() => router.push("/student/dashboard")}
              className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary/90"
            >
              Return to dashboard
            </button>
          </div>
        ) : roomData ? (
          <div className="flex h-full w-full flex-col gap-5 lg:flex-row lg:gap-6">
            {/* Left Pane: Question Nav & Description */}
            <div className="flex shrink-0 flex-col gap-5 lg:w-[45%] xl:w-[40%]">
              {/* Question Navigation */}
              <div className="flex flex-col gap-4 rounded-2xl border border-primary/10 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                    Questions Overview
                  </h2>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    Attempt #{roomData.attempt.retakeNumber}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {questions.map((question, index) => {
                    const draft = draftsByQuestionId[question.id];
                    const isAttempted =
                      draft &&
                      draft.code !== starterCodeByLanguage[draft.language] &&
                      draft.code.trim() !== "";

                    return (
                      <button
                        key={question.id}
                        onClick={() => setSelectedQuestionIndex(index)}
                        className={`flex h-[42px] min-w-[42px] items-center justify-center rounded-xl border text-sm font-bold transition-all ${
                          index === selectedQuestionIndex
                            ? "border-primary bg-primary text-white shadow-md shadow-primary/20 scale-105"
                            : isAttempted
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100/50"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                        }`}
                        title={question.title}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <button
                    onClick={() =>
                      setSelectedQuestionIndex((current) =>
                        Math.max(current - 1, 0),
                      )
                    }
                    disabled={
                      selectedQuestionIndex === 0 || questions.length === 0
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      arrow_back
                    </span>
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setSelectedQuestionIndex((current) =>
                        Math.min(current + 1, questions.length - 1),
                      )
                    }
                    disabled={
                      questions.length === 0 ||
                      selectedQuestionIndex >= questions.length - 1
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
                  >
                    Next
                    <span className="material-symbols-outlined text-[18px]">
                      arrow_forward
                    </span>
                  </button>
                </div>
              </div>

              {/* Problem Description */}
              <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm">
                {activeQuestion ? (
                  <>
                    <div className="border-b border-slate-100 bg-slate-50/50 p-5">
                      <h2 className="text-xl font-extrabold text-slate-900">
                        {selectedQuestionIndex + 1}. {activeQuestion.title}
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wide">
                        <span className="rounded-md bg-rose-50 text-rose-600 px-2 py-1">
                          {activeQuestion.marks} Marks
                        </span>
                        <span className="rounded-md bg-sky-50 text-sky-600 px-2 py-1">
                          {formatTimeLimit(activeQuestion.timeLimitMs)}
                        </span>
                        <span className="rounded-md bg-amber-50 text-amber-700 px-2 py-1">
                          {activeQuestion.memoryLimitKb} KB
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                      <div className="prose prose-slate max-w-none prose-pre:bg-[#1e1e1e] prose-pre:text-slate-200">
                        <div className="text-sm leading-8 whitespace-pre-wrap text-slate-700">
                          {activeQuestion.description}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-slate-500">
                    <span className="material-symbols-outlined mb-3 text-5xl opacity-20">
                      description
                    </span>
                    <p className="font-semibold text-slate-700">
                      {roomData.exam.description ??
                        "Exam instructions are ready."}
                    </p>
                    <p className="mt-2 text-sm">
                      Review the questions and start writing your solutions.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Pane: Code Editor */}
            <div className="flex min-h-[600px] flex-1 flex-col overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm lg:min-h-0">
              {activeQuestion && activeDraft ? (
                <>
                  {/* Editor Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/10 bg-slate-50/80 px-4 py-3">
                    <div className="flex items-center gap-4">
                      <select
                        value={activeDraft.language}
                        onChange={(event) =>
                          handleLanguageChange(
                            activeQuestion.id,
                            event.target.value as SupportedLanguage,
                          )
                        }
                        disabled={roomEnded}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {languageOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <div className="hidden sm:block">
                        {editorNotice ? (
                          <span
                            className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                              editorNotice.type === "success"
                                ? "bg-emerald-100/50 text-emerald-700"
                                : "bg-red-100/50 text-red-600"
                            }`}
                          >
                            {editorNotice.message}
                          </span>
                        ) : activeDraft.saveState === "saved" &&
                          activeDraft.lastSavedAt ? (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                            <span className="material-symbols-outlined text-[14px] text-emerald-500">
                              check_circle
                            </span>
                            Saved at {formatSavedTime(activeDraft.lastSavedAt)}
                          </span>
                        ) : activeDraft.saveState === "error" ? (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
                            <span className="material-symbols-outlined text-[14px]">
                              error
                            </span>
                            Last save failed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                            <span className="material-symbols-outlined text-[14px]">
                              edit_note
                            </span>
                            Unsaved changes
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={runCode}
                        disabled={roomEnded || runningCode}
                        className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-5 py-2 text-sm font-bold text-primary shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-95 disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          play_arrow
                        </span>
                        {runningCode ? "Running..." : "Run Code"}
                      </button>
                      <button
                        onClick={saveDraft}
                        disabled={
                          roomEnded || activeDraft.saveState === "saving"
                        }
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95 disabled:pointer-events-none disabled:bg-slate-300 disabled:shadow-none"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          save
                        </span>
                        {activeDraft.saveState === "saving"
                          ? "Saving..."
                          : "Save Code"}
                      </button>
                    </div>
                  </div>

                  {/* Editor Body */}
                  <div className="relative flex-1 bg-[#1e1e1e]">
                    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 overflow-hidden border-r border-white/10 bg-[#161616]">
                      <pre
                        ref={editorLineNumberRef}
                        aria-hidden="true"
                        className="m-0 px-3 py-6 text-right font-mono text-[15px] leading-relaxed text-slate-500 select-none"
                        style={{
                          tabSize: 4,
                          fontFamily:
                            "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                        }}
                      >
                        {editorLineNumbers.join("\n")}
                      </pre>
                    </div>
                    <pre
                      ref={editorHighlightRef}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 m-0 overflow-hidden break-normal py-6 pr-6 pl-20 font-mono text-[15px] leading-relaxed text-slate-300"
                      style={{
                        tabSize: 4,
                        fontFamily:
                          "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                      }}
                    >
                      <code
                        dangerouslySetInnerHTML={{
                          __html: highlightedEditorHtml,
                        }}
                      />
                    </pre>
                    <textarea
                      ref={editorTextareaRef}
                      value={activeDraft.code}
                      onChange={(event) =>
                        handleCodeChange(activeQuestion.id, event.target.value)
                      }
                      onKeyDown={handleEditorKeyDown}
                      onScroll={handleEditorScroll}
                      readOnly={roomEnded}
                      spellCheck={false}
                      className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre break-normal bg-transparent py-6 pr-6 pl-20 font-mono text-[15px] leading-relaxed text-transparent caret-white outline-none selection:bg-blue-500/30 placeholder:text-slate-600 read-only:cursor-not-allowed"
                      placeholder="Write your solution here..."
                      style={{
                        tabSize: 4,
                        fontFamily:
                          "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                      }}
                    />
                  </div>

                  <div className="shrink-0 border-t border-primary/10 bg-slate-50/80">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">
                          Run Results
                        </h3>
                        <p className="text-xs text-slate-500">
                          Executes your current code against visible sample test
                          cases only.
                        </p>
                      </div>

                      {runResult ? (
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${getSubmissionStatusClasses(runResult.status)}`}
                        >
                          {formatSubmissionStatusLabel(runResult.status)}
                        </span>
                      ) : null}
                    </div>

                    <div className="max-h-[320px] overflow-y-auto px-4 pb-4">
                      {runResult ? (
                        <div className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                Passed
                              </p>
                              <p className="mt-1 text-lg font-black text-slate-900">
                                {runResult.passedCount}/{runResult.totalCount}
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                Peak Time
                              </p>
                              <p className="mt-1 text-lg font-black text-slate-900">
                                {runResult.executionTimeMs
                                  ? `${runResult.executionTimeMs} ms`
                                  : "--"}
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                Last Run
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-900">
                                {formatSavedTime(runResult.submittedAt)}
                              </p>
                            </div>
                          </div>

                          {runResult.stdErr ? (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-red-600">
                                Error Output
                              </p>
                              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-red-700">
                                {runResult.stdErr}
                              </pre>
                            </div>
                          ) : null}

                          {runResult.testCaseResults.length > 0 ? (
                            <div className="space-y-3">
                              {runResult.testCaseResults.map(
                                (testCase, index) => (
                                  <div
                                    key={testCase.testCaseId}
                                    className="rounded-2xl border border-slate-200 bg-white p-4"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-bold text-slate-900">
                                          Sample Case {index + 1}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {testCase.executionTimeMs
                                            ? `Execution time: ${testCase.executionTimeMs} ms`
                                            : "Execution time unavailable"}
                                        </p>
                                      </div>
                                      <span
                                        className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                                          testCase.passed
                                            ? "bg-emerald-100 text-emerald-700"
                                            : "bg-red-100 text-red-600"
                                        }`}
                                      >
                                        {testCase.passed ? "Passed" : "Failed"}
                                      </span>
                                    </div>

                                    {testCase.error ? (
                                      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                                        {testCase.error}
                                      </div>
                                    ) : null}

                                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                                      <div className="rounded-xl bg-slate-950 p-3">
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                          Input
                                        </p>
                                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-slate-100">
                                          {testCase.input || "(empty input)"}
                                        </pre>
                                      </div>
                                      <div className="rounded-xl bg-slate-950 p-3">
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                          Expected
                                        </p>
                                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-slate-100">
                                          {testCase.expectedOutput ||
                                            "(empty output)"}
                                        </pre>
                                      </div>
                                      <div className="rounded-xl bg-slate-950 p-3">
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                          Actual
                                        </p>
                                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-slate-100">
                                          {testCase.actualOutput ||
                                            "(empty output)"}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                              Compilation failed before the sample cases could
                              run.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                          Run your current code to see sample-case output,
                          errors, and pass/fail results from the server.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center bg-[#1e1e1e] p-8 text-center text-slate-500">
                  <div className="max-w-sm">
                    <span className="material-symbols-outlined mb-4 text-7xl opacity-10">
                      code_blocks
                    </span>
                    <p className="text-xl font-bold text-slate-400">
                      No Editor Available
                    </p>
                    <p className="mt-3 text-sm text-slate-500">
                      Select a programming question from the left panel to open
                      the code editor.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
