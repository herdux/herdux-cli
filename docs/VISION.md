# Herdux CLI: Project Vision

## The Problem

Managing local database systems via the terminal currently requires typing complex, verbose commands with numerous parameters (e.g., `pg_dump`, `pg_restore`, `mysqldump`). It is repetitive, error-prone, and creates unnecessary friction for developers just trying to do their jobs.

## The Goal

Herdux CLI exists to optimize and minimize database management commands.
Rather than forcing developers to memorize complete toolchain arguments, Herdux provides simple, practical syntax: `hdx create`, `hdx list`, `hdx restore`, `hdx backup`, `hdx clean`.

## The Name

**Herdux** is a portmanteau of **"herd"** and **"ux"** (User Experience). It represents the developer experience of managing a "herd" of databases effortlessly.

## The Evolution & Multi-Engine Architecture

What started as a personal tool for PostgreSQL has evolved into a fully scalable Open Source project.
The architecture dictates that the core CLI interface must remain Engine-Agnostic. This allows Herdux to scale seamlessly to support multiple database engines (e.g., MySQL, MongoDB, Redis, SQL Server) without changing the uniform developer experience.

## Open Source Philosophy

Herdux aims to be a vital utility for all backend developers. To reach this goal, the project strictly adheres to "Gold Standard" Open Source practices:

1. **Maintainability:** Code architecture must be scalable, well-documented, and strictly separated (Commands vs. Infra).
2. **Reliability:** Comprehensive Unit and End-to-End (E2E) tests must guarantee stability before any release.
3. **Collaboration:** The codebase and structure must be welcoming, easy to understand, and explicitly guided by rules (like `AGENTS.md`) so anyone in the community can contribute with confidence.
