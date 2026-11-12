package evergrace.calendar;

import java.time.Instant;

/**
 * Behavioural contract for any entity that can be scheduled on the EverGrace Content Calendar.
 * Kept separate from ContentItem so future non-content entities (e.g., live sessions or plan promos)
 * can participate in the calendar without inheriting content-specific attributes.
 */
public interface Schedulable {
    void scheduleRelease(Instant releaseAt, Instant now);
    void reschedule(Instant releaseAt, Instant now);
    void unschedule();
    void publishNow(Instant now);
    boolean isReleased(Instant now);
    boolean isDue(Instant now);
    ContentStatus getStatus();
    Instant getPublishedAt();
}

