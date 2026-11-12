package evergrace.calendar;

import java.time.Instant;
import java.util.Objects;

/**
 * Immutable event payload emitted by ContentReleaseSubject whenever a ContentItem
 * transitions into PUBLISHED.
 */
public final class ReleaseEvent {
    private final ContentItem item;
    private final ContentStatus previousStatus;
    private final Instant releasedAt;
    private final ReleaseTrigger trigger;

    public ReleaseEvent(
            ContentItem item,
            ContentStatus previousStatus,
            Instant releasedAt,
            ReleaseTrigger trigger
    ) {
        this.item = Objects.requireNonNull(item, "item is required");
        this.previousStatus = Objects.requireNonNull(previousStatus, "previousStatus is required");
        this.releasedAt = Objects.requireNonNull(releasedAt, "releasedAt is required");
        this.trigger = Objects.requireNonNull(trigger, "trigger is required");
    }

    public ContentItem getItem() {
        return item;
    }

    public ContentStatus getPreviousStatus() {
        return previousStatus;
    }

    public Instant getReleasedAt() {
        return releasedAt;
    }

    public ReleaseTrigger getTrigger() {
        return trigger;
    }

    @Override
    public String toString() {
        return "ReleaseEvent[" + item.getContentType() + " \"" + item.getTitle() + "\" ("
                + previousStatus + " -> PUBLISHED via " + trigger + " at " + releasedAt + ")]";
    }
}

