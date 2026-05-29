# Sandbox toolchain image for the container-isolated Runner (ADR-0006). This is
# also ADR-0001's deferred candidate-#7 pinned-toolchain image: CI builds it and
# runs the isolation escape-attempt suite against it.
#
# The image ships the trusted, language-agnostic harness (harness.py) and the
# pinned toolchain. It carries NO isolation flags itself — network-off,
# read-only rootfs, non-root, cap-drop, pids/cpu/memory ceilings are all applied
# by the host adapter at `docker run` time (see sandbox-runner.ts).
FROM debian:bookworm-slim

# Pinned toolchain: C/C++ (gcc/g++), Java (JDK), Python 3. coreutils (already in
# the base) provides the process primitives the harness relies on.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     gcc \
     g++ \
     default-jdk-headless \
     python3 \
     ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Untrusted student code never runs as root — the adapter also passes
# --security-opt no-new-privileges so this cannot be escalated.
RUN useradd --create-home --uid 10001 sandbox

# The trusted harness (see ADR-0006 "Sandbox harness"). Read-only so student code
# running as `sandbox` cannot tamper with it.
COPY harness.py /opt/harness/harness.py
RUN chmod 0444 /opt/harness/harness.py

USER sandbox
WORKDIR /workspace

# The adapter overrides the command with `python3 /opt/harness/harness.py`; this
# default keeps the image runnable/inspectable on its own.
CMD ["python3", "/opt/harness/harness.py"]
