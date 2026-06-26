# AGENTS.md — project-druzya (monorepo index)

This repo groups independent services under `services/<name>/`.

**Do not use a root Makefile** — each service is self-contained.

When working on a service, **open only that service folder** (e.g. `services/identity/`) and read its local `AGENTS.md`:

| Service | AGENTS.md |
|---------|-----------|
| identity | [services/identity/AGENTS.md](services/identity/AGENTS.md) |
| content | [services/content/AGENTS.md](services/content/AGENTS.md) |
| interview | [services/interview/AGENTS.md](services/interview/AGENTS.md) |
| ai | [services/ai/AGENTS.md](services/ai/AGENTS.md) |
| sandbox | [services/sandbox/AGENTS.md](services/sandbox/AGENTS.md) |
| billing | [services/billing/AGENTS.md](services/billing/AGENTS.md) |

Root `go.work` is optional convenience for multi-module IDE sessions. Services build with `GOWORK=off` and do not depend on monorepo root files.
