# Agent Usage

Complete reference for the 15 custom subagents in `C:\Users\LuC\.cursor\agents\` and `C:\Users\LuC\.claude\agents\`.

---

## Quick start

| Goal | Command |
|------|---------|
| Hand over an idea | `/orchestrator I want user registration with Spring + Next.js` |
| Call any specialist | `/agent-name` + task description |
| Force Anthropic models | `Use Anthropic models — /orchestrator …` |
| Force a specific model | `Use gpt-5.3-codex for /implementer on this refactor` |
| Parallel work | `Review API and update docs in parallel` or `/multitask` |

**Config files:**

- Agent definitions: `~/.cursor/agents/*.md` and `~/.claude/agents/*.md`
- Model registry: `models.config.yaml` (in both folders)

---

## Agent hierarchy

```
You
 └── /orchestrator          ← start here for ideas
      ├── /tech-lead        ← large multi-phase plans
      ├── /architect        ← design & ADRs
      ├── /implementer      ← production code
      ├── /automation-tester / /qa
      ├── /verifier
      ├── /security-reviewer / /pr-reviewer
      ├── /documentation-agent / /ui-designer
      └── /debugger / /ci-investigator / /infra-manager / /app-recorder
```

**Built-in subagents** (not in your folder): `explore`, `bash`, `browser` — used automatically by the chat Agent.

**Chat Agent** (not a file): the main Cursor session that coordinates subagents and runs tools.

---

## Master agent table

| Invoke | What it does | How to use | Read-only | Default model (`.cursor`) | Default model (`.claude`) | Allowed models |
|--------|--------------|------------|-----------|---------------------------|---------------------------|----------------|
| **`/orchestrator`** | Entry point for ideas → plan → delegate → verify end-to-end | `/orchestrator Build a task API with FastAPI and React, include tests and docs` | Yes | claude-opus-4-7-thinking-xhigh | claude-opus-4-7-thinking-xhigh | Anthropic: claude-opus-4-7-thinking-xhigh · OpenAI: gpt-5.5-medium · Fallback: claude-4.6-opus-high-thinking |
| **`/tech-lead`** | Technical phase planner for large full-stack builds | `/tech-lead Plan phases for auth module: Spring backend + Next frontend` | Yes | claude-4.6-sonnet-medium-thinking | claude-4.6-sonnet-medium-thinking | Anthropic: claude-4.6-sonnet-medium-thinking · OpenAI: gpt-5.4-medium · Fallback: claude-4.6-opus-high-thinking |
| **`/architect`** | System design, boundaries, API contracts, ADRs, tradeoffs | `/architect Review module layout for the orders service` | Yes | claude-4.6-opus-high-thinking | claude-4.6-opus-high-thinking | Anthropic: claude-4.6-opus-high-thinking · OpenAI: gpt-5.5-medium · Fallback: claude-opus-4-7-thinking-xhigh |
| **`/implementer`** | Writes production code (API, services, UI, migrations) | `/implementer Add POST /api/users with validation and JPA repository` | No | gpt-5.3-codex | claude-4.6-sonnet-medium-thinking | Anthropic: claude-4.6-sonnet-medium-thinking · OpenAI: gpt-5.3-codex · Fallback: composer-2.5-fast |
| **`/automation-tester`** | Writes/runs automated tests (JUnit, pytest, RTL, Playwright) | `/automation-tester Add integration tests for UserController` | No | gpt-5.3-codex | claude-4.5-sonnet-thinking | Anthropic: claude-4.5-sonnet-thinking · OpenAI: gpt-5.3-codex · Fallback: composer-2.5-fast |
| **`/qa`** | Test plans, manual cases, UAT, regression checklists | `/qa Write a test plan for the checkout release` | Yes | claude-4.5-haiku-thinking | claude-4.5-haiku-thinking | Anthropic: claude-4.5-haiku-thinking · OpenAI: gpt-5-mini · Google: gemini-3-flash |
| **`/verifier`** | Skeptical proof that work actually works (tests, APIs, migrations) | `/verifier Confirm login flow works end-to-end` | Yes | composer-2.5-fast | claude-4.5-haiku-thinking | Anthropic: claude-4.5-haiku-thinking · OpenAI: composer-2.5-fast · Google: gemini-3-flash |
| **`/debugger`** | Root-cause debugging (stack traces, 500s, ORM, hydration) | `/debugger Investigate this Spring bean creation error` | No | claude-4.6-sonnet-medium-thinking | claude-4.6-sonnet-medium-thinking | Anthropic: claude-4.6-sonnet-medium-thinking · OpenAI: gpt-5.4-medium · Fallback: claude-4.6-opus-high-thinking |
| **`/pr-reviewer`** | Holistic PR/branch review for merge readiness | `/pr-reviewer Review my branch changes before merge` | Yes | claude-4.6-sonnet-medium-thinking | claude-4.6-sonnet-medium-thinking | Anthropic: claude-4.6-sonnet-medium-thinking · OpenAI: gpt-5.4-medium · Fallback: claude-4.6-opus-high-thinking |
| **`/security-reviewer`** | Deep security audit (auth, JWT, injection, secrets) | `/security-reviewer Review JWT refresh in FastAPI + Next middleware` | Yes | claude-4.6-opus-high-thinking | claude-4.6-opus-high-thinking | Anthropic: claude-4.6-opus-high-thinking · OpenAI: gpt-5.5-medium · Fallback: claude-opus-4-7-thinking-xhigh |
| **`/ci-investigator`** | Read-only CI failure triage from logs | `/ci-investigator Why did GitHub Actions fail on Gradle test?` | Yes | claude-4.5-haiku-thinking | claude-4.5-haiku-thinking | Anthropic: claude-4.5-haiku-thinking · OpenAI: gpt-5-mini · Google: gemini-3-flash |
| **`/infra-manager`** | CI/CD, Docker, K8s, Terraform, deploy fixes | `/infra-manager Fix the GitHub Actions workflow for Next.js build` | No | gpt-5.3-codex | claude-4.6-sonnet-medium-thinking | Anthropic: claude-4.6-sonnet-medium-thinking · OpenAI: gpt-5.3-codex · Fallback: gpt-5.4-medium |
| **`/documentation-agent`** | README, OpenAPI, changelogs, PR descriptions from source | `/documentation-agent Update OpenAPI docs for the users API` | No | gpt-5.4-medium | claude-4.6-sonnet-medium-thinking | Anthropic: claude-4.6-sonnet-medium-thinking · OpenAI: gpt-5.4-medium · Fallback: gpt-5.5-medium |
| **`/ui-designer`** | React/Next UI/UX, a11y, responsive polish | `/ui-designer Review the login page for accessibility` | No | claude-4.6-sonnet-medium-thinking | claude-4.6-sonnet-medium-thinking | Anthropic: claude-4.6-sonnet-medium-thinking · OpenAI: gpt-5.4-medium · Google: gemini-3-flash |
| **`/app-recorder`** | Run app, capture demos/screenshots/repro steps | `/app-recorder Demo the registration flow in the browser` | No | gemini-3-flash | claude-4.5-haiku-thinking | Anthropic: claude-4.5-haiku-thinking · OpenAI: composer-2.5-fast · Google: gemini-3-flash |

---

## How to use (patterns)

### 1. Idea → full delivery (recommended)

```text
/orchestrator I want a REST task manager: FastAPI backend, Next.js frontend, JWT auth, tests, and docs
```

Orchestrator restates the goal, plans phases, delegates to specialists, and drives through verify/review.

### 2. Direct specialist

```text
/implementer Add Django model + serializer + viewset for Task
/debugger This pytest async client test fails with 422
/security-reviewer Audit the payment webhook handler
```

### 3. Natural language (no slash)

```text
Use the verifier subagent to confirm migrations apply cleanly
Have the automation-tester add Playwright tests for the checkout flow
```

### 4. Parallel execution

```text
/pr-reviewer and /security-reviewer review my auth changes in parallel
/automation-tester and /documentation-agent update tests and API docs in parallel
```

### 5. Model override

```text
Use Anthropic only — /orchestrator build the user profile feature
Use gpt-5.3-codex for /implementer on this refactor
Use gemini-3-flash for /app-recorder demo
```

Orchestrator picks from each agent's `models:` pool when delegating.

### 6. Standard full-stack pipeline

```text
/orchestrator → /architect (design) → /implementer (code) →
/automation-tester (tests) → /verifier (proof) → /pr-reviewer (merge check)
```

---

## Stack coverage

All agents support: **Spring Boot**, **FastAPI**, **Django**, **Node.js**, **React**, **Next.js**

| Stack | Primary agents |
|-------|----------------|
| Spring Boot | implementer, automation-tester, architect, verifier |
| FastAPI / Django | implementer, automation-tester, architect, verifier |
| Node.js | implementer, automation-tester, debugger |
| React / Next.js | implementer, ui-designer, app-recorder, automation-tester |

---

## Model system

### Fields in each agent `.md` file

| Field | Purpose |
|-------|---------|
| `model` | Active default Cursor uses at runtime |
| `models.anthropic` | Claude option |
| `models.openai` | OpenAI / Codex / Composer option |
| `models.google` | Gemini option (where defined) |
| `models.fallback` | Retry if primary fails or is unavailable |

### Platform defaults

| Folder | Strategy |
|--------|----------|
| `.cursor/agents` | Mixed — Codex for coding, Claude for reasoning, Gemini/Haiku for fast tasks |
| `.claude/agents` | **Anthropic-first** for every agent's active `model` |

### Where defaults differ between folders

| Agent | `.cursor` default | `.claude` default |
|-------|-------------------|-------------------|
| implementer | gpt-5.3-codex | claude-4.6-sonnet-medium-thinking |
| automation-tester | gpt-5.3-codex | claude-4.5-sonnet-thinking |
| infra-manager | gpt-5.3-codex | claude-4.6-sonnet-medium-thinking |
| documentation-agent | gpt-5.4-medium | claude-4.6-sonnet-medium-thinking |
| verifier | composer-2.5-fast | claude-4.5-haiku-thinking |
| app-recorder | gemini-3-flash | claude-4.5-haiku-thinking |

All other agents use the same default in both folders.

### Available provider pools (global)

**Anthropic:** claude-opus-4-7-thinking-xhigh, claude-4.6-opus-high-thinking, claude-4.6-sonnet-medium-thinking, claude-4.5-sonnet-thinking, claude-4.5-haiku-thinking

**OpenAI:** gpt-5.3-codex, gpt-5.4-medium, gpt-5.5-medium, gpt-5-mini, composer-2.5-fast

**Google:** gemini-3-flash, gemini-3.5-flash

> Cursor may fall back if a model isn't on your plan or is blocked by admin settings.

---

## Who to use (and who not to)

| Need | Use | Not |
|------|-----|-----|
| Raw idea → delivery | orchestrator | tech-lead alone |
| Large multi-phase build | tech-lead (via orchestrator) | architect alone |
| System design / ADRs | architect | implementer |
| Write production code | implementer | architect, verifier |
| Prove it works | verifier | qa, automation-tester |
| Test plans / UAT | qa | automation-tester |
| Write automated tests | automation-tester | qa |
| CI log triage | ci-investigator | infra-manager |
| Fix pipeline / deploy | infra-manager | ci-investigator |
| Runtime errors | debugger | ci-investigator |
| Deep security review | security-reviewer | pr-reviewer alone |
| General PR review | pr-reviewer | security-reviewer alone |
| Technical docs | documentation-agent | — |
| UI/UX review | ui-designer | app-recorder |
| Demo / screenshots | app-recorder | verifier |

---

## Workflow recipes

**New Spring Boot API feature**

```text
/architect API boundaries → /implementer → /automation-tester → /verifier → /documentation-agent
```

**FastAPI + Next.js full-stack**

```text
/orchestrator Plan and build user registration with email verification
```

**Pre-merge**

```text
/pr-reviewer and /security-reviewer in parallel → /qa release checklist
```

**Broken CI**

```text
/ci-investigator triage → /debugger or /infra-manager fix → /verifier confirm green
```

**UI change**

```text
/ui-designer review → /implementer → /app-recorder demo → /verifier
```

---

## Example prompts

```text
/orchestrator Build a REST API for task management with JWT auth. Backend in FastAPI, frontend in React.

/implementer Add Spring Boot controller, service, and repository for Order with pagination.

/verifier Run tests and confirm the new /api/users endpoint and frontend form work.

/debugger This Next.js hydration mismatch on the dashboard page.

/security-reviewer Review OAuth2 flow in Spring Security + Next.js middleware.

/ci-investigator Summarize why the Maven test step failed in GitHub Actions.

Use Anthropic models only — /orchestrator add export-to-CSV on the orders page.
```

---

*Last updated: July 2026 · 15 agents · Stacks: Spring Boot, FastAPI, Django, Node.js, React, Next.js*
