package evergrace.calendar;

import evergrace.calendar.CatalogModels.Category;
import evergrace.calendar.CatalogModels.Chapter;
import evergrace.calendar.CatalogModels.Level;
import evergrace.calendar.CatalogModels.Master;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Concrete subclass of ContentItem representing a martial-arts training video.
 *
 * Demonstrates:
 * - Inheritance ("is-a"): Video extends ContentItem
 * - Aggregation ("has-a" shared catalog reference): Category, Master, Level
 * - Composition ("has-a" exclusive lifecycle ownership): Chapter -> Lesson
 */
public final class Video extends ContentItem {
    private final String summary;
    private Category category;
    private Master master;
    private Level level;
    private final int durationSeconds;
    private final String access;
    private String sourceUrl;
    private final List<Chapter> chapters = new ArrayList<>();

    public Video(
            String id,
            String title,
            String slug,
            String summary,
            Category category,
            Master master,
            Level level,
            int durationSeconds,
            String access,
            String sourceUrl,
            ContentStatus status,
            Instant createdAt,
            Instant publishedAt
    ) {
        super(id, title, slug, null, status, createdAt, publishedAt);
        this.summary = summary != null ? summary : "";
        this.category = Objects.requireNonNull(category, "category is required");
        this.master = master;
        this.level = level;
        this.durationSeconds = durationSeconds;
        this.access = access != null ? access : "FREE";
        this.sourceUrl = sourceUrl;
    }

    /**
     * Composition factory method: Video creates and owns its Chapter instances.
     */
    public Chapter addChapter(String chapterId, String chapterTitle) {
        Chapter chapter = new Chapter(chapterId, chapterTitle, chapters.size());
        chapters.add(chapter);
        return chapter;
    }

    /**
     * Requirement R3 (MP1 Step 4 Alternate Flow 2):
     * A video cannot be scheduled unless it has an assigned instructor (Master),
     * at least one syllabus chapter, a positive duration, and a playable sourceUrl.
     */
    @Override
    public ReadinessResult validateReadiness() {
        List<String> missing = new ArrayList<>();
        if (title == null || title.isBlank()) {
            missing.add("title");
        }
        if (category == null) {
            missing.add("category");
        }
        if (master == null) {
            missing.add("master (instructor)");
        }
        if (chapters.isEmpty()) {
            missing.add("syllabus chapter");
        }
        if (durationSeconds <= 0) {
            missing.add("duration");
        }
        if (sourceUrl == null || sourceUrl.isBlank()) {
            missing.add("sourceUrl");
        }
        return missing.isEmpty() ? ReadinessResult.ready() : ReadinessResult.notReady(missing);
    }

    @Override
    public ContentType getContentType() {
        return ContentType.VIDEO;
    }

    @Override
    public String getPublicPath() {
        return "/library/" + slug;
    }

    public String getSummary() { return summary; }
    public Category getCategory() { return category; }
    public Master getMaster() { return master; }
    public void setMaster(Master master) { this.master = master; }
    public Level getLevel() { return level; }
    public void setLevel(Level level) { this.level = level; }
    public int getDurationSeconds() { return durationSeconds; }
    public String getAccess() { return access; }
    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
    public List<Chapter> getChapters() { return Collections.unmodifiableList(chapters); }
}

