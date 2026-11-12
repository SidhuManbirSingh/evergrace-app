/**
 * Domain vocabulary and business rules — PROJECT_SPEC.md §2 and §6.
 *
 * This module is the single source of truth for every rule the prototype
 * encoded in `renderVals()` (`computeTier`, `planRank`, `accessRank`,
 * `canView`, member-status derivation). It has no imports from Prisma, React,
 * or Next so it can be unit-tested directly (see src/lib/domain.test.ts) and
 * imported from both server and client components.
 */

// ---------------------------------------------------------------------------
// Enumerations (stored as strings — see the provider note in schema.prisma)
// ---------------------------------------------------------------------------

export const PLANS = ["BASIC", "MEMBER", "PREMIUM"] as const;
export type Plan = (typeof PLANS)[number];

export const ACCESS_LEVELS = ["FREE", "MEMBERS", "PREMIUM"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const VIDEO_STATUSES = ["DRAFT", "PROCESSING", "SCHEDULED", "PUBLISHED"] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];
export type ContentStatus = VideoStatus;

export const CONTENT_TYPES = ["VIDEO", "BLOG_POST"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const RELEASE_TRIGGERS = ["MANUAL_PUBLISH", "SCHEDULED_DUE"] as const;
export type ReleaseTrigger = (typeof RELEASE_TRIGGERS)[number];

export const TRACKS = ["SEATED", "SUPPORTED", "ACTIVE"] as const;
export type Track = (typeof TRACKS)[number];

export const MEMBER_STATUSES = ["ACTIVE", "AT_RISK", "INACTIVE"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const ROLES = ["MEMBER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const FOLLOW_KINDS = ["CATEGORY", "MASTER", "LEVEL"] as const;
export type FollowKind = (typeof FOLLOW_KINDS)[number];

export const INTENSITIES = ["GENTLE", "MODERATE"] as const;
export type Intensity = (typeof INTENSITIES)[number];

export const STANCES = ["SEATED", "SUPPORTED", "FREE_STANDING"] as const;
export type Stance = (typeof STANCES)[number];

export const SAVED_KINDS = ["subscribed", "liked", "favorite"] as const;
export type SavedKind = (typeof SAVED_KINDS)[number];

// ---------------------------------------------------------------------------
// Access control — the prototype's planRank / accessRank / canView
// ---------------------------------------------------------------------------

const PLAN_RANK: Record<Plan, number> = { BASIC: 0, MEMBER: 1, PREMIUM: 2 };
const ACCESS_RANK: Record<AccessLevel, number> = { FREE: 0, MEMBERS: 1, PREMIUM: 2 };

export function planRank(plan: Plan | null | undefined): number {
  return plan ? (PLAN_RANK[plan] ?? 0) : 0;
}

export function accessRank(access: AccessLevel | null | undefined): number {
  return access ? (ACCESS_RANK[access] ?? 0) : 0;
}

/**
 * Basic sees Free; Member sees Free + Members; Premium sees everything.
 * A signed-out visitor is treated as BASIC — they may browse, and Free videos
 * play, but anything above Free is locked.
 */
export function canView(
  video: { access: AccessLevel },
  viewer: { plan: Plan; role?: Role } | null | undefined,
): boolean {
  if (viewer?.role === "ADMIN") return true;
  return planRank(viewer?.plan ?? "BASIC") >= accessRank(video.access);
}

/** The lowest plan that unlocks a given access level. */
export function requiredPlanFor(access: AccessLevel): Plan {
  if (access === "PREMIUM") return "PREMIUM";
  if (access === "MEMBERS") return "MEMBER";
  return "BASIC";
}

/** Following masters and levels is a paid feature (spec §6.5). */
export function canFollow(plan: Plan): boolean {
  return planRank(plan) >= planRank("MEMBER");
}

// ---------------------------------------------------------------------------
// Health check-in — the prototype's computeTier(), rule-for-rule (spec §6.2)
// ---------------------------------------------------------------------------

export type HealthAnswers = {
  mobility: "seated" | "supported" | "free";
  surgery: "yes" | "no";
  dizzy: "often" | "sometimes" | "rarely";
  joints: "significant" | "little" | "none";
};

export function computeTrack(a: HealthAnswers): Track {
  if (a.surgery === "yes" || a.dizzy === "often" || a.mobility === "seated") {
    return "SEATED";
  }
  if (
    a.mobility === "supported" ||
    a.dizzy === "sometimes" ||
    a.joints === "significant" ||
    a.joints === "little"
  ) {
    return "SUPPORTED";
  }
  return "ACTIVE";
}

/** The stances a member on a given track should be offered by default. */
export function stancesForTrack(track: Track): Stance[] {
  if (track === "SEATED") return ["SEATED"];
  if (track === "SUPPORTED") return ["SEATED", "SUPPORTED"];
  return ["SEATED", "SUPPORTED", "FREE_STANDING"];
}

// ---------------------------------------------------------------------------
// Member status — derived, never stored (spec §6.9)
// ---------------------------------------------------------------------------

export const AT_RISK_AFTER_DAYS = 7;
export const INACTIVE_AFTER_DAYS = 14;
export const AT_RISK_PROGRESS_THRESHOLD = 25;

export function deriveMemberStatus(
  member: { lastActiveAt: Date; averageProgress: number },
  now: Date = new Date(),
): MemberStatus {
  const days = daysBetween(member.lastActiveAt, now);
  if (days > INACTIVE_AFTER_DAYS) return "INACTIVE";
  if (days > AT_RISK_AFTER_DAYS) return "AT_RISK";
  if (member.averageProgress < AT_RISK_PROGRESS_THRESHOLD) return "AT_RISK";
  return "ACTIVE";
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export function progressPercent(secondsWatched: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return clamp(Math.round((secondsWatched / durationSeconds) * 100), 0, 100);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * A practice "streak" is the number of consecutive days ending today (or
 * yesterday, so an evening practitioner doesn't lose the streak overnight)
 * on which the member recorded any activity.
 */
export function computeStreak(activityDates: Date[], now: Date = new Date()): number {
  const days = new Set(activityDates.map(toDayKey));
  if (days.size === 0) return 0;

  const todayKey = toDayKey(now);
  const cursor = new Date(now);
  if (!days.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(toDayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(toDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// ---------------------------------------------------------------------------
// Notification reason strings — built exactly as the prototype did (§6.8)
// ---------------------------------------------------------------------------

export function categoryReason(categoryName: string): string {
  return `New in ${categoryName}`;
}

export function masterReason(masterName: string): string {
  return `New from Master ${masterName}`;
}

export function levelReason(levelName: string): string {
  return `New in ${levelName}`;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const PLAN_LABEL: Record<Plan, string> = {
  BASIC: "Basic",
  MEMBER: "Member",
  PREMIUM: "Premium",
};

export const ACCESS_LABEL: Record<AccessLevel, string> = {
  FREE: "Free",
  MEMBERS: "Members",
  PREMIUM: "Premium",
};

export const TRACK_LABEL: Record<Track, string> = {
  SEATED: "Seated",
  SUPPORTED: "Supported",
  ACTIVE: "Active",
};

export const STATUS_LABEL: Record<VideoStatus, string> = {
  DRAFT: "Draft",
  PROCESSING: "Processing",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
};

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  ACTIVE: "Active",
  AT_RISK: "At risk",
  INACTIVE: "Inactive",
};

export const INTENSITY_LABEL: Record<Intensity, string> = {
  GENTLE: "Gentle",
  MODERATE: "Moderate",
};

export const STANCE_LABEL: Record<Stance, string> = {
  SEATED: "Seated",
  SUPPORTED: "Supported",
  FREE_STANDING: "Free standing",
};

export const TRACK_DESCRIPTION: Record<Track, string> = {
  SEATED:
    "You’ll begin with calming, seated movements that build balance and confidence safely from your chair.",
  SUPPORTED:
    "You’ll practice standing movements with a wall or chair nearby for steady, secure support.",
  ACTIVE:
    "You’re ready for free-standing practice. We’ll still keep every movement slow, gentle, and controlled.",
};

// Price, perks, and unlocks copy for each plan are DB-backed — see
// getPlanCatalog() in ./queries.ts. Only the enum→label map stays static
// here, alongside the other display-label maps below.

export const MOOD_LABEL: Record<number, string> = {
  1: "Stiff and tired — we’ll keep it very gentle today.",
  2: "A little low — easy does it.",
  3: "Feeling okay — a good day to move.",
  4: "Feeling good — nicely warmed up.",
  5: "Strong and ready — wonderful!",
};

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

export function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function relativeTime(date: Date, now: Date = new Date()): string {
  const mins = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

/** "Today" / "Yesterday" / "N days ago" — the admin roster's last-active column. */
export function lastActiveLabel(date: Date, now: Date = new Date()): string {
  const days = daysBetween(date, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Content Calendar & Observer Design Pattern (Mini-Project 2)
// ---------------------------------------------------------------------------

export type ReadinessResult = {
  ok: boolean;
  missing: string[];
};

export type ScheduleResult = {
  ok: boolean;
  message: string;
};

/**
 * Behavioural contract for any entity that can be scheduled on the Content Calendar.
 * Direct TypeScript translation of `evergrace.calendar.Schedulable`.
 */
export interface Schedulable {
  scheduleRelease(releaseAt: Date, now?: Date): void;
  reschedule(releaseAt: Date, now?: Date): void;
  unschedule(): void;
  publishNow(now?: Date): void;
  isReleased(now?: Date): boolean;
  isDue(now?: Date): boolean;
  getStatus(): ContentStatus;
  getPublishedAt(): Date | null;
}

/**
 * Pure temporal check (Invariant I3 / MP1 Step 5 Misuse Case Countermeasure):
 * Non-admin viewers may access content iff status === "PUBLISHED" and publishedAt <= now.
 */
export function isContentReleased(
  item: { status: ContentStatus; publishedAt?: Date | null },
  now: Date = new Date(),
): boolean {
  if (item.status !== "PUBLISHED") return false;
  if (!item.publishedAt) return true;
  return item.publishedAt.getTime() <= now.getTime();
}

/**
 * True when a SCHEDULED item's target release timestamp has arrived.
 */
export function isContentDue(
  item: { status: ContentStatus; publishedAt?: Date | null },
  now: Date = new Date(),
): boolean {
  return (
    item.status === "SCHEDULED" &&
    item.publishedAt != null &&
    item.publishedAt.getTime() <= now.getTime()
  );
}

/**
 * Requirement R2: A scheduled release timestamp must be strictly in the future.
 */
export function canScheduleRelease(releaseAt: Date, now: Date = new Date()): boolean {
  return !Number.isNaN(releaseAt.getTime()) && releaseAt.getTime() > now.getTime();
}

/**
 * Abstract base class for all publishable content in EverGrace (`VideoContent` and `BlogPostContent`).
 * Direct TypeScript translation of `evergrace.calendar.ContentItem`.
 */
export abstract class ContentItem implements Schedulable {
  readonly id: string;
  title: string;
  readonly slug: string;
  thumbnailUrl: string | null;
  protected status: ContentStatus;
  readonly createdAt: Date;
  protected publishedAt: Date | null;

  protected constructor(params: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl?: string | null;
    status: ContentStatus;
    createdAt?: Date;
    publishedAt?: Date | null;
  }) {
    this.id = params.id;
    this.title = params.title;
    this.slug = params.slug;
    this.thumbnailUrl = params.thumbnailUrl ?? null;
    this.status = params.status;
    this.createdAt = params.createdAt ?? new Date();
    this.publishedAt = params.publishedAt ?? null;
  }

  scheduleRelease(releaseAt: Date, now: Date = new Date()): void {
    if (this.status !== "DRAFT") {
      throw new Error(`Only DRAFT content can be scheduled (current: ${this.status}).`);
    }
    if (!canScheduleRelease(releaseAt, now)) {
      throw new Error("Release date must be in the future.");
    }
    const readiness = this.validateReadiness();
    if (!readiness.ok) {
      throw new Error(`Missing required fields: ${readiness.missing.join(", ")}`);
    }
    this.status = "SCHEDULED";
    this.publishedAt = releaseAt;
  }

  reschedule(releaseAt: Date, now: Date = new Date()): void {
    if (this.status !== "SCHEDULED") {
      throw new Error("Only SCHEDULED content can be rescheduled.");
    }
    if (!canScheduleRelease(releaseAt, now)) {
      throw new Error("Release date must be in the future.");
    }
    this.publishedAt = releaseAt;
  }

  unschedule(): void {
    if (this.status !== "SCHEDULED") {
      throw new Error("Only SCHEDULED content can be unscheduled.");
    }
    this.status = "DRAFT";
    this.publishedAt = null;
  }

  publishNow(now: Date = new Date()): void {
    const readiness = this.validateReadiness();
    if (!readiness.ok) {
      throw new Error(`Missing required fields: ${readiness.missing.join(", ")}`);
    }
    this.status = "PUBLISHED";
    if (!this.publishedAt || this.publishedAt.getTime() > now.getTime()) {
      this.publishedAt = now;
    }
  }

  isReleased(now: Date = new Date()): boolean {
    return isContentReleased({ status: this.status, publishedAt: this.publishedAt }, now);
  }

  isDue(now: Date = new Date()): boolean {
    return isContentDue({ status: this.status, publishedAt: this.publishedAt }, now);
  }

  getStatus(): ContentStatus {
    return this.status;
  }

  getPublishedAt(): Date | null {
    return this.publishedAt;
  }

  abstract validateReadiness(): ReadinessResult;
  abstract getContentType(): ContentType;
  abstract getPublicPath(): string;
}

/**
 * Concrete subclass of ContentItem representing a martial-arts training video.
 * Direct TypeScript translation of `evergrace.calendar.Video`.
 */
export class VideoContent extends ContentItem {
  readonly categoryId: string;
  readonly masterId: string | null;
  readonly levelId: string | null;
  readonly durationSeconds: number;
  readonly access: AccessLevel;
  readonly sourceUrl: string | null;
  readonly muxPlaybackId: string | null;
  readonly chapterCount: number;

  constructor(params: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl?: string | null;
    status: ContentStatus;
    createdAt?: Date;
    publishedAt?: Date | null;
    categoryId: string;
    masterId?: string | null;
    levelId?: string | null;
    durationSeconds: number;
    access?: AccessLevel;
    sourceUrl?: string | null;
    muxPlaybackId?: string | null;
    chapterCount?: number;
  }) {
    super(params);
    this.categoryId = params.categoryId;
    this.masterId = params.masterId ?? null;
    this.levelId = params.levelId ?? null;
    this.durationSeconds = params.durationSeconds;
    this.access = params.access ?? "FREE";
    this.sourceUrl = params.sourceUrl ?? null;
    this.muxPlaybackId = params.muxPlaybackId ?? null;
    this.chapterCount = params.chapterCount ?? 0;
  }

  validateReadiness(): ReadinessResult {
    const missing: string[] = [];
    if (!this.title.trim()) missing.push("title");
    if (!this.categoryId.trim()) missing.push("category");
    if (!this.masterId) missing.push("master (instructor)");
    if (this.chapterCount <= 0) missing.push("syllabus chapter");
    if (this.durationSeconds <= 0) missing.push("duration");
    if (!this.sourceUrl && !this.muxPlaybackId) missing.push("sourceUrl");
    return { ok: missing.length === 0, missing };
  }

  getContentType(): ContentType {
    return "VIDEO";
  }

  getPublicPath(): string {
    return `/library/${this.slug}`;
  }
}

/**
 * Concrete subclass of ContentItem representing a Steady Path Journal article.
 * Direct TypeScript translation of `evergrace.calendar.BlogPost`.
 */
export class BlogPostContent extends ContentItem {
  readonly category: string;
  readonly excerpt: string;
  readonly body: string;
  readonly readMinutes: number;

  constructor(params: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl?: string | null;
    status: ContentStatus;
    createdAt?: Date;
    publishedAt?: Date | null;
    category: string;
    excerpt: string;
    body: string;
    readMinutes: number;
  }) {
    if (params.status === "PROCESSING") {
      throw new Error("Invariant I4: BlogPost cannot have PROCESSING status.");
    }
    super(params);
    this.category = params.category;
    this.excerpt = params.excerpt;
    this.body = params.body;
    this.readMinutes = params.readMinutes;
  }

  validateReadiness(): ReadinessResult {
    const missing: string[] = [];
    if (!this.title.trim()) missing.push("title");
    if (!this.category.trim()) missing.push("category");
    if (this.excerpt.trim().length < 10) missing.push("excerpt (min 10 chars)");
    if (this.body.trim().length < 50) missing.push("body (min 50 chars)");
    if (this.readMinutes <= 0) missing.push("readMinutes");
    return { ok: missing.length === 0, missing };
  }

  getContentType(): ContentType {
    return "BLOG_POST";
  }

  getPublicPath(): string {
    return `/blog/${this.slug}`;
  }
}

/**
 * Immutable event payload emitted by ContentReleaseSubject whenever a ContentItem
 * transitions into PUBLISHED.
 */
export type ReleaseEvent = {
  readonly item: ContentItem;
  readonly previousStatus: ContentStatus;
  readonly releasedAt: Date;
  readonly trigger: ReleaseTrigger;
};

/**
 * Observer interface in the Observer pattern.
 */
export interface ReleaseObserver {
  onContentReleased(event: ReleaseEvent): void | Promise<void>;
}

/**
 * Subject interface in the Observer pattern.
 */
export interface ContentReleaseSubject {
  registerObserver(observer: ReleaseObserver): void;
  removeObserver(observer: ReleaseObserver): void;
  notifyObservers(event: ReleaseEvent): Promise<void>;
}

/**
 * Concrete Observer: ReleaseAuditObserver.
 * Records structured telemetry entries whenever content transitions to PUBLISHED.
 */
export class ReleaseAuditObserver implements ReleaseObserver {
  private readonly logs: string[] = [];

  onContentReleased(event: ReleaseEvent): void {
    const item = event.item;
    const publishedIso = item.getPublishedAt()?.toISOString() ?? event.releasedAt.toISOString();
    this.logs.push(
      `[${event.releasedAt.toISOString()}] ${item.title} (${item.getPublicPath()}) transitioned ${event.previousStatus} -> PUBLISHED via ${event.trigger} at ${publishedIso}`,
    );
  }

  getAuditLog(): readonly string[] {
    return this.logs;
  }
}

/**
 * Concrete Subject and domain coordinator for the Content Calendar.
 * Direct TypeScript translation of `evergrace.calendar.ContentCalendarService`.
 */
export class ContentCalendarService implements ContentReleaseSubject {
  private readonly observers: ReleaseObserver[] = [];
  private readonly catalogItems: ContentItem[] = [];

  registerContent(item: ContentItem): void {
    this.catalogItems.push(item);
  }

  registerObserver(observer: ReleaseObserver): void {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
    }
  }

  removeObserver(observer: ReleaseObserver): void {
    const idx = this.observers.indexOf(observer);
    if (idx >= 0) {
      this.observers.splice(idx, 1);
    }
  }

  async notifyObservers(event: ReleaseEvent): Promise<void> {
    for (const observer of [...this.observers]) {
      await observer.onContentReleased(event);
    }
  }

  scheduleRelease(
    item: ContentItem,
    releaseAt: Date,
    actor: { role?: Role } | null | undefined,
    now: Date = new Date(),
  ): ScheduleResult {
    if (actor?.role !== "ADMIN") {
      return { ok: false, message: "Forbidden: ADMIN role required." };
    }
    try {
      item.scheduleRelease(releaseAt, now);
      const kindLabel = item.getContentType() === "VIDEO" ? "Video" : "Blog post";
      return { ok: true, message: `${kindLabel} scheduled successfully.` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Unable to schedule." };
    }
  }

  reschedule(
    item: ContentItem,
    releaseAt: Date,
    actor: { role?: Role } | null | undefined,
    now: Date = new Date(),
  ): ScheduleResult {
    if (actor?.role !== "ADMIN") {
      return { ok: false, message: "Forbidden: ADMIN role required." };
    }
    try {
      item.reschedule(releaseAt, now);
      return { ok: true, message: "Release date updated." };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Unable to reschedule." };
    }
  }

  unschedule(item: ContentItem, actor: { role?: Role } | null | undefined): ScheduleResult {
    if (actor?.role !== "ADMIN") {
      return { ok: false, message: "Forbidden: ADMIN role required." };
    }
    try {
      item.unschedule();
      return { ok: true, message: `Returned “${item.title}” to Draft.` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Unable to unschedule." };
    }
  }

  async publishNow(
    item: ContentItem,
    actor: { role?: Role } | null | undefined,
    now: Date = new Date(),
  ): Promise<ScheduleResult> {
    if (actor?.role !== "ADMIN") {
      return { ok: false, message: "Forbidden: ADMIN role required." };
    }
    const before = item.getStatus();
    try {
      item.publishNow(now);
      if (before !== "PUBLISHED") {
        await this.notifyObservers({
          item,
          previousStatus: before,
          releasedAt: now,
          trigger: "MANUAL_PUBLISH",
        });
      }
      return { ok: true, message: `Published “${item.title}”.` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Unable to publish." };
    }
  }

  async releaseDue(now: Date = new Date()): Promise<ReleaseEvent[]> {
    const events: ReleaseEvent[] = [];
    const sorted = [...this.catalogItems].sort((a, b) => {
      const aTime = a.getPublishedAt()?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.getPublishedAt()?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    for (const item of sorted) {
      if (item.isDue(now)) {
        const before = item.getStatus();
        item.publishNow(now);
        const event: ReleaseEvent = {
          item,
          previousStatus: before,
          releasedAt: now,
          trigger: "SCHEDULED_DUE",
        };
        events.push(event);
        await this.notifyObservers(event);
      }
    }
    return events;
  }
}
