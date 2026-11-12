package evergrace.calendar;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Domain entities representing the catalog and member relationships from Phase 1 UML:
 * - Category, Master, Level (Aggregations with Video)
 * - Chapter, Lesson (Compositions owned by Video)
 * - User, Role, Follow, Notification (Member subscriptions and inbox)
 */
public final class CatalogModels {
    private CatalogModels() {}

    public enum Role {
        MEMBER,
        ADMIN
    }

    public enum FollowKind {
        CATEGORY,
        MASTER,
        LEVEL
    }

    public static final class Category {
        private final String id;
        private final String name;
        private final String blurb;

        public Category(String id, String name, String blurb) {
            this.id = Objects.requireNonNull(id);
            this.name = Objects.requireNonNull(name);
            this.blurb = blurb != null ? blurb : "";
        }

        public String getId() { return id; }
        public String getName() { return name; }
        public String getBlurb() { return blurb; }
    }

    public static final class Master {
        private final String id;
        private final String name;
        private final String style;

        public Master(String id, String name, String style) {
            this.id = Objects.requireNonNull(id);
            this.name = Objects.requireNonNull(name);
            this.style = style;
        }

        public String getId() { return id; }
        public String getName() { return name; }
        public String getStyle() { return style; }
    }

    public static final class Level {
        private final String id;
        private final int order;
        private final String name;
        private final String description;

        public Level(String id, int order, String name, String description) {
            this.id = Objects.requireNonNull(id);
            this.order = order;
            this.name = Objects.requireNonNull(name);
            this.description = description != null ? description : "";
        }

        public String getId() { return id; }
        public int getOrder() { return order; }
        public String getName() { return name; }
        public String getDescription() { return description; }
    }

    /**
     * Lesson is composed within a Chapter (Chapter 1 *-- 0..* Lesson).
     */
    public static final class Lesson {
        private final String id;
        private final String title;
        private final int durationSeconds;
        private final int order;

        Lesson(String id, String title, int durationSeconds, int order) {
            this.id = Objects.requireNonNull(id);
            this.title = Objects.requireNonNull(title);
            this.durationSeconds = durationSeconds;
            this.order = order;
        }

        public String getId() { return id; }
        public String getTitle() { return title; }
        public int getDurationSeconds() { return durationSeconds; }
        public int getOrder() { return order; }
    }

    /**
     * Chapter is composed within a Video (Video 1 *-- 0..* Chapter).
     * Owns the lifecycle of its Lesson instances.
     */
    public static final class Chapter {
        private final String id;
        private final String title;
        private final int order;
        private final List<Lesson> lessons = new ArrayList<>();

        Chapter(String id, String title, int order) {
            this.id = Objects.requireNonNull(id);
            this.title = Objects.requireNonNull(title);
            this.order = order;
        }

        public Lesson addLesson(String lessonId, String lessonTitle, int durationSeconds) {
            Lesson lesson = new Lesson(lessonId, lessonTitle, durationSeconds, lessons.size());
            lessons.add(lesson);
            return lesson;
        }

        public String getId() { return id; }
        public String getTitle() { return title; }
        public int getOrder() { return order; }
        public List<Lesson> getLessons() { return Collections.unmodifiableList(lessons); }
    }

    /**
     * User has-a Role (composition/attribute over inheritance) and owns Follow and Notification records.
     */
    public static final class User {
        private final String id;
        private final String email;
        private Role role;

        public User(String id, String email, Role role) {
            this.id = Objects.requireNonNull(id);
            this.email = Objects.requireNonNull(email);
            this.role = Objects.requireNonNull(role);
        }

        public boolean isAdmin() {
            return this.role == Role.ADMIN;
        }

        public String getId() { return id; }
        public String getEmail() { return email; }
        public Role getRole() { return role; }
        public void setRole(Role role) { this.role = Objects.requireNonNull(role); }
    }

    public static final class Follow {
        private final String id;
        private final String userId;
        private final FollowKind kind;
        private final String categoryId;
        private final String masterId;
        private final String levelId;

        public Follow(String id, String userId, FollowKind kind, String categoryId, String masterId, String levelId) {
            this.id = Objects.requireNonNull(id);
            this.userId = Objects.requireNonNull(userId);
            this.kind = Objects.requireNonNull(kind);
            this.categoryId = categoryId;
            this.masterId = masterId;
            this.levelId = levelId;
        }

        public static Follow forCategory(String id, String userId, Category category) {
            return new Follow(id, userId, FollowKind.CATEGORY, category.getId(), null, null);
        }

        public static Follow forMaster(String id, String userId, Master master) {
            return new Follow(id, userId, FollowKind.MASTER, null, master.getId(), null);
        }

        public static Follow forLevel(String id, String userId, Level level) {
            return new Follow(id, userId, FollowKind.LEVEL, null, null, level.getId());
        }

        public String getId() { return id; }
        public String getUserId() { return userId; }
        public FollowKind getKind() { return kind; }
        public String getCategoryId() { return categoryId; }
        public String getMasterId() { return masterId; }
        public String getLevelId() { return levelId; }
    }

    public static final class Notification {
        private final String id;
        private final String userId;
        private final String videoId;
        private final String reason;
        private final Instant createdAt;

        public Notification(String id, String userId, String videoId, String reason, Instant createdAt) {
            this.id = Objects.requireNonNull(id);
            this.userId = Objects.requireNonNull(userId);
            this.videoId = Objects.requireNonNull(videoId);
            this.reason = Objects.requireNonNull(reason);
            this.createdAt = Objects.requireNonNull(createdAt);
        }

        public String getId() { return id; }
        public String getUserId() { return userId; }
        public String getVideoId() { return videoId; }
        public String getReason() { return reason; }
        public Instant getCreatedAt() { return createdAt; }

        @Override
        public String toString() {
            return "Notification[user=" + userId + ", video=" + videoId + ", reason=\"" + reason + "\"]";
        }
    }
}

