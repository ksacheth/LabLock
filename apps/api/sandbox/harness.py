#!/usr/bin/env python3
"""Trusted, language-agnostic sandbox harness (ADR-0006).

Reads a JSON job from stdin, compiles the source, runs each case with an
in-namespace per-case timeout, and prints ONE RunnerResult-shaped JSON object to
stdout. Diagnostics (if any) go to stderr only: stdout MUST contain nothing but
the JSON result, because the host adapter treats a valid harness JSON as the
"student outcome" boundary — anything that prevents a valid JSON is infra and
becomes SYSTEM_ERROR host-side. See docs/adr/0006-sandbox-runner-adapter.md.

Job shape:
    { source, sourceFilename, compileCommand[], runCommand[],
      compileTimeoutMs, runTimeoutMs, cases: [{ id, input }] }
"""
import json
import os
import signal
import subprocess
import sys
import time

# Mirror the host adapter's PROCESS_OUTPUT_LIMIT so a program cannot flood the
# pipe (and so verdicts match the host adapter on benign programs).
OUTPUT_LIMIT = 16_000
WORKSPACE = "/workspace"


def truncate(value):
    if len(value) <= OUTPUT_LIMIT:
        return value
    return value[:OUTPUT_LIMIT] + "\n...truncated"


def run_process(command, timeout_ms, stdin_data):
    """Run `command` in its own process group and enforce `timeout_ms` inside the
    namespace. On timeout the WHOLE group is SIGKILLed, so a fork bomb's children
    die with the parent (host-side kills cannot reliably reach in-container
    grandchildren — hence in-namespace enforcement, ADR-0006).

    Returns (stdout, stderr, exit_code, timed_out, duration_ms). exit_code is a
    negative signal number when the kernel/cgroup kills the process (e.g. -9 for
    an OOM-kill at the memory ceiling), which the Judge grades as RUNTIME_ERROR.
    """
    started = time.monotonic()
    proc = subprocess.Popen(
        command,
        cwd=WORKSPACE,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    try:
        stdout, stderr = proc.communicate(input=stdin_data, timeout=timeout_ms / 1000)
        timed_out = False
        exit_code = proc.returncode
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        try:
            stdout, stderr = proc.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            stdout, stderr = "", ""
        timed_out = True
        exit_code = None
    duration_ms = max(1, round((time.monotonic() - started) * 1000))
    return (
        truncate(stdout or ""),
        truncate(stderr or ""),
        exit_code,
        timed_out,
        duration_ms,
    )


def emit(result):
    json.dump(result, sys.stdout)
    sys.stdout.flush()


def main():
    job = json.load(sys.stdin)

    source_path = os.path.join(WORKSPACE, job["sourceFilename"])
    with open(source_path, "w", encoding="utf-8") as handle:
        handle.write(job["source"])

    compile_stdout, compile_stderr, compile_exit, compile_timed_out, compile_ms = (
        run_process(job["compileCommand"], job["compileTimeoutMs"], None)
    )

    if compile_timed_out or compile_exit != 0:
        emit(
            {
                "compile": {
                    "ok": False,
                    "timedOut": compile_timed_out,
                    "durationMs": compile_ms,
                    "stderr": compile_stderr or compile_stdout,
                },
                "cases": [],
                "error": None,
            }
        )
        return

    cases = []
    for case in job["cases"]:
        stdout, stderr, exit_code, timed_out, duration_ms = run_process(
            job["runCommand"], job["runTimeoutMs"], case.get("input", "")
        )
        cases.append(
            {
                "id": case["id"],
                "stdout": stdout,
                "stderr": stderr,
                "exitCode": exit_code,
                "timedOut": timed_out,
                "durationMs": duration_ms,
            }
        )

    emit(
        {
            "compile": {
                "ok": True,
                "timedOut": False,
                "durationMs": compile_ms,
                "stderr": "",
            },
            "cases": cases,
            "error": None,
        }
    )


if __name__ == "__main__":
    main()
