package evergrace.calendar;

import evergrace.calendar.CatalogModels.Category;
import evergrace.calendar.CatalogModels.Chapter;
import evergrace.calendar.CatalogModels.Follow;
import evergrace.calendar.CatalogModels.Level;
import evergrace.calendar.CatalogModels.Master;
import evergrace.calendar.CatalogModels.Role;
import evergrace.calendar.CatalogModels.User;
import evergrace.calendar.ContentCalendarService.ContentCalendar;
import evergrace.calendar.ContentCalendarService.ScheduleResult;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Executable verification harness for the Phase 3 Java implementation of the
 * EverGrace Content Calendar & Observer Design Pattern.
 *
 * Compile & run from mini-project-2/java:
 *   javac evergrace/calendar/*.java
 *   java evergrace.calendar.ContentCalendarDemo
 */
public final class ContentCalendarDemo {
    public static void main(String[] args) {
        Instant now = Instant.parse("2026-11-12T10:00:00Z");
        Instant futureSlot = Instant.parse("2026-11-15T14:00:00Z");
        Instant pastSlot = Instant.parse("2026-11-10T09:00:00Z");

        // 1. Reference Catalog & Users
        Category balance = new Category("cat-balance", "Balance", "Steady weight transfers");
        Master masterKen = new Master("master-ken", "Kenneth Brake", "Tai Chi & Gentle Balance");
        Level level1 = new Level("lvl-1", 1, "Level 1 Building Support", "Standing with chair nearby");

        User admin = new User("user-admin", "admin@evergrace.example", Role.ADMIN);
        User margaret = new User("user-margaret", "margaret-ellison@example.com", Role.MEMBER);
        User frank = new User("user-frank", "frank-alvarez@example.com", Role.MEMBER);

        // Margaret follows BOTH Balance category AND Master Kenneth Brake (tests priority deduplication)
        // Frank follows Level 1
        List<Follow> follows = List.of(
                Follow.forCategory("f-1", margaret.getId(), balance),
                Follow.forMaster("f-2", margaret.getId(), masterKen),
                Follow.forLevel("f-3", frank.getId(), level1)
        );

        // 2. Create ContentItem instances (Video and BlogPost)
        Video incompleteVideo = new Video(
                "vid-incomplete",
                "Gentle Balance - Week 4",
                "gentle-balance-week-4",
                "Slow weight shifts with chair support.",
                balance,
                null, // missing instructor initially!
                level1,
                900,
                "MEMBERS",
                "https://stream.evergrace.example/gentle-balance-week-4.mp4",
                ContentStatus.DRAFT,
                now,
                null
        );

        BlogPost scheduledPost = new BlogPost(
                "post-breathing",
                "Why Slow Exhalations Steady Your Footing",
                "slow-exhalations-steady-footing",
                "Breathing",
                "How a four-second exhale lowers your centre of gravity before stepping.",
                "Practicing a calm four-second exhalation before shifting weight relaxes the upper shoulders and stabilizes your stance.",
                5,
                ContentStatus.DRAFT,
                now,
                now
        );

        // 3. Wire ContentCalendarService (Subject) and Concrete Observers
        ContentCalendarService calendarService = new ContentCalendarService();
        calendarService.registerContent(incompleteVideo);
        calendarService.registerContent(scheduledPost);

        MemberNotificationObserver notifObserver = new MemberNotificationObserver(follows);
        CacheRevalidationObserver cacheObserver = new CacheRevalidationObserver();
        ReleaseAuditObserver auditObserver = new ReleaseAuditObserver();

        calendarService.registerObserver(notifObserver);
        calendarService.registerObserver(cacheObserver);
        calendarService.registerObserver(auditObserver);

        System.out.println("=== 1. Role Authorization Check (Requirement R5) ===");
        ScheduleResult memberAttempt = calendarService.scheduleRelease(incompleteVideo, futureSlot, margaret, now);
        System.out.println("Non-admin schedule attempt: " + memberAttempt);

        System.out.println("\n=== 2. Readiness Guard Check (Requirement R3) ===");
        ScheduleResult missingFieldsAttempt = calendarService.scheduleRelease(incompleteVideo, futureSlot, admin, now);
        System.out.println("Incomplete video schedule attempt: " + missingFieldsAttempt);

        // Assign Master and add composed Chapter -> Lesson
        incompleteVideo.setMaster(masterKen);
        Chapter warmUp = incompleteVideo.addChapter("ch-1", "Arrival & Chair Alignment");
        warmUp.addLesson("les-1", "Three Grounding Breaths", 300);
        warmUp.addLesson("les-2", "Side-to-Side Weight Transfer", 600);

        System.out.println("\n=== 3. Past Timestamp Guard Check (Requirement R2) ===");
        ScheduleResult pastDateAttempt = calendarService.scheduleRelease(incompleteVideo, pastSlot, admin, now);
        System.out.println("Past timestamp attempt: " + pastDateAttempt);

        System.out.println("\n=== 4. Valid Scheduling of Video & BlogPost (Requirements R1, R6) ===");
        ScheduleResult videoScheduled = calendarService.scheduleRelease(incompleteVideo, futureSlot, admin, now);
        ScheduleResult postScheduled = calendarService.scheduleRelease(scheduledPost, futureSlot, admin, now);
        System.out.println("Video schedule result: " + videoScheduled);
        System.out.println("BlogPost schedule result: " + postScheduled);

        System.out.println("\n=== 5. Misuse Case Countermeasure (Requirement R4 / Invariant I3) ===");
        System.out.println("Is scheduled video visible to members at t=now? " + incompleteVideo.isReleased(now));

        ContentCalendar grid = calendarService.buildCalendar(
                LocalDate.of(2026, 11, 12),
                LocalDate.of(2026, 11, 16)
        );
        long itemsOnNov15 = grid.getDays().stream()
                .filter(d -> d.getDate().equals(LocalDate.of(2026, 11, 15)))
                .findFirst()
                .map(d -> d.getEntries().size())
                .orElse(0);
        System.out.println("Calendar entries on 2026-11-15: " + itemsOnNov15);

        System.out.println("\n=== 6. Scheduled Release & Observer Fan-Out (Requirement R7) ===");
        Instant afterRelease = Instant.parse("2026-11-15T14:05:00Z");
        List<ReleaseEvent> releasedEvents = calendarService.releaseDue(afterRelease);
        System.out.println("Events emitted: " + releasedEvents.size());
        System.out.println("Is video visible to members after releaseDue? " + incompleteVideo.isReleased(afterRelease));

        System.out.println("\n--- Observer 1: MemberNotificationObserver ---");
        notifObserver.getNotifications().forEach(n -> System.out.println("  " + n));

        System.out.println("\n--- Observer 2: CacheRevalidationObserver ---");
        cacheObserver.getInvalidatedPaths().forEach(p -> System.out.println("  revalidated: " + p));

        System.out.println("\n--- Observer 3: ReleaseAuditObserver ---");
        auditObserver.getAuditLog().forEach(log -> System.out.println("  " + log));
    }
}
