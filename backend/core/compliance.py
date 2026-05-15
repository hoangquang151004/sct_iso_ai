from typing import List, Optional
from datetime import date

def calculate_percentage(part: float, total: float, decimal_places: int = 2) -> Optional[float]:
    """Helper to calculate percentage safely."""
    if total <= 0:
        return None
    return round(100.0 * float(part) / float(total), decimal_places)

# --- PRP Formulas ---

def calculate_prp_audit_rate(pass_count: int, total_count: int) -> Optional[float]:
    """Calculate compliance rate for a single PRP audit session."""
    return calculate_percentage(pass_count, total_count)

def calculate_prp_average(rates: List[float]) -> Optional[float]:
    """Calculate the average compliance rate from multiple PRP audits."""
    if not rates:
        return None
    return round(sum(rates) / len(rates), 2)

def count_low_compliance_sessions(rates: List[float], threshold: float = 70.0) -> int:
    """Count sessions that fall below the compliance threshold (default 70%)."""
    return sum(1 for rate in rates if rate < threshold)

# --- CAPA Formulas ---

def calculate_capa_ontime_rate(closed_on_time_count: int, total_count: int) -> Optional[float]:
    """Calculate the percentage of CAPAs closed within their due date."""
    return calculate_percentage(closed_on_time_count, total_count)

def is_capa_overdue(due_date: Optional[date], status: str, current_date: date) -> bool:
    """Check if a CAPA is overdue based on due_date and current status."""
    if not due_date or status.upper() in ["CLOSED", "DONE", "REJECTED"]:
        return False
    return current_date > due_date

def estimate_capa_ontime_rate_fallback(overdue_count: int) -> float:
    """
    Fallback estimation for CAPA on-time rate when denominator is missing.
    Matches current business logic in ReportService.
    """
    return 100.0 if overdue_count == 0 else max(0.0, 100.0 - overdue_count * 15.0)
