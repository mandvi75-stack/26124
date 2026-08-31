def calculate_route_delay_metrics(route_key: str, total_distance: float, scheduled_duration: int):
    """Return the consistent route delay metrics used across fleet and analytics views."""
    seed = sum(ord(ch) for ch in str(route_key)) % 7
    delay = max(0.0, round(total_distance * 0.8 + seed * 1.5 - 8.0, 1))
    current_delay = int(round(delay))
    avg_delay = round(max(1.0, delay * 0.75), 1)
    actual_duration = max(scheduled_duration, scheduled_duration + current_delay)
    return {
        "actual_duration": actual_duration,
        "current_delay": current_delay,
        "avg_delay": avg_delay,
    }
