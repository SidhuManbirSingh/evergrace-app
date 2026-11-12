package evergrace.calendar;

import evergrace.calendar.CatalogModels.User;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Concrete Subject and Control class for the EverGrace Content Calendar.
 *
 * Responsibilities:
 * - Enforces ADMIN authorization (Requirement R5).
 * - Coordinates scheduling, rescheduling, unscheduling, and immediate publishing on ContentItem.
 * - Executes releaseDue(now) to transition due SCHEDULED items to PUBLISHED.
 * - Emits ReleaseEvent to all registered ReleaseObserver instances upon publication.
 * - Builds the ContentCalendar read model (composed of CalendarDay cells).
 */
public final class ContentCalendarService implements ContentReleaseSubject {

    public record ScheduleResult(boolean ok, String message) {}

    /**
     * CalendarDay is composed inside ContentCalendar (ContentCalendar 1 *-- 1..* CalendarDay)
     * and aggregates the ContentItem entries scheduled/published on that date.
     */
    public static final class CalendarDay {
        private final LocalDate date;
        private final List<ContentItem> entries = new ArrayList<>();

        CalendarDay(LocalDate date) {
            this.date = Objects.requireNonNull(date);
        }

        void addEntry(ContentItem item) {
            entries.add(item);
        }

        public LocalDate getDate() { return date; }
        public List<ContentItem> getEntries() { return Collections.unmodifiableList(entries); }
    }

    /**
     * Read model representing a date range on the admin Content Calendar.
     */
    public static final class ContentCalendar {
        private final LocalDate rangeStart;
        private final LocalDate rangeEnd;
        private final Map<LocalDate, CalendarDay> days = new LinkedHashMap<>();
        private final List<ContentItem> unscheduledDrafts = new ArrayList<>();

        ContentCalendar(LocalDate rangeStart, LocalDate rangeEnd, List<ContentItem> allItems) {
            this.rangeStart = Objects.requireNonNull(rangeStart);
            this.rangeEnd = Objects.requireNonNull(rangeEnd);
            for (LocalDate d = rangeStart; !d.isAfter(rangeEnd); d = d.plusDays(1)) {
                days.put(d, new CalendarDay(d));
            }
            for (ContentItem item : allItems) {
                if (item.getStatus() == ContentStatus.DRAFT && item.getPublishedAt() == null) {
                    unscheduledDrafts.add(item);
                } else if (item.getPublishedAt() != null) {
                    LocalDate pubDate = item.getPublishedAt().atZone(ZoneOffset.UTC).toLocalDate();
                    CalendarDay bucket = days.get(pubDate);
                    if (bucket != null) {
                        bucket.addEntry(item);
                    }
                }
            }
        }

        public LocalDate getRangeStart() { return rangeStart; }
        public LocalDate getRangeEnd() { return rangeEnd; }
        public List<CalendarDay> getDays() { return List.copyOf(days.values()); }
        public List<ContentItem> getUnscheduledDrafts() { return Collections.unmodifiableList(unscheduledDrafts); }
    }

    private final List<ReleaseObserver> observers = new ArrayList<>();
    private final List<ContentItem> catalogItems = new ArrayList<>();

    public void registerContent(ContentItem item) {
        catalogItems.add(Objects.requireNonNull(item));
    }

    @Override
    public void registerObserver(ReleaseObserver observer) {
        Objects.requireNonNull(observer, "observer is required");
        if (!observers.contains(observer)) {
            observers.add(observer);
        }
    }

    @Override
    public void removeObserver(ReleaseObserver observer) {
        observers.remove(observer);
    }

    @Override
    public void notifyObservers(ReleaseEvent event) {
        for (ReleaseObserver observer : List.copyOf(observers)) {
            observer.onContentReleased(event);
        }
    }

    public ScheduleResult scheduleRelease(ContentItem item, Instant releaseAt, User actor, Instant now) {
        if (actor == null || !actor.isAdmin()) {
            return new ScheduleResult(false, "Forbidden: ADMIN role required.");
        }
        try {
            item.scheduleRelease(releaseAt, now);
            String kindLabel = item.getContentType() == ContentType.VIDEO ? "Video" : "Blog post";
            return new ScheduleResult(true, kindLabel + " scheduled successfully for " + releaseAt + ".");
        } catch (IllegalArgumentException | IllegalStateException ex) {
            return new ScheduleResult(false, ex.getMessage());
        }
    }

    public ScheduleResult reschedule(ContentItem item, Instant releaseAt, User actor, Instant now) {
        if (actor == null || !actor.isAdmin()) {
            return new ScheduleResult(false, "Forbidden: ADMIN role required.");
        }
        try {
            item.reschedule(releaseAt, now);
            return new ScheduleResult(true, "Rescheduled release to " + releaseAt + ".");
        } catch (IllegalArgumentException | IllegalStateException ex) {
            return new ScheduleResult(false, ex.getMessage());
        }
    }

    public ScheduleResult unschedule(ContentItem item, User actor) {
        if (actor == null || !actor.isAdmin()) {
            return new ScheduleResult(false, "Forbidden: ADMIN role required.");
        }
        try {
            item.unschedule();
            return new ScheduleResult(true, "Returned \"" + item.getTitle() + "\" to DRAFT.");
        } catch (IllegalStateException ex) {
            return new ScheduleResult(false, ex.getMessage());
        }
    }

    public ScheduleResult publishNow(ContentItem item, User actor, Instant now) {
        if (actor == null || !actor.isAdmin()) {
            return new ScheduleResult(false, "Forbidden: ADMIN role required.");
        }
        ContentStatus before = item.getStatus();
        try {
            item.publishNow(now);
            if (before != ContentStatus.PUBLISHED) {
                notifyObservers(new ReleaseEvent(item, before, now, ReleaseTrigger.MANUAL_PUBLISH));
            }
            return new ScheduleResult(true, "Published \"" + item.getTitle() + "\".");
        } catch (IllegalStateException ex) {
            return new ScheduleResult(false, ex.getMessage());
        }
    }

    /**
     * Releases all SCHEDULED content items whose publishedAt timestamp is <= now,
     * notifying all registered ReleaseObservers for each transition.
     */
    public List<ReleaseEvent> releaseDue(Instant now) {
        List<ReleaseEvent> events = new ArrayList<>();
        List<ContentItem> sorted = new ArrayList<>(catalogItems);
        sorted.sort(Comparator.comparing(
                ContentItem::getPublishedAt,
                Comparator.nullsLast(Comparator.naturalOrder())
        ));

        for (ContentItem item : sorted) {
            if (item.isDue(now)) {
                ContentStatus before = item.getStatus();
                item.publishNow(now);
                ReleaseEvent event = new ReleaseEvent(item, before, now, ReleaseTrigger.SCHEDULED_DUE);
                events.add(event);
                notifyObservers(event);
            }
        }
        return events;
    }

    public ContentCalendar buildCalendar(LocalDate from, LocalDate to) {
        return new ContentCalendar(from, to, catalogItems);
    }
}
