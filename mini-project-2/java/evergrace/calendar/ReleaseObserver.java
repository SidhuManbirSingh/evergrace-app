package evergrace.calendar;

/**
 * Observer interface in the Observer pattern.
 * Concrete implementations react when scheduled or draft content transitions to PUBLISHED.
 */
public interface ReleaseObserver {
    void onContentReleased(ReleaseEvent event);
}

