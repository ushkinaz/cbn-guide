#!/bin/bash

# Purpose: Runs the GitHub Actions CI pipeline locally using `act`.
# Useful when: Debugging CI workflows (e.g., OOM errors, test failures) without waiting for GitHub runners.
# Prerequisites:
# 1. Docker installed and running
# 2. `act` CLI installed (e.g., `brew install act` on macOS)

act pull_request \
--job build \
--workflows .github/workflows/ci.yml \
-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:gh-latest \
--container-options "--cpus=4 --memory=16g --memory-swap=16g --shm-size=2g"


# --container-architecture linux/amd64 \