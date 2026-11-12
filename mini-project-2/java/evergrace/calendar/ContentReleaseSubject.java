package evergrace.calendar;

/**
 * Subject interface in the Observer pattern.
 * Decouples the ContentCalendarService from concrete post-release side effects.
 */
public interface ContentReleaseSubject {
    void registerObserver(ReleaseObserver observer);
    void removeObserver(ReleaseObserver observer);
    void notifyObservers(ReleaseEvent event);
}

