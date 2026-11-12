package evergrace.calendar;

import java.util.Collections;
import java.util.List;

/**
 * Value object returned by ContentItem.validateReadiness().
 * Lists every missing prerequisite field so an admin can fix them in one pass.
 */
public final class ReadinessResult {
    private final boolean ok;
    private final List<String> missing;

    private ReadinessResult(boolean ok, List<String> missing) {
        this.ok = ok;
        this.missing = Collections.unmodifiableList(missing);
    }

    public static ReadinessResult ready() {
        return new ReadinessResult(true, List.of());
    }

    public static ReadinessResult notReady(List<String> missingFields) {
        return new ReadinessResult(false, missingFields);
    }

    public boolean isOk() {
        return ok;
    }

    public List<String> getMissing() {
        return missing;
    }

    @Override
    public String toString() {
        return ok ? "Ready" : "Missing required fields: " + String.join(", ", missing);
    }
}

