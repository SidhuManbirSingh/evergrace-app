"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ContentCalendarService,
  ReleaseAuditObserver,
  slugify,
  VideoContent,
  type AccessLevel,
  type ReleaseEvent,
  type ReleaseObserver,
  type VideoStatus,
} from "@/lib/domain";
import { MemberNotificationObserver } from "@/lib/notifications";
import {
  blogPostSchema,
  categorySchema,
  masterSchema,
  reorderSchema,
  teamMemberSchema,
  videoScheduleSchema,
} from "@/lib/validation";

import type { AdminResult } from "./admin";

/**
 * Content management for the reference data and marketing tables: categories,
 * masters, blog posts, and team members.
 *
 * Deletes are *refused* rather than cascaded wherever removing a row would
 * silently alter member-facing content — a category with videos in it, or an
 * instructor who is credited on a session. The admin is told what to fix first.
 */

// ---------------------------------------------------------------------------
// Categories (focus areas)
// ---------------------------------------------------------------------------

export async function saveCategory(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { id, name, blurb } = parsed.data;

  const clash = await prisma.category.findFirst({
    where: { name, ...(id ? { NOT: { id } } : {}) },
  });
  if (clash) return { ok: false, message: `“${name}” already exists.` };

  if (id) {
    await prisma.category.update({ where: { id }, data: { name, blurb: blurb ?? "" } });
  } else {
    await prisma.category.create({ data: { name, blurb: blurb ?? "" } });
  }

  revalidateContent();
  return { ok: true, message: `Saved “${name}”.` };
}

export async function deleteCategory(categoryId: string): Promise<AdminResult> {
  await requireAdmin();

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { videos: true, follows: true } } },
  });
  if (!category) return { ok: false, message: "Unknown focus area." };

  // A category is required on Video, so removing one with videos would orphan
  // them. Refuse and say what to do.
  if (category._count.videos > 0) {
    return {
      ok: false,
      message: `“${category.name}” still has ${category._count.videos} video(s). Move them to another focus area first.`,
    };
  }

  await prisma.category.delete({ where: { id: categoryId } });

  revalidateContent();
  return {
    ok: true,
    message:
      category._count.follows > 0
        ? `Deleted “${category.name}” and ${category._count.follows} follow(s).`
        : `Deleted “${category.name}”.`,
  };
}

// ---------------------------------------------------------------------------
// Masters (instructors)
// ---------------------------------------------------------------------------

export async function saveMaster(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const parsed = masterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { id, name, style } = parsed.data;

  const clash = await prisma.master.findFirst({
    where: { name, ...(id ? { NOT: { id } } : {}) },
  });
  if (clash) return { ok: false, message: `“${name}” already exists.` };

  if (id) {
    await prisma.master.update({ where: { id }, data: { name, style: style || null } });
  } else {
    await prisma.master.create({ data: { name, style: style || null } });
  }

  revalidateContent();
  return { ok: true, message: `Saved “${name}”.` };
}

export async function deleteMaster(masterId: string): Promise<AdminResult> {
  await requireAdmin();

  const master = await prisma.master.findUnique({
    where: { id: masterId },
    include: { _count: { select: { videos: true, follows: true } } },
  });
  if (!master) return { ok: false, message: "Unknown instructor." };

  // `Video.masterId` is optional, so this would succeed — but it would quietly
  // strip the instructor credit from published sessions. Make it deliberate.
  if (master._count.videos > 0) {
    return {
      ok: false,
      message: `${master.name} is credited on ${master._count.videos} video(s). Reassign them first.`,
    };
  }

  await prisma.master.delete({ where: { id: masterId } });

  revalidateContent();
  return {
    ok: true,
    message:
      master._count.follows > 0
        ? `Deleted ${master.name} and ${master._count.follows} follow(s).`
        : `Deleted ${master.name}.`,
  };
}

// ---------------------------------------------------------------------------
// Blog posts
// ---------------------------------------------------------------------------

export async function saveBlogPost(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const parsed = blogPostSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const data = parsed.data;

  if (data.id) {
    const existing = await prisma.blogPost.findUnique({ where: { id: data.id } });
    if (!existing) return { ok: false, message: "Unknown post." };

    await prisma.blogPost.update({
      where: { id: data.id },
      data: {
        title: data.title,
        category: data.category,
        excerpt: data.excerpt,
        body: data.body,
        readMinutes: data.readMinutes,
        thumbnailUrl: data.thumbnailUrl || null,
      },
    });

    // The slug is deliberately left alone on edit: it is a public URL, and
    // changing it would break every existing link to the post.
    revalidateBlog(existing.slug);
    return { ok: true, message: `Saved “${data.title}”.` };
  }

  let slug = slugify(data.title);
  if (await prisma.blogPost.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  await prisma.blogPost.create({
    data: {
      title: data.title,
      slug,
      category: data.category,
      excerpt: data.excerpt,
      body: data.body,
      readMinutes: data.readMinutes,
      thumbnailUrl: data.thumbnailUrl || null,
    },
  });

  revalidateBlog(slug);
  return { ok: true, message: `Published “${data.title}”.` };
}

export async function deleteBlogPost(postId: string): Promise<AdminResult> {
  await requireAdmin();

  const post = await prisma.blogPost.findUnique({ where: { id: postId } });
  if (!post) return { ok: false, message: "Unknown post." };

  await prisma.blogPost.delete({ where: { id: postId } });

  revalidateBlog(post.slug);
  return { ok: true, message: `Deleted “${post.title}”.` };
}

// ---------------------------------------------------------------------------
// Team members
// ---------------------------------------------------------------------------

export async function saveTeamMember(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const parsed = teamMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { id, name, role, bio, initials, photoUrl } = parsed.data;

  // Fall back to initials derived from the name, so the placeholder avatar always
  // has something to show.
  const resolvedInitials = (initials?.trim() || autoInitials(name)).toUpperCase();

  if (id) {
    await prisma.teamMember.update({
      where: { id },
      data: { name, role, bio, initials: resolvedInitials, photoUrl: photoUrl || null },
    });
  } else {
    await prisma.teamMember.create({
      data: {
        name,
        role,
        bio,
        initials: resolvedInitials,
        photoUrl: photoUrl || null,
        order: await prisma.teamMember.count(),
      },
    });
  }

  revalidatePath("/admin/content/team");
  revalidatePath("/about");
  return { ok: true, message: `Saved ${name}.` };
}

export async function deleteTeamMember(memberId: string): Promise<AdminResult> {
  await requireAdmin();

  const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!member) return { ok: false, message: "Unknown team member." };

  await prisma.teamMember.delete({ where: { id: memberId } });

  const remaining = await prisma.teamMember.findMany({ orderBy: { order: "asc" } });
  await prisma.$transaction(
    remaining.map((row, index) =>
      prisma.teamMember.update({ where: { id: row.id }, data: { order: index } }),
    ),
  );

  revalidatePath("/admin/content/team");
  revalidatePath("/about");
  return { ok: true, message: `Removed ${member.name}.` };
}

export async function reorderTeam(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const { orderedIds } = reorderSchema.parse(input);

  // Atomic, so a reorder can never be half-applied.
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.teamMember.update({ where: { id }, data: { order: index } }),
    ),
  );

  revalidatePath("/admin/content/team");
  revalidatePath("/about");
  return { ok: true };
}

// ---------------------------------------------------------------------------

function autoInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => /[a-z]/i.test(part))
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function revalidateContent(): void {
  revalidatePath("/admin/content/categories");
  revalidatePath("/admin/content/masters");
  revalidatePath("/admin/videos");
  revalidatePath("/library");
  revalidatePath("/");
}

function revalidateBlog(slug: string): void {
  revalidatePath("/admin/content/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
}

// ---------------------------------------------------------------------------
// Content Calendar & Observer Pattern (Mini-Project 2)
// ---------------------------------------------------------------------------

/**
 * Concrete Observer 2: invalidates Next.js Server Component caches whenever
 * a ContentItem transitions into PUBLISHED.
 */
class CacheRevalidationObserver implements ReleaseObserver {
  onContentReleased(event: ReleaseEvent): void {
    const item = event.item;
    revalidatePath("/admin/content/calendar");
    revalidatePath("/dashboard");

    if (item.getContentType() === "VIDEO") {
      revalidatePath("/admin/videos");
      revalidatePath(`/admin/videos/${item.id}`);
      revalidatePath("/library");
      revalidatePath(item.getPublicPath());
    } else {
      revalidatePath("/admin/content/blog");
      revalidatePath("/blog");
      revalidatePath(item.getPublicPath());
    }
  }
}

function buildDomainVideo(row: {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  status: string;
  createdAt: Date;
  publishedAt: Date | null;
  categoryId: string;
  masterId: string | null;
  levelId: string | null;
  duration: number;
  access: string;
  sourceUrl: string | null;
  muxPlaybackId: string | null;
  _count: { chapters: number };
}): VideoContent {
  return new VideoContent({
    id: row.id,
    title: row.title,
    slug: row.slug,
    thumbnailUrl: row.thumbnailUrl,
    status: row.status as VideoStatus,
    createdAt: row.createdAt,
    publishedAt: row.publishedAt,
    categoryId: row.categoryId,
    masterId: row.masterId,
    levelId: row.levelId,
    durationSeconds: row.duration,
    access: row.access as AccessLevel,
    sourceUrl: row.sourceUrl,
    muxPlaybackId: row.muxPlaybackId,
    chapterCount: row._count.chapters,
  });
}

/**
 * Schedules a draft (or already-scheduled) video for a future calendar release
 * (Mini-Project 1 Step 4 main success scenario & alternate flows).
 */
export async function scheduleVideoRelease(input: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = videoScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const { videoId, releaseDate } = parsed.data;

  const row = await prisma.video.findUnique({
    where: { id: videoId },
    include: { _count: { select: { chapters: true } } },
  });
  if (!row) return { ok: false, message: "Unknown video." };

  const domainVideo = buildDomainVideo(row);
  const service = new ContentCalendarService();
  const now = new Date();

  const result =
    domainVideo.getStatus() === "SCHEDULED"
      ? service.reschedule(domainVideo, releaseDate, admin, now)
      : service.scheduleRelease(domainVideo, releaseDate, admin, now);

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  await prisma.video.update({
    where: { id: videoId },
    data: {
      status: domainVideo.getStatus(),
      publishedAt: domainVideo.getPublishedAt(),
    },
  });

  revalidatePath("/admin/content/calendar");
  revalidatePath("/admin/videos");
  revalidatePath(`/admin/videos/${videoId}`);
  revalidatePath("/library");
  revalidatePath(`/library/${row.slug}`);

  return { ok: true, message: "Video scheduled successfully." };
}

/**
 * Unschedules a SCHEDULED video, returning it to DRAFT and clearing its future publishedAt.
 */
export async function unscheduleVideoRelease(videoId: string): Promise<AdminResult> {
  const admin = await requireAdmin();

  const row = await prisma.video.findUnique({
    where: { id: videoId },
    include: { _count: { select: { chapters: true } } },
  });
  if (!row) return { ok: false, message: "Unknown video." };

  const domainVideo = buildDomainVideo(row);
  const service = new ContentCalendarService();
  const result = service.unschedule(domainVideo, admin);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  await prisma.video.update({
    where: { id: videoId },
    data: { status: "DRAFT", publishedAt: null },
  });

  revalidatePath("/admin/content/calendar");
  revalidatePath("/admin/videos");
  revalidatePath(`/admin/videos/${videoId}`);
  revalidatePath("/library");

  return { ok: true, message: result.message };
}

/**
 * Immediately publishes a SCHEDULED or DRAFT video via ContentCalendarService,
 * notifying all registered ReleaseObservers (MemberNotificationObserver,
 * CacheRevalidationObserver, and ReleaseAuditObserver).
 */
export async function publishScheduledVideoNow(videoId: string): Promise<AdminResult> {
  const admin = await requireAdmin();

  const row = await prisma.video.findUnique({
    where: { id: videoId },
    include: { _count: { select: { chapters: true } } },
  });
  if (!row) return { ok: false, message: "Unknown video." };

  const domainVideo = buildDomainVideo(row);
  const readiness = domainVideo.validateReadiness();
  if (!readiness.ok) {
    return {
      ok: false,
      message: `Missing required fields: ${readiness.missing.join(", ")}`,
    };
  }

  const now = new Date();
  await prisma.video.update({
    where: { id: videoId },
    data: {
      status: "PUBLISHED",
      publishedAt: now,
    },
  });

  const service = new ContentCalendarService();
  const notifObserver = new MemberNotificationObserver();
  const cacheObserver = new CacheRevalidationObserver();
  const auditObserver = new ReleaseAuditObserver();

  service.registerObserver(notifObserver);
  service.registerObserver(cacheObserver);
  service.registerObserver(auditObserver);

  const result = await service.publishNow(domainVideo, admin, now);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const notified = notifObserver.getTotalNotified();
  return {
    ok: true,
    message:
      notified > 0
        ? `Published “${row.title}” — ${notified} member(s) notified.`
        : `Published “${row.title}”.`,
  };
}

/**
 * Releases all SCHEDULED videos whose publishedAt timestamp has arrived (<= now)
 * and fans out ReleaseEvents to all registered observers.
 */
export async function releaseDueVideos(): Promise<AdminResult> {
  await requireAdmin();
  const now = new Date();

  const dueRows = await prisma.video.findMany({
    where: {
      status: "SCHEDULED",
      publishedAt: { lte: now },
    },
    include: { _count: { select: { chapters: true } } },
    orderBy: { publishedAt: "asc" },
  });

  if (dueRows.length === 0) {
    return { ok: true, message: "No scheduled videos are due for release right now." };
  }

  const service = new ContentCalendarService();
  const notifObserver = new MemberNotificationObserver();
  const cacheObserver = new CacheRevalidationObserver();
  const auditObserver = new ReleaseAuditObserver();

  service.registerObserver(notifObserver);
  service.registerObserver(cacheObserver);
  service.registerObserver(auditObserver);

  for (const row of dueRows) {
    const domainVideo = buildDomainVideo(row);
    if (domainVideo.validateReadiness().ok) {
      await prisma.video.update({
        where: { id: row.id },
        data: { status: "PUBLISHED" },
      });
      service.registerContent(domainVideo);
    }
  }

  const events = await service.releaseDue(now);
  const notified = notifObserver.getTotalNotified();

  return {
    ok: true,
    message:
      notified > 0
        ? `Released ${events.length} scheduled video(s) — ${notified} member(s) notified.`
        : `Released ${events.length} scheduled video(s).`,
  };
}
