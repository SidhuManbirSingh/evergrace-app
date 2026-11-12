# Mini-Project 2 — Content Calendar: Design, Pattern, and Implementation

| Full Name          | Student ID | Email Address                    |
| ------------------ | ---------- | -------------------------------- |
| Yahya Chebab       | 300211534  | yahya.chebab@student.ufv.ca      |
| Riley Van Dam      | 300194967  | Riley.vandam@student.ufv.ca      |
| Manbir Singh Sidhu | 300200328  | ManbirSingh.Sidhu@student.ufv.ca |
| Jovan Siekham      | 300183572  | anmolak.siekham@student.ufv.ca   |

Mini-Project 2 continues from Mini-Project 1. In MP1 we picked the **Content Calendar**
feature slice and wrote its use case ("Admin schedules draft video for future calendar
release") and misuse case (getting at unreleased content through the URL). MP2 turns that
idea into a design that a teammate could build from without asking us anything.

**Branch:** `feature/mini-project-2-content-calendar`

## Deliverables by phase

| Phase | Deliverable | Location | Status |
| ----- | ----------- | -------- | ------ |
<<<<<<< HEAD
| 1 | UML class diagram, relationship classification, interface/abstract and is-a/has-a decisions, data contract | [phase1-class-diagram.md](./phase1-class-diagram.md) | Complete |
| 2 | Design problem, plus the pattern that solves it (Observer) and why | `phase2-design-pattern.md` | Next |
| 3 | Java implementation of the pattern, using our feature's real class names | `java/` | Pending |
| 4 | Translation of the Java design into EverGrace's TypeScript code (domain → queries → actions → components) | `src/**` + `phase4-typescript-translation.md` | Pending |
=======
| 1 | UML class diagram, relationship classification, interface/abstract and is-a/has-a decisions, data contract | [phase1-class-diagram.md](./phase1-class-diagram.md) | ✅ Complete |
| 2 | Design problem, plus the pattern that solves it (Observer) and why | [phase2-design-pattern.md](./phase2-design-pattern.md) | ✅ Complete |
| 3 | Java implementation of the pattern, using our feature's real class names | [phase3-java-implementation.md](./phase3-java-implementation.md) & [`java/`](./java/evergrace/calendar/) | ✅ Complete |
| 4 | Translation of the Java design into EverGrace's TypeScript code (domain → queries → actions → components) | [phase4-typescript-translation.md](./phase4-typescript-translation.md) & [`src/`](../src/) | ✅ Complete |
>>>>>>> 958a77a (docs(mp2): phase 4 - document TypeScript translation and update Mini-Project 2 README)

## How MP1 maps to MP2

| MP1 artifact | What it becomes in MP2 |
| ------------ | ---------------------- |
| Step 1: proposed `ContentItem` parent of `Video` and `BlogPost` | The abstract class at the centre of the Phase 1 diagram |
| Step 1: `status` / `publishedAt` drive state | The `ContentStatus` state machine, plus invariants I1–I3 |
| Step 2: domain → queries → actions → components layering | Where each Phase 1 class lives in TypeScript (Phase 4) |
| Step 4: `scheduleVideoRelease(input)`, `videoScheduleSchema` | Operations on `ContentCalendarService` and the Zod contract |
| Step 4: alternate flow "missing mandatory fields" | The `ContentItem.validateReadiness()` abstract hook |
| Step 5: `publishedAt <= now` query scope | Invariant I3, which every public read model must enforce |

