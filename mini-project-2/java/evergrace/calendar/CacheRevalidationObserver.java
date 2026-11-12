package evergrace.calendar;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Concrete Observer 2: CacheRevalidationObserver.
 *
 * Mirrors Next.js revalidatePath() calls in EverGrace's Server Actions:
 * - Always revalidates "/admin/content/calendar" and "/dashboard".
 * - Revalidates "/library" and "/library/<slug>" when a Video is released.
 * - Revalidates "/blog" and "/blog/<slug>" when a BlogPost is released.
 */
public final class CacheRevalidationObserver implements ReleaseObserver {
    private final Set<String> invalidatedPaths = new LinkedHashSet<>();

    @Override
    public void onContentReleased(ReleaseEvent event) {
        ContentItem item = event.getItem();
        invalidatedPaths.add("/admin/content/calendar");
        invalidatedPaths.add("/dashboard");

        if (item.getContentType() == ContentType.VIDEO) {
            invalidatedPaths.add("/admin/videos");
            invalidatedPaths.add("/library");
            invalidatedPaths.add(item.getPublicPath());
        } else if (item.getContentType() == ContentType.BLOG_POST) {
            invalidatedPaths.add("/admin/content/blog");
            invalidatedPaths.add("/blog");
            invalidatedPaths.add(item.getPublicPath());
        }
    }

    public List<String> getInvalidatedPaths() {
        return Collections.unmodifiableList(new ArrayList<>(invalidatedPaths));
    }

    public void clear() {
        invalidatedPaths.clear();
    }
}

