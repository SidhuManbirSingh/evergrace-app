"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useState, useTransition } from "react";

import {
  publishScheduledVideoNow,
  releaseDueVideos,
  scheduleVideoRelease,
  unscheduleVideoRelease,
} from "@/actions/admin-content";
import { useDataRefresh } from "@/components/admin/use-data-refresh";
import { AccessBadge, VideoStatusBadge } from "@/components/ui/badge";
import { Button, TextLink } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import type { CalendarData, CalendarVideoItem } from "@/lib/queries";

export function ContentCalendar({ data }: { data: CalendarData }) {
  const refresh = useDataRefresh();
  const [schedulingItem, setSchedulingItem] = useState<CalendarVideoItem | null>(null);
  const [releaseInput, setReleaseInput] = useState<string>("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openScheduleModal(item: CalendarVideoItem) {
    setModalError(null);
    setSchedulingItem(item);
    if (item.publishedAt) {
      setReleaseInput(toLocalDatetimeValue(new Date(item.publishedAt)));
    } else {
      const tomorrow = new Date(Date.now() + 24 * 3_600_000);
      tomorrow.setMinutes(0, 0, 0);
      setReleaseInput(toLocalDatetimeValue(tomorrow));
    }
  }

  function submitSchedule(event: React.FormEvent) {
    event.preventDefault();
    if (!schedulingItem) return;
    setModalError(null);

    if (!releaseInput) {
      setModalError("Please select a release date and time.");
      return;
    }

    const parsedDate = new Date(releaseInput);
    startTransition(async () => {
      const result = await scheduleVideoRelease({
        videoId: schedulingItem.id,
        releaseDate: parsedDate.toISOString(),
      });
      if (!result.ok) {
        setModalError(result.message ?? "Could not schedule release.");
        return;
      }
      setSchedulingItem(null);
      setMessage(result.message ?? "Video scheduled successfully.");
      refresh();
    });
  }

  function handleUnschedule(item: CalendarVideoItem) {
    startTransition(async () => {
      const result = await unscheduleVideoRelease(item.id);
      setMessage(result.message ?? null);
      refresh();
    });
  }

  function handlePublishNow(item: CalendarVideoItem) {
    startTransition(async () => {
      const result = await publishScheduledVideoNow(item.id);
      setMessage(result.message ?? null);
      refresh();
    });
  }

  function handleReleaseDue() {
    startTransition(async () => {
      const result = await releaseDueVideos();
      setMessage(result.message ?? null);
      refresh();
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 mb-1 text-[1.4em]">Content release calendar</h2>
          <p className="m-0 max-w-[60ch] text-muted">
            Schedule draft videos for future calendar release. Scheduled videos stay hidden from
            members until their release timestamp arrives, then fan out subscriber notifications.
          </p>
        </div>
        {data.dueCount > 0 ? (
          <Button size="sm" disabled={isPending} onClick={handleReleaseDue}>
            Release due videos ({data.dueCount})
          </Button>
        ) : null}
      </div>

      {message ? (
        <p
          className="mb-5 rounded-control border-2 border-line bg-bg px-4 py-3 font-semibold"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Scheduled queue" value={data.scheduledVideos.length} unit="upcoming" />
        <StatCard label="Unscheduled drafts" value={data.draftVideos.length} unit="drafts" />
        <StatCard label="Published live" value={data.publishedVideos.length} unit="videos" />
      </div>

      {/* Scheduled Queue Section */}
      <Card className="mb-7">
        <h3 className="m-0 mb-1 text-[1.25em]">Scheduled release queue</h3>
        <p className="m-0 mb-5 text-muted">
          Ordered chronologically by target release date (<code>publishedAt</code>).
        </p>

        {data.scheduledVideos.length === 0 ? (
          <p className="m-0 rounded-control border-2 border-dashed border-line p-6 text-center text-muted">
            No videos are currently scheduled. Choose a draft below to schedule a future release.
          </p>
        ) : (
          <ul role="list" className="m-0 flex list-none flex-col gap-3 p-0">
            {data.scheduledVideos.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border-2 border-line bg-bg px-5 py-4"
              >
                <div className="min-w-[240px] flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2.5">
                    <VideoStatusBadge status={item.status} />
                    <AccessBadge access={item.access} />
                    <span className="font-semibold text-accent-dark">
                      {item.publishedAt ? formatScheduleDate(item.publishedAt) : "Unscheduled"}
                    </span>
                    {item.isDue ? (
                      <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-[0.82em] font-bold text-warn">
                        Due for release
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[1.12em] font-bold">
                    <Link
                      href={`/admin/videos/${item.id}`}
                      className="text-fg no-underline hover:underline"
                    >
                      {item.title}
                    </Link>
                  </div>
                  <div className="text-[0.92em] text-muted">
                    {item.categoryName}
                    {item.masterName ? ` · Master ${item.masterName}` : ""}
                    {item.levelName ? ` · ${item.levelName}` : ""} · {item.durationLabel}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => openScheduleModal(item)}
                  >
                    Reschedule
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={isPending}
                    onClick={() => handlePublishNow(item)}
                  >
                    Publish now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => handleUnschedule(item)}
                  >
                    Unschedule
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Drafts Ready to Schedule */}
      <Card>
        <h3 className="m-0 mb-1 text-[1.25em]">Unscheduled draft videos</h3>
        <p className="m-0 mb-5 text-muted">
          A draft requires an instructor, at least one syllabus chapter, and a playback source
          before it can be placed on the release calendar.
        </p>

        {data.draftVideos.length === 0 ? (
          <p className="m-0 rounded-control border-2 border-dashed border-line p-6 text-center text-muted">
            No unscheduled draft videos right now.
          </p>
        ) : (
          <ul role="list" className="m-0 flex list-none flex-col gap-3 p-0">
            {data.draftVideos.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border-2 border-line bg-bg px-5 py-4"
              >
                <div className="min-w-[240px] flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2.5">
                    <VideoStatusBadge status={item.status} />
                    <AccessBadge access={item.access} />
                    {item.readiness.ok ? (
                      <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-[0.82em] font-bold text-success">
                        Ready to schedule
                      </span>
                    ) : (
                      <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-[0.82em] font-bold text-warn">
                        Missing: {item.readiness.missing.join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="text-[1.12em] font-bold">
                    <Link
                      href={`/admin/videos/${item.id}`}
                      className="text-fg no-underline hover:underline"
                    >
                      {item.title}
                    </Link>
                  </div>
                  <div className="text-[0.92em] text-muted">
                    {item.categoryName}
                    {item.masterName ? ` · Master ${item.masterName}` : " · No instructor"}
                    {" · "}
                    {item.durationLabel}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <TextLink href={`/admin/videos/${item.id}`}>Edit metadata / syllabus</TextLink>
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => openScheduleModal(item)}
                  >
                    Schedule release
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Scheduling Modal */}
      <Dialog.Root
        open={schedulingItem !== null}
        onOpenChange={(open) => {
          if (!open) setSchedulingItem(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border-2 border-line bg-surface p-7 shadow-xl">
            <Dialog.Title className="m-0 mb-1 text-[1.4em]">
              {schedulingItem?.status === "SCHEDULED"
                ? "Reschedule video release"
                : "Schedule video for calendar release"}
            </Dialog.Title>
            <Dialog.Description className="m-0 mb-5 text-muted">
              {schedulingItem?.title}
            </Dialog.Description>

            <form onSubmit={submitSchedule} className="flex flex-col gap-5">
              <Field
                label="Target release date & time"
                htmlFor="release-datetime"
                hint="Must be in the future. The video remains hidden from members until this date."
                error={modalError ?? undefined}
              >
                <Input
                  id="release-datetime"
                  type="datetime-local"
                  value={releaseInput}
                  onChange={(e) => setReleaseInput(e.target.value)}
                  required
                />
              </Field>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSchedulingItem(null)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? "Saving…" : "Save schedule"}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function formatScheduleDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

