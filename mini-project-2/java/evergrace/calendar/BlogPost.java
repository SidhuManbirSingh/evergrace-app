package evergrace.calendar;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Concrete subclass of ContentItem representing an article in The Steady Path Journal.
 * Shares the ContentItem scheduling state machine with Video (Requirement R6).
 */
public final class BlogPost extends ContentItem {
    private final String category;
    private final String excerpt;
    private final String body;
    private final int readMinutes;

    public BlogPost(
            String id,
            String title,
            String slug,
            String category,
            String excerpt,
            String body,
            int readMinutes,
            ContentStatus status,
            Instant createdAt,
            Instant publishedAt
    ) {
        super(id, title, slug, null, status, createdAt, publishedAt);
        if (status == ContentStatus.PROCESSING) {
            throw new IllegalArgumentException("Invariant I4: BlogPost cannot have PROCESSING status.");
        }
        this.category = category;
        this.excerpt = excerpt;
        this.body = body;
        this.readMinutes = readMinutes;
    }

    @Override
    public ReadinessResult validateReadiness() {
        List<String> missing = new ArrayList<>();
        if (title == null || title.isBlank()) {
            missing.add("title");
        }
        if (category == null || category.isBlank()) {
            missing.add("category");
        }
        if (excerpt == null || excerpt.length() < 10) {
            missing.add("excerpt (min 10 chars)");
        }
        if (body == null || body.length() < 50) {
            missing.add("body (min 50 chars)");
        }
        if (readMinutes <= 0) {
            missing.add("readMinutes");
        }
        return missing.isEmpty() ? ReadinessResult.ready() : ReadinessResult.notReady(missing);
    }

    @Override
    public ContentType getContentType() {
        return ContentType.BLOG_POST;
    }

    @Override
    public String getPublicPath() {
        return "/blog/" + slug;
    }

    public String getCategory() { return category; }
    public String getExcerpt() { return excerpt; }
    public String getBody() { return body; }
    public int getReadMinutes() { return readMinutes; }
}

