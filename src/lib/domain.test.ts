import { describe, expect, it } from "vitest";

import {
  BlogPostContent,
  canFollow,
  canScheduleRelease,
  canView,
  computeStreak,
  computeTrack,
  ContentCalendarService,
  deriveMemberStatus,
  formatDuration,
  formatTimecode,
  isContentDue,
  isContentReleased,
  lastActiveLabel,
  planRank,
  progressPercent,
  ReleaseAuditObserver,
  requiredPlanFor,
  slugify,
  VideoContent,
  type HealthAnswers,
  type ReleaseEvent,
  type ReleaseObserver,
} from "./domain";

const baseAnswers: HealthAnswers = {
  mobility: "free",
  surgery: "no",
  dizzy: "rarely",
  joints: "none",
};

const days = (n: number) => new Date(Date.now() - n * 86_400_000);

describe("computeTrack — ports the prototype's computeTier()", () => {
  it("returns ACTIVE only when every answer is unrestricted", () => {
    expect(computeTrack(baseAnswers)).toBe("ACTIVE");
  });

  it("routes recent surgery to SEATED regardless of mobility", () => {
    expect(computeTrack({ ...baseAnswers, surgery: "yes" })).toBe("SEATED");
  });

  it("routes frequent dizziness to SEATED", () => {
    expect(computeTrack({ ...baseAnswers, dizzy: "often" })).toBe("SEATED");
  });

  it("routes a seated mobility preference to SEATED", () => {
    expect(computeTrack({ ...baseAnswers, mobility: "seated" })).toBe("SEATED");
  });

  it("prefers SEATED over SUPPORTED when both would apply", () => {
    // supported mobility would be SUPPORTED, but surgery outranks it.
    expect(computeTrack({ ...baseAnswers, mobility: "supported", surgery: "yes" })).toBe("SEATED");
  });

  it("routes supported mobility to SUPPORTED", () => {
    expect(computeTrack({ ...baseAnswers, mobility: "supported" })).toBe("SUPPORTED");
  });

  it("routes occasional dizziness to SUPPORTED", () => {
    expect(computeTrack({ ...baseAnswers, dizzy: "sometimes" })).toBe("SUPPORTED");
  });

  it("routes any joint pain — even 'a little' — to SUPPORTED", () => {
    expect(computeTrack({ ...baseAnswers, joints: "little" })).toBe("SUPPORTED");
    expect(computeTrack({ ...baseAnswers, joints: "significant" })).toBe("SUPPORTED");
  });
});

describe("canView — plan gating", () => {
  const free = { access: "FREE" } as const;
  const members = { access: "MEMBERS" } as const;
  const premium = { access: "PREMIUM" } as const;

  it("lets Basic see only Free videos", () => {
    const viewer = { plan: "BASIC" } as const;
    expect(canView(free, viewer)).toBe(true);
    expect(canView(members, viewer)).toBe(false);
    expect(canView(premium, viewer)).toBe(false);
  });

  it("lets Member see Free and Members videos", () => {
    const viewer = { plan: "MEMBER" } as const;
    expect(canView(free, viewer)).toBe(true);
    expect(canView(members, viewer)).toBe(true);
    expect(canView(premium, viewer)).toBe(false);
  });

  it("lets Premium see everything", () => {
    const viewer = { plan: "PREMIUM" } as const;
    expect(canView(premium, viewer)).toBe(true);
  });

  it("treats a signed-out visitor as Basic", () => {
    expect(canView(free, null)).toBe(true);
    expect(canView(members, null)).toBe(false);
  });

  it("lets an admin preview any tier", () => {
    expect(canView(premium, { plan: "BASIC", role: "ADMIN" })).toBe(true);
  });

  it("orders plans BASIC < MEMBER < PREMIUM", () => {
    expect(planRank("BASIC")).toBeLessThan(planRank("MEMBER"));
    expect(planRank("MEMBER")).toBeLessThan(planRank("PREMIUM"));
  });
});

describe("requiredPlanFor", () => {
  it("maps each access tier to the cheapest plan that unlocks it", () => {
    expect(requiredPlanFor("FREE")).toBe("BASIC");
    expect(requiredPlanFor("MEMBERS")).toBe("MEMBER");
    expect(requiredPlanFor("PREMIUM")).toBe("PREMIUM");
  });
});

describe("canFollow — following is a paid feature", () => {
  it("blocks Basic and allows paid plans", () => {
    expect(canFollow("BASIC")).toBe(false);
    expect(canFollow("MEMBER")).toBe(true);
    expect(canFollow("PREMIUM")).toBe(true);
  });
});

describe("deriveMemberStatus", () => {
  const now = new Date("2026-07-25T12:00:00Z");
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000);

  it("marks a recently active member with good progress ACTIVE", () => {
    expect(deriveMemberStatus({ lastActiveAt: at(1), averageProgress: 70 }, now)).toBe("ACTIVE");
  });

  it("marks someone quiet for over a week AT_RISK", () => {
    expect(deriveMemberStatus({ lastActiveAt: at(9), averageProgress: 70 }, now)).toBe("AT_RISK");
  });

  it("marks someone quiet for over two weeks INACTIVE", () => {
    expect(deriveMemberStatus({ lastActiveAt: at(20), averageProgress: 70 }, now)).toBe("INACTIVE");
  });

  it("marks a recently active member with low progress AT_RISK", () => {
    expect(deriveMemberStatus({ lastActiveAt: at(0), averageProgress: 10 }, now)).toBe("AT_RISK");
  });

  it("prefers INACTIVE over AT_RISK when both apply", () => {
    expect(deriveMemberStatus({ lastActiveAt: at(30), averageProgress: 5 }, now)).toBe("INACTIVE");
  });

  it("uses 25% as the progress threshold", () => {
    expect(deriveMemberStatus({ lastActiveAt: at(0), averageProgress: 25 }, now)).toBe("ACTIVE");
    expect(deriveMemberStatus({ lastActiveAt: at(0), averageProgress: 24 }, now)).toBe("AT_RISK");
  });
});

describe("progressPercent", () => {
  it("rounds to a whole percent", () => {
    expect(progressPercent(300, 720)).toBe(42);
  });

  it("clamps above 100 and below 0", () => {
    expect(progressPercent(900, 720)).toBe(100);
    expect(progressPercent(-10, 720)).toBe(0);
  });

  it("returns 0 for a zero-length video rather than dividing by zero", () => {
    expect(progressPercent(60, 0)).toBe(0);
  });
});

describe("computeStreak", () => {
  it("returns 0 with no activity", () => {
    expect(computeStreak([])).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(computeStreak([days(0), days(1), days(2)])).toBe(3);
  });

  it("survives an evening practitioner who hasn't practised yet today", () => {
    expect(computeStreak([days(1), days(2)])).toBe(2);
  });

  it("breaks when a day is missed", () => {
    expect(computeStreak([days(0), days(1), days(3)])).toBe(2);
  });

  it("returns 0 when the last activity is older than yesterday", () => {
    expect(computeStreak([days(4), days(5)])).toBe(0);
  });

  it("counts a day once even with several sessions", () => {
    expect(computeStreak([days(0), days(0), days(0)])).toBe(1);
  });
});

describe("formatting helpers", () => {
  it("formats durations in whole minutes, as the prototype did", () => {
    expect(formatDuration(720)).toBe("12 min");
    expect(formatDuration(540)).toBe("9 min");
  });

  it("formats timecodes as m:ss", () => {
    expect(formatTimecode(12)).toBe("0:12");
    expect(formatTimecode(123)).toBe("2:03");
  });

  it("labels last-active dates the way the roster does", () => {
    const now = new Date("2026-07-25T12:00:00Z");
    expect(lastActiveLabel(new Date("2026-07-25T09:00:00Z"), now)).toBe("Today");
    expect(lastActiveLabel(new Date("2026-07-24T09:00:00Z"), now)).toBe("Yesterday");
    expect(lastActiveLabel(new Date("2026-07-17T09:00:00Z"), now)).toBe("8 days ago");
  });

  it("slugifies titles into URL-safe ids", () => {
    expect(slugify("Seated Balance & Breathing")).toBe("seated-balance-breathing");
    expect(slugify("Standing Tall: Wall-Supported Stances")).toBe(
      "standing-tall-wall-supported-stances",
    );
  });
});

describe("ContentCalendar & Observer Pattern (Mini-Project 2)", () => {
  const now = new Date("2026-11-12T10:00:00Z");
  const futureDate = new Date("2026-11-15T14:00:00Z");
  const pastDate = new Date("2026-11-10T09:00:00Z");

  function makeReadyDraftVideo(id = "vid-1", slug = "gentle-balance-week-4") {
    return new VideoContent({
      id,
      title: "Gentle Balance - Week 4",
      slug,
      status: "DRAFT",
      createdAt: now,
      publishedAt: null,
      categoryId: "cat-balance",
      masterId: "master-ken",
      levelId: "lvl-1",
      durationSeconds: 900,
      access: "MEMBERS",
      sourceUrl: "https://stream.evergrace.example/gentle-balance-week-4.mp4",
      chapterCount: 2,
    });
  }

  function makeReadyDraftPost(id = "post-1", slug = "slow-exhalations-steady-footing") {
    return new BlogPostContent({
      id,
      title: "Why Slow Exhalations Steady Your Footing",
      slug,
      status: "DRAFT",
      createdAt: now,
      publishedAt: null,
      category: "Breathing",
      excerpt: "How a four-second exhale lowers your centre of gravity before stepping.",
      body: "Practicing a calm four-second exhalation before shifting weight relaxes the upper shoulders and stabilizes your stance.",
      readMinutes: 5,
    });
  }

  it("enforces Invariant I3 (Misuse Case Countermeasure) via isContentReleased", () => {
    expect(isContentReleased({ status: "DRAFT", publishedAt: null }, now)).toBe(false);
    expect(isContentReleased({ status: "SCHEDULED", publishedAt: futureDate }, now)).toBe(false);
    expect(isContentReleased({ status: "SCHEDULED", publishedAt: pastDate }, now)).toBe(false);
    expect(isContentReleased({ status: "PUBLISHED", publishedAt: futureDate }, now)).toBe(false);
    expect(isContentReleased({ status: "PUBLISHED", publishedAt: pastDate }, now)).toBe(true);
    expect(isContentReleased({ status: "PUBLISHED", publishedAt: null }, now)).toBe(true);
  });

  it("rejects non-admin actors on all calendar operations (Requirement R5)", () => {
    const service = new ContentCalendarService();
    const video = makeReadyDraftVideo();
    const result = service.scheduleRelease(video, futureDate, { role: "MEMBER" }, now);
    expect(result.ok).toBe(false);
    expect(video.getStatus()).toBe("DRAFT");
  });

  it("rejects scheduling a video that is missing mandatory fields (Requirement R3)", () => {
    const service = new ContentCalendarService();
    const incomplete = new VideoContent({
      id: "vid-incomplete",
      title: "Incomplete Video",
      slug: "incomplete-video",
      status: "DRAFT",
      categoryId: "cat-balance",
      masterId: null,
      durationSeconds: 600,
      sourceUrl: "https://stream.evergrace.example/video.mp4",
      chapterCount: 0,
    });

    const readiness = incomplete.validateReadiness();
    expect(readiness.ok).toBe(false);
    expect(readiness.missing).toContain("master (instructor)");
    expect(readiness.missing).toContain("syllabus chapter");

    const result = service.scheduleRelease(incomplete, futureDate, { role: "ADMIN" }, now);
    expect(result.ok).toBe(false);
    expect(incomplete.getStatus()).toBe("DRAFT");
  });

  it("rejects past or present timestamps when scheduling (Requirement R2)", () => {
    const service = new ContentCalendarService();
    const video = makeReadyDraftVideo();
    expect(canScheduleRelease(pastDate, now)).toBe(false);
    expect(canScheduleRelease(now, now)).toBe(false);
    expect(canScheduleRelease(futureDate, now)).toBe(true);

    const res = service.scheduleRelease(video, pastDate, { role: "ADMIN" }, now);
    expect(res.ok).toBe(false);
    expect(res.message).toContain("future");
  });

  it("schedules, reschedules, and unschedules both VideoContent and BlogPostContent (Requirements R1, R6)", () => {
    const service = new ContentCalendarService();
    const video = makeReadyDraftVideo();
    const post = makeReadyDraftPost();

    expect(service.scheduleRelease(video, futureDate, { role: "ADMIN" }, now).ok).toBe(true);
    expect(video.getStatus()).toBe("SCHEDULED");
    expect(video.getPublishedAt()).toEqual(futureDate);
    expect(video.isReleased(now)).toBe(false);

    expect(service.scheduleRelease(post, futureDate, { role: "ADMIN" }, now).ok).toBe(true);
    expect(post.getStatus()).toBe("SCHEDULED");
    expect(post.getPublicPath()).toBe("/blog/slow-exhalations-steady-footing");

    const laterDate = new Date("2026-11-20T18:00:00Z");
    expect(service.reschedule(video, laterDate, { role: "ADMIN" }, now).ok).toBe(true);
    expect(video.getPublishedAt()).toEqual(laterDate);

    expect(service.unschedule(video, { role: "ADMIN" }).ok).toBe(true);
    expect(video.getStatus()).toBe("DRAFT");
    expect(video.getPublishedAt()).toBeNull();
  });

  it("enforces Invariant I4 that BlogPostContent cannot be PROCESSING", () => {
    expect(
      () =>
        new BlogPostContent({
          id: "post-bad",
          title: "Bad Status Post",
          slug: "bad-status-post",
          status: "PROCESSING",
          category: "Balance",
          excerpt: "Valid excerpt text here",
          body: "Valid body text that is well over fifty characters in length for validation.",
          readMinutes: 4,
        }),
    ).toThrow(/Invariant I4/);
  });

  it("notifies all registered ReleaseObservers when releaseDue transitions scheduled items to PUBLISHED (Requirement R7)", async () => {
    const service = new ContentCalendarService();
    const video = makeReadyDraftVideo();
    const post = makeReadyDraftPost();

    service.registerContent(video);
    service.registerContent(post);

    service.scheduleRelease(video, futureDate, { role: "ADMIN" }, now);
    service.scheduleRelease(post, futureDate, { role: "ADMIN" }, now);

    const receivedEvents: ReleaseEvent[] = [];
    const customObserver: ReleaseObserver = {
      onContentReleased(event) {
        receivedEvents.push(event);
      },
    };
    const auditObserver = new ReleaseAuditObserver();

    service.registerObserver(customObserver);
    service.registerObserver(auditObserver);

    // Before futureDate: nothing due
    expect(isContentDue({ status: video.getStatus(), publishedAt: video.getPublishedAt() }, now)).toBe(
      false,
    );
    expect(await service.releaseDue(now)).toHaveLength(0);

    // After futureDate: both items transition to PUBLISHED and notify observers
    const afterRelease = new Date("2026-11-15T14:05:00Z");
    const released = await service.releaseDue(afterRelease);

    expect(released).toHaveLength(2);
    expect(receivedEvents).toHaveLength(2);
    expect(auditObserver.getAuditLog()).toHaveLength(2);
    expect(video.getStatus()).toBe("PUBLISHED");
    expect(video.isReleased(afterRelease)).toBe(true);
    expect(post.getStatus()).toBe("PUBLISHED");
    expect(post.isReleased(afterRelease)).toBe(true);
  });
});
