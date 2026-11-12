# Phase 4 — TypeScript Translation & `evergrace-app` Implementation

| Full Name          | Student ID | Email Address                    |
| ------------------ | ---------- | -------------------------------- |
| Yahya Chebab       | 300211534  | yahya.chebab@student.ufv.ca      |
| Riley Van Dam      | 300194967  | Riley.vandam@student.ufv.ca      |
| Manbir Singh Sidhu | 300200328  | ManbirSingh.Sidhu@student.ufv.ca |
| Jovan Siekham      | 300183572  | anmolak.siekham@student.ufv.ca   |

---

## 0. Phase 4 Scope, Requirements, and Steps

### Scope
Phase 4 translates our Phase 1 UML class design, Phase 2 Observer pattern, and Phase 3 Java reference implementation directly into EverGrace's TypeScript codebase (`evergrace-app`), following the four-tier architecture (`src/lib/domain.ts` → `src/lib/queries.ts` → `src/actions/admin-content.ts` → `src/components/admin/content-calendar.tsx`).

### Steps Completed in This Phase
1. **Persistence & Schema (`prisma/schema.prisma` & `database/init.sql`):**
   - Documented `SCHEDULED` in `Video.status` and added composite index `@@index([status, publishedAt])` on `Video` and `@@index([publishedAt])` on `BlogPost`.
2. **Domain Layer (`src/lib/domain.ts`):**
   - Extended `VIDEO_STATUSES` and `STATUS_LABEL` with `"SCHEDULED"`.
   - Translated `Schedulable`, `ContentItem`, `VideoContent`, `BlogPostContent`, `ReadinessResult`, `ReleaseEvent`, `ReleaseObserver`, `ContentReleaseSubject`, `ReleaseAuditObserver`, and `ContentCalendarService` into framework-free TypeScript.
   - Added pure temporal helper functions (`isContentReleased`, `isContentDue`, `canScheduleRelease`).
3. **Validation Layer (`src/lib/validation.ts`):**
   - Added `videoScheduleSchema` and `contentScheduleSchema` for server-side Zod validation.
4. **Query / Read Layer (`src/lib/queries.ts`):**
   - Enforced the **Mini-Project 1 Step 5 Misuse Case Countermeasure** (Invariant I3: `status === "PUBLISHED"` and `publishedAt <= now`) across `getCatalog`, `getVideoDetail`, `getDashboardData`, and `getSuggestedSession`.
   - Added `getCalendarData()` returning scheduled, draft, and published videos along with their readiness diagnostics.
5. **Observer & Mutation Layer (`src/lib/notifications.ts` & `src/actions/admin-content.ts`):**
   - Implemented `MemberNotificationObserver` (`src/lib/notifications.ts`) wrapping `fanOutNewVideo`.
   - Implemented `CacheRevalidationObserver` (`src/actions/admin-content.ts`) wrapping Next.js `revalidatePath`.
   - Implemented Server Actions `scheduleVideoRelease`, `unscheduleVideoRelease`, `publishScheduledVideoNow`, and `releaseDueVideos`.
6. **Presentation Layer (`src/components/ui/badge.tsx`, `src/components/admin/content-sub-tabs.tsx`, `src/app/admin/content/layout.tsx`, `src/components/admin/content-calendar.tsx`, `src/app/admin/content/calendar/page.tsx`):**
   - Added `"SCHEDULED"` badge styling to `VideoStatusBadge`.
   - Added the **Calendar** sub-tab under Admin → Content (`/admin/content/calendar`).
   - Built the interactive `ContentCalendar` component and scheduling modal.
7. **Unit Tests (`src/lib/domain.test.ts`):**
   - Added unit tests covering `isContentReleased`, `canScheduleRelease`, `VideoContent` / `BlogPostContent` readiness and invariants, and `ContentCalendarService` observer notifications.

---

## 1. Side-by-Side Java ↔ TypeScript Translation

### 1.1 `Schedulable` & `ContentItem` (Abstract Base Class + Template Method)

| Java (`mini-project-2/java/evergrace/calendar/ContentItem.java`) | TypeScript (`src/lib/domain.ts`) |
| --- | --- |
| `public interface Schedulable` | `export interface Schedulable` |
| `public abstract class ContentItem implements Schedulable` | `export abstract class ContentItem implements Schedulable` |
| `public abstract ReadinessResult validateReadiness();` | `abstract validateReadiness(): ReadinessResult;` |
| `public void scheduleRelease(Instant releaseAt, Instant now)` | `scheduleRelease(releaseAt: Date, now: Date = new Date()): void` |
| `public boolean isReleased(Instant now)` | `isReleased(now: Date = new Date()): boolean` |

### 1.2 Concrete Subclasses (`Video` & `BlogPost`)

| Java (`Video.java` / `BlogPost.java`) | TypeScript (`src/lib/domain.ts`) |
| --- | --- |
| `public final class Video extends ContentItem` | `export class VideoContent extends ContentItem` |
| `public final class BlogPost extends ContentItem` | `export class BlogPostContent extends ContentItem` |
| `getPublicPath()` → `"/library/" + slug` or `"/blog/" + slug` | `getPublicPath()` → `` `/library/${this.slug}` `` or `` `/blog/${this.slug}` `` |

### 1.3 Observer Pattern (`ContentReleaseSubject` & `ReleaseObserver`)

| Pattern Participant | Java (`mini-project-2/java/evergrace/calendar/`) | TypeScript (`evergrace-app/src/`) |
| --- | --- | --- |
| **Subject Interface** | `ContentReleaseSubject.java` | `ContentReleaseSubject` in `src/lib/domain.ts` |
| **Concrete Subject** | `ContentCalendarService.java` | `ContentCalendarService` in `src/lib/domain.ts` |
| **Observer Interface** | `ReleaseObserver.java` (`void onContentReleased(ReleaseEvent)`) | `ReleaseObserver` in `src/lib/domain.ts` (`onContentReleased(event): void \| Promise<void>`) |
| **Concrete Observer 1** | `MemberNotificationObserver.java` | `MemberNotificationObserver` in `src/lib/notifications.ts` |
| **Concrete Observer 2** | `CacheRevalidationObserver.java` | `CacheRevalidationObserver` in `src/actions/admin-content.ts` |
| **Concrete Observer 3** | `ReleaseAuditObserver.java` | `ReleaseAuditObserver` in `src/lib/domain.ts` |

---

## 2. How Key Language Differences Were Handled

1. **Synchronous vs. Asynchronous Observer Dispatch:**
   - In Java (`ContentReleaseSubject`), `notifyObservers(ReleaseEvent event)` is synchronous (`void`) because in-memory collections are mutated directly.
   - In TypeScript (`src/lib/domain.ts`), `ReleaseObserver.onContentReleased` returns `void | Promise<void>` and `notifyObservers` is `async` (`Promise<void>`). This allows pure in-memory observers (`ReleaseAuditObserver` in unit tests) to run synchronously while database-backed observers (`MemberNotificationObserver` calling Prisma in `src/lib/notifications.ts`) run asynchronously without changing the `ReleaseObserver` interface.
2. **Prisma Table-Per-Concrete-Class Hydration:**
   - Because Prisma generates flat row types (`prisma.video` and `prisma.blogPost`) rather than class hierarchies, `buildDomainVideo()` in `src/actions/admin-content.ts` and `getCalendarData()` in `src/lib/queries.ts` hydrate `VideoContent` instances from Prisma rows, execute the domain state machine and readiness checks, and persist the resulting `status` and `publishedAt` back to Postgres.
3. **Temporal Query Scoping (Misuse Case Protection):**
   - Both the database query (`OR: [{ publishedAt: null }, { publishedAt: { lte: now } }]` in `getCatalog`, `getDashboardData`, and `getSuggestedSession`) and the application-level guard (`isContentReleased()` in `getVideoDetail`) enforce Invariant I3 so unreleased scheduled videos cannot be accessed early via direct slug URLs (`/library/[slug]`).

