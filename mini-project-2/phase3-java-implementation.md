# Phase 3 — Java Reference Implementation (Content Calendar & Observer Pattern)

| Full Name          | Student ID | Email Address                    |
| ------------------ | ---------- | -------------------------------- |
| Yahya Chebab       | 300211534  | yahya.chebab@student.ufv.ca      |
| Riley Van Dam      | 300194967  | Riley.vandam@student.ufv.ca      |
| Manbir Singh Sidhu | 300200328  | ManbirSingh.Sidhu@student.ufv.ca |
| Jovan Siekham      | 300183572  | anmolak.siekham@student.ufv.ca   |

---

## 0. Phase 3 Scope, Requirements, and Steps

### Scope
Phase 3 expresses the Phase 1 UML class diagram and Phase 2 Observer pattern in compilable, self-contained **Java 21** code (`mini-project-2/java/evergrace/calendar/`). Every class, interface, enum, method signature, and invariant uses our feature's actual EverGrace domain names rather than textbook placeholders.

### Files Implemented (`mini-project-2/java/evergrace/calendar/`)

| File | UML / Pattern Role | Key Responsibilities |
| ---- | ------------------ | -------------------- |
| [`Schedulable.java`](./java/evergrace/calendar/Schedulable.java) | «interface» | Scheduling contract (`scheduleRelease`, `reschedule`, `unschedule`, `publishNow`, `isReleased`, `isDue`). |
| [`ContentItem.java`](./java/evergrace/calendar/ContentItem.java) | «abstract» base class | Holds shared attributes (`id`, `title`, `slug`, `thumbnailUrl`, `status`, `createdAt`, `publishedAt`) and implements the scheduling state machine once, delegating subtype readiness checks to `validateReadiness()`. |
| [`Video.java`](./java/evergrace/calendar/Video.java) | Concrete Subclass (`extends ContentItem`) | Aggregates `Category`, `Master`, `Level`; composes `Chapter` → `Lesson`; validates readiness (`master`, `chapters`, `durationSeconds`, `sourceUrl`). |
| [`BlogPost.java`](./java/evergrace/calendar/BlogPost.java) | Concrete Subclass (`extends ContentItem`) | Enforces Invariant I4 (cannot be `PROCESSING`); validates `category`, `excerpt`, `body`, and `readMinutes`. |
| [`CatalogModels.java`](./java/evergrace/calendar/CatalogModels.java) | Domain Entities | `Category`, `Master`, `Level`, `Chapter`, `Lesson`, `User`, `Role`, `Follow`, `FollowKind`, `Notification`. |
| [`ContentStatus.java`](./java/evergrace/calendar/ContentStatus.java) | «enumeration» | `DRAFT`, `PROCESSING`, `SCHEDULED`, `PUBLISHED`. |
| [`ContentType.java`](./java/evergrace/calendar/ContentType.java) | «enumeration» | `VIDEO`, `BLOG_POST`. |
| [`ReadinessResult.java`](./java/evergrace/calendar/ReadinessResult.java) | «valueObject» | `{ ok, missing }` returned by `validateReadiness()`. |
| [`ReleaseTrigger.java`](./java/evergrace/calendar/ReleaseTrigger.java) | «enumeration» | `MANUAL_PUBLISH`, `SCHEDULED_DUE`. |
| [`ReleaseEvent.java`](./java/evergrace/calendar/ReleaseEvent.java) | «valueObject» | Immutable event payload carrying `item`, `previousStatus`, `releasedAt`, and `trigger`. |
| [`ReleaseObserver.java`](./java/evergrace/calendar/ReleaseObserver.java) | **Observer** «interface» | Declares `void onContentReleased(ReleaseEvent event)`. |
| [`ContentReleaseSubject.java`](./java/evergrace/calendar/ContentReleaseSubject.java) | **Subject** «interface» | Declares `registerObserver`, `removeObserver`, and `notifyObservers`. |
| [`MemberNotificationObserver.java`](./java/evergrace/calendar/MemberNotificationObserver.java) | **Concrete Observer 1** | Matches subscriber `Follow` records against a released `Video`, prioritizes `Master > Level > Category`, deduplicates per member, and enforces Invariant I6. |
| [`CacheRevalidationObserver.java`](./java/evergrace/calendar/CacheRevalidationObserver.java) | **Concrete Observer 2** | Records route paths (`/admin/content/calendar`, `/dashboard`, `/library/<slug>`, `/blog/<slug>`) invalidated when content goes live. |
| [`ReleaseAuditObserver.java`](./java/evergrace/calendar/ReleaseAuditObserver.java) | **Concrete Observer 3** | Appends structured audit log entries for every release transition. |
| [`ContentCalendarService.java`](./java/evergrace/calendar/ContentCalendarService.java) | **Concrete Subject** & Control | Enforces `ADMIN` role checks, coordinates scheduling/rescheduling/unscheduling/publishing, runs `releaseDue(now)`, notifies registered observers, and constructs the `ContentCalendar` read model (`CalendarDay` composition). |
| [`ContentCalendarDemo.java`](./java/evergrace/calendar/ContentCalendarDemo.java) | Executable Driver | Exercises requirements R1–R8 and invariants I1–I6 end to end. |

---

## 1. How to Compile and Run

From `mini-project-2/java`:

```bash
javac -encoding UTF-8 evergrace/calendar/*.java
java -cp . evergrace.calendar.ContentCalendarDemo
```

---

## 2. Verified Output from `ContentCalendarDemo`

```text
=== 1. Role Authorization Check (Requirement R5) ===
Non-admin schedule attempt: ScheduleResult[ok=false, message=Forbidden: ADMIN role required.]

=== 2. Readiness Guard Check (Requirement R3) ===
Incomplete video schedule attempt: ScheduleResult[ok=false, message=Missing required fields: master (instructor), syllabus chapter]

=== 3. Past Timestamp Guard Check (Requirement R2) ===
Past timestamp attempt: ScheduleResult[ok=false, message=Release date must be in the future.]

=== 4. Valid Scheduling of Video & BlogPost (Requirements R1, R6) ===
Video schedule result: ScheduleResult[ok=true, message=Video scheduled successfully for 2026-11-15T14:00:00Z.]
BlogPost schedule result: ScheduleResult[ok=true, message=Blog post scheduled successfully for 2026-11-15T14:00:00Z.]

=== 5. Misuse Case Countermeasure (Requirement R4 / Invariant I3) ===
Is scheduled video visible to members at t=now? false
Calendar entries on 2026-11-15: 2

=== 6. Scheduled Release & Observer Fan-Out (Requirement R7) ===
Events emitted: 2
Is video visible to members after releaseDue? true

--- Observer 1: MemberNotificationObserver ---
  Notification[user=user-margaret, video=vid-incomplete, reason="New from Master Kenneth Brake"]
  Notification[user=user-frank, video=vid-incomplete, reason="New in Level 1 Building Support"]

--- Observer 2: CacheRevalidationObserver ---
  revalidated: /admin/content/calendar
  revalidated: /dashboard
  revalidated: /admin/videos
  revalidated: /library
  revalidated: /library/gentle-balance-week-4
  revalidated: /admin/content/blog
  revalidated: /blog
  revalidated: /blog/slow-exhalations-steady-footing

--- Observer 3: ReleaseAuditObserver ---
  [2026-11-15T14:05:00Z] Gentle Balance - Week 4 (/library/gentle-balance-week-4) transitioned SCHEDULED -> PUBLISHED via SCHEDULED_DUE at 2026-11-15T14:00:00Z
  [2026-11-15T14:05:00Z] Why Slow Exhalations Steady Your Footing (/blog/slow-exhalations-steady-footing) transitioned SCHEDULED -> PUBLISHED via SCHEDULED_DUE at 2026-11-15T14:00:00Z
```

