package evergrace.calendar;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Concrete Observer 3: ReleaseAuditObserver.
 *
 * Records structured telemetry entries whenever a scheduled or draft ContentItem
 * transitions to PUBLISHED, allowing staff to verify automated calendar releases.
 */
public final class ReleaseAuditObserver implements ReleaseObserver {
    private final List<String> auditLog = new ArrayList<>();

    @Override
    public void onContentReleased(ReleaseEvent event) {
        ContentItem item = event.getItem();
        String entry = String.format(
                "[%s] %s (%s) transitioned %s -> PUBLISHED via %s at %s",
                event.getReleasedAt(),
                item.getTitle(),
                item.getPublicPath(),
                event.getPreviousStatus(),
                event.getTrigger(),
                item.getPublishedAt()
        );
        auditLog.add(entry);
    }

    public List<String> getAuditLog() {
        return Collections.unmodifiableList(auditLog);
    }
}

