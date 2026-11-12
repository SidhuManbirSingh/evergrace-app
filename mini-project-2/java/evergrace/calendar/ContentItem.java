package evergrace.calendar;

import java.time.Instant;
import java.util.Objects;

/**
 * Abstract base class for all publishable content in EverGrace (Video and BlogPost).
 * Encodes the shared scheduling state machine (DRAFT -> SCHEDULED -> PUBLISHED)
 * once, enforcing invariants I1, I2, and I3.
 */
public abstract class ContentItem implements Schedulable {
    protected final String id;
    protected String title;
    protected final String slug;
    protected String thumbnailUrl;
    protected ContentStatus status;
    protected final Instant createdAt;
    protected Instant publishedAt;

    protected ContentItem(
            String id,
            String title,
            String slug,
            String thumbnailUrl,
            ContentStatus status,
            Instant createdAt,
            Instant publishedAt
    ) {
        this.id = Objects.requireNonNull(id, "id is required");
        this.title = Objects.requireNonNull(title, "title is required");
        this.slug = Objects.requireNonNull(slug, "slug is required");
        this.thumbnailUrl = thumbnailUrl;
        this.status = Objects.requireNonNull(status, "status is required");
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt is required");
        this.publishedAt = publishedAt;
    }

    /**
     * Schedules a DRAFT item for a future release timestamp.
     * Template Method: delegates subtype prerequisite validation to validateReadiness().
     */
    @Override
    public void scheduleRelease(Instant releaseAt, Instant now) {
        Objects.requireNonNull(releaseAt, "releaseAt is required");
        Objects.requireNonNull(now, "now is required");

        if (this.status != ContentStatus.DRAFT) {
            throw new IllegalStateException("Only DRAFT content can be scheduled (current: " + this.status + ").");
        }
        if (!releaseAt.isAfter(now)) {
            throw new IllegalArgumentException("Release date must be in the future.");
        }
        ReadinessResult readiness = validateReadiness();
        if (!readiness.isOk()) {
            throw new IllegalStateException(readiness.toString());
        }

        this.status = ContentStatus.SCHEDULED;
        this.publishedAt = releaseAt;
    }

    /**
     * Moves an already-SCHEDULED item to a different future timestamp.
     */
    @Override
    public void reschedule(Instant releaseAt, Instant now) {
        Objects.requireNonNull(releaseAt, "releaseAt is required");
        Objects.requireNonNull(now, "now is required");

        if (this.status != ContentStatus.SCHEDULED) {
            throw new IllegalStateException("Only SCHEDULED content can be rescheduled.");
        }
        if (!releaseAt.isAfter(now)) {
            throw new IllegalArgumentException("Release date must be in the future.");
        }

        this.publishedAt = releaseAt;
    }

    /**
     * Returns a SCHEDULED item to DRAFT and clears its future release timestamp (Invariant I2).
     */
    @Override
    public void unschedule() {
        if (this.status != ContentStatus.SCHEDULED) {
            throw new IllegalStateException("Only SCHEDULED content can be unscheduled.");
        }
        this.status = ContentStatus.DRAFT;
        this.publishedAt = null;
    }

    /**
     * Immediately transitions the item to PUBLISHED and stamps publishedAt if needed.
     */
    @Override
    public void publishNow(Instant now) {
        Objects.requireNonNull(now, "now is required");
        ReadinessResult readiness = validateReadiness();
        if (!readiness.isOk()) {
            throw new IllegalStateException(readiness.toString());
        }
        this.status = ContentStatus.PUBLISHED;
        if (this.publishedAt == null || this.publishedAt.isAfter(now)) {
            this.publishedAt = now;
        }
    }

    /**
     * Invariant I3 (MP1 Step 5 Countermeasure):
     * Non-admin viewers may access content iff status == PUBLISHED and publishedAt <= now.
     */
    @Override
    public boolean isReleased(Instant now) {
        Objects.requireNonNull(now, "now is required");
        return this.status == ContentStatus.PUBLISHED
                && (this.publishedAt == null || !this.publishedAt.isAfter(now));
    }

    /**
     * True when the item is SCHEDULED and its target release timestamp has arrived.
     */
    @Override
    public boolean isDue(Instant now) {
        Objects.requireNonNull(now, "now is required");
        return this.status == ContentStatus.SCHEDULED
                && this.publishedAt != null
                && !this.publishedAt.isAfter(now);
    }

    public abstract ReadinessResult validateReadiness();
    public abstract ContentType getContentType();
    public abstract String getPublicPath();

    public String getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getSlug() {
        return slug;
    }

    public String getThumbnailUrl() {
        return thumbnailUrl;
    }

    @Override
    public ContentStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    @Override
    public Instant getPublishedAt() {
        return publishedAt;
    }
}

