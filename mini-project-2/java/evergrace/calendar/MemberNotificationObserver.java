package evergrace.calendar;

import evergrace.calendar.CatalogModels.Follow;
import evergrace.calendar.CatalogModels.Notification;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Concrete Observer 1: MemberNotificationObserver.
 *
 * Mirrors EverGrace's fanOutNewVideo() in src/lib/notifications.ts:
 * - Reacts when a Video transitions to PUBLISHED.
 * - Matches all Follow records for the video's Category, Master, or Level.
 * - Deduplicates per member, picking the highest-priority reason:
 *   Master ("New from Master ...") > Level ("New in Level ...") > Category ("New in ...").
 * - Enforces Invariant I6: skips members who already received a notification for this video.
 */
public final class MemberNotificationObserver implements ReleaseObserver {
    private final List<Follow> follows;
    private final List<Notification> notifications = new ArrayList<>();

    public MemberNotificationObserver(List<Follow> follows) {
        this.follows = new ArrayList<>(Objects.requireNonNull(follows));
    }

    @Override
    public void onContentReleased(ReleaseEvent event) {
        if (!(event.getItem() instanceof Video video)) {
            return;
        }
        if (video.getStatus() != ContentStatus.PUBLISHED) {
            return;
        }

        Map<String, String> reasonByUser = new LinkedHashMap<>();
        for (Follow follow : follows) {
            String candidateReason = null;
            if (follow.getMasterId() != null
                    && video.getMaster() != null
                    && follow.getMasterId().equals(video.getMaster().getId())) {
                candidateReason = "New from Master " + video.getMaster().getName();
            } else if (follow.getLevelId() != null
                    && video.getLevel() != null
                    && follow.getLevelId().equals(video.getLevel().getId())) {
                candidateReason = "New in " + video.getLevel().getName();
            } else if (follow.getCategoryId() != null
                    && video.getCategory() != null
                    && follow.getCategoryId().equals(video.getCategory().getId())) {
                candidateReason = "New in " + video.getCategory().getName();
            }

            if (candidateReason != null) {
                String existing = reasonByUser.get(follow.getUserId());
                if (existing == null || reasonPriority(candidateReason) > reasonPriority(existing)) {
                    reasonByUser.put(follow.getUserId(), candidateReason);
                }
            }
        }

        // Invariant I6: do not duplicate if a member already has a notification for this video
        for (Notification existingNotif : notifications) {
            if (existingNotif.getVideoId().equals(video.getId())) {
                reasonByUser.remove(existingNotif.getUserId());
            }
        }

        for (Map.Entry<String, String> entry : reasonByUser.entrySet()) {
            String notifId = "notif-" + (notifications.size() + 1);
            notifications.add(new Notification(
                    notifId,
                    entry.getKey(),
                    video.getId(),
                    entry.getValue(),
                    event.getReleasedAt()
            ));
        }
    }

    private static int reasonPriority(String reason) {
        if (reason.startsWith("New from Master")) return 2;
        if (reason.startsWith("New in Level")) return 1;
        return 0;
    }

    public List<Notification> getNotifications() {
        return Collections.unmodifiableList(notifications);
    }
}

