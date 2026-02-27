---
name: Bug Report
about: Create a report to help us improve Herdux.
title: "[BUG] "
labels: bug
assignees: ""
---

## 🐛 Bug Description

A clear and concise description of what the bug is. (e.g., When trying to backup MySQL while passing the --drop flag, Herdux crashes).

## 💻 How to Reproduce

Steps to reproduce the behavior:

1. `herdux config set engine mysql`
2. `herdux backup db_test --drop`
3. See error: ...

## 🩺 Herdux Doctor Output

Paste the result of running the doctor command (remove sensitive data if necessary):

```bash
hdx doctor --engine [your_engine]
# Your output here
```

## 🌍 Your Environment

- **OS**: [e.g., Ubuntu 22.04 LTS, macOS Sonoma 14.1]
- **Node Version**: [e.g., v20.10.0]
- **Herdux Version**: (Run `hdx version`)
- **Engine and Client Tool**: (e.g., PostgreSQL 16 local, MySQL 8 via Docker)

## 📸 Additional Screenshots / Logs

If applicable, add screenshots or full error logs (`--verbose` if available) from the terminal.

## 📝 Additional Context

Any other context (e.g., "I am running within a restricted terminal" or "The disk is 100% full").
