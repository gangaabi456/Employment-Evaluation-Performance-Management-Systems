"""All dashboard / ranking numbers are computed from database rows here."""
from datetime import date

from django.db.models import Avg

from .access import employees_for
from .models import Department, Review, ReviewPeriod


def pick_period(period_id=None):
    if period_id == "all":
        return None
    if period_id and str(period_id).isdigit():
        return ReviewPeriod.objects.filter(pk=period_id).first()
    return ReviewPeriod.objects.filter(is_active=True).first() or ReviewPeriod.objects.order_by("-end_date").first()


def avg_rating(qs):
    v = qs.aggregate(a=Avg("overall_rating"))["a"]
    return round(float(v), 2) if v is not None else None


def scoped_reviews(user, period_id=None, department_id=None):
    emps = employees_for(user)
    if department_id and str(department_id).isdigit():
        emps = emps.filter(department_id=department_id)
    period = pick_period(period_id)
    revs = Review.objects.filter(employee__in=emps).select_related("employee", "employee__department", "period")
    if period:
        revs = revs.filter(period=period)
    return emps, revs, period


def company_metrics(user, period_id=None, department_id=None):
    emps, revs, period = scoped_reviews(user, period_id, department_id)
    done = revs.filter(status="completed")
    total = revs.count()
    due = revs.exclude(status="completed")
    dist = {str(i): 0 for i in range(1, 6)}
    for r in done.filter(overall_rating__isnull=False).values_list("overall_rating", flat=True):
        dist[str(min(5, max(1, int(float(r) + 0.5))))] += 1
    departments = []
    for d in Department.objects.all():
        de = emps.filter(department=d)
        if not de.exists():
            continue
        dr = revs.filter(employee__in=de)
        departments.append({
            "id": d.id, "name": d.name, "headcount": de.filter(status="active").count(),
            "avg_rating": avg_rating(dr.filter(status="completed")),
            "reviews": dr.count(), "completed": dr.filter(status="completed").count(),
        })
    recent = [{
        "id": r.id, "employee": r.employee_id, "employee_name": r.employee.full_name,
        "department_name": r.employee.department.name if r.employee.department else None,
        "period_name": r.period.name, "rating": float(r.overall_rating) if r.overall_rating else None,
        "status": r.status, "updated_at": r.updated_at,
    } for r in revs.order_by("-updated_at")[:6]]
    return {
        "period": {"id": period.id, "name": period.name} if period else None,
        "total_employees": emps.filter(status="active").count(),
        "average_rating": avg_rating(done),
        "total_reviews": total,
        "completed_reviews": done.count(),
        "review_completion": round(done.count() * 100 / total) if total else 0,
        "reviews_due": due.count(),
        "reviews_overdue": due.filter(due_date__lt=date.today()).count(),
        "rating_distribution": [{"label": f"{k} ★", "count": v} for k, v in dist.items()],
        "status_breakdown": {s: revs.filter(status=s).count() for s in ("draft", "submitted", "completed")},
        "departments": departments,
        "recent_reviews": recent,
    }
