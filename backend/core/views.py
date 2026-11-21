import csv
from datetime import date

from django.contrib.auth import authenticate
from django.db.models import Avg, Count, Q
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import SAFE_METHODS, AllowAny, BasePermission
from rest_framework.response import Response

from .access import employees_for, goals_for, my_profile, reviews_for
from .metrics import company_metrics, scoped_reviews
from .models import Department, Employee, Review, ReviewPeriod
from .serializers import (DepartmentSerializer, EmployeeSerializer, GoalSerializer, ReviewPeriodSerializer,
                          ReviewSerializer)


class RolePermission(BasePermission):
    """Everyone logged in may read (data is already scoped); only `write_roles` may change."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.method in SAFE_METHODS or request.user.role in getattr(view, "write_roles", ("admin",))


def require_roles(request, *roles):
    if request.user.role not in roles:
        raise PermissionDenied("You do not have permission to view this page.")


def apply_filters(qs, params, mapping):
    for key, field in mapping.items():
        v = params.get(key)
        if v and (not field.endswith("_id") or v.isdigit()):
            qs = qs.filter(**{field: v})
    return qs


# ---------- auth ----------
def user_payload(u):
    prof = my_profile(u)
    return {"id": u.id, "username": u.username, "role": u.role,
            "full_name": u.get_full_name() or u.username, "employee": prof.pk if prof else None}


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def login_view(request):
    username = (request.data.get("username") or "").strip()
    password = request.data.get("password") or ""
    if not username or not password:
        return Response({"detail": "Username and password are required."}, status=400)
    user = authenticate(request, username=username, password=password)
    if not user:
        return Response({"detail": "Invalid username or password."}, status=400)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": user_payload(user)})


@api_view(["POST"])
def logout_view(request):
    Token.objects.filter(user=request.user).delete()
    return Response(status=204)


@api_view(["GET"])
def me_view(request):
    return Response(user_payload(request.user))


# ---------- CRUD ----------
class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [RolePermission]
    pagination_class = None


class ReviewPeriodViewSet(viewsets.ModelViewSet):
    queryset = ReviewPeriod.objects.all()
    serializer_class = ReviewPeriodSerializer
    permission_classes = [RolePermission]
    pagination_class = None


class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = [RolePermission]  # write: admin only

    def get_queryset(self):
        p = self.request.query_params
        qs = apply_filters(employees_for(self.request.user), p,
                           {"department": "department_id", "status": "status", "manager": "manager_id"})
        s = p.get("search", "").strip()
        if s:
            qs = qs.filter(Q(first_name__icontains=s) | Q(last_name__icontains=s) | Q(email__icontains=s)
                           | Q(job_title__icontains=s) | Q(employee_id__icontains=s))
        return qs.distinct().order_by("last_name", "first_name")

    def perform_destroy(self, inst):
        user = inst.user
        if user and user == self.request.user:
            raise PermissionDenied("You cannot delete your own account.")
        inst.delete()
        if user:
            user.delete()


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [RolePermission]
    write_roles = ("admin", "manager")

    def get_queryset(self):
        p = self.request.query_params
        qs = reviews_for(self.request.user).select_related("employee", "employee__department", "period", "reviewer") \
            .prefetch_related("criteria")
        qs = apply_filters(qs, p, {"employee": "employee_id", "period": "period_id", "status": "status",
                                   "department": "employee__department_id"})
        s = p.get("search", "").strip()
        if s:
            qs = qs.filter(Q(employee__first_name__icontains=s) | Q(employee__last_name__icontains=s)
                           | Q(employee__employee_id__icontains=s))
        return qs.order_by("-period__end_date", "employee__last_name")


class GoalViewSet(viewsets.ModelViewSet):
    serializer_class = GoalSerializer
    permission_classes = [RolePermission]
    write_roles = ("admin", "manager")
    pagination_class = None

    def get_queryset(self):
        return apply_filters(goals_for(self.request.user), self.request.query_params, {"employee": "employee_id"})


# ---------- dashboards ----------
@api_view(["GET"])
def company_dashboard(request):
    require_roles(request, "admin", "manager")
    p = request.query_params
    return Response(company_metrics(request.user, p.get("period"), p.get("department")))


def employee_payload(request, emp):
    reviews = list(reviews_for(request.user).filter(employee=emp).select_related("period", "reviewer", "employee__department")
                   .prefetch_related("criteria").order_by("-period__end_date"))
    done = sorted([r for r in reviews if r.status == "completed" and r.overall_rating is not None],
                  key=lambda r: r.period.end_date)
    latest = done[-1] if done else None
    goals = list(emp.goals.all())
    return {
        "employee": EmployeeSerializer(emp).data,
        "current_rating": float(latest.overall_rating) if latest else None,
        "previous_rating": float(done[-2].overall_rating) if len(done) > 1 else None,
        "rating_history": [{"period": r.period.name, "rating": float(r.overall_rating)} for r in done],
        "latest_criteria": [{"name": c.name, "rating": c.rating} for c in latest.criteria.all()] if latest else [],
        "goals": GoalSerializer(goals, many=True, context={"request": request}).data,
        "goal_progress": round(sum(g.progress for g in goals) / len(goals)) if goals else 0,
        "reviews": ReviewSerializer(reviews, many=True, context={"request": request}).data,
    }


@api_view(["GET"])
def employee_dashboard(request, pk):
    emp = employees_for(request.user).filter(pk=pk).first()  # out-of-scope ids behave like "not found"
    if not emp:
        raise NotFound("Employee not found.")
    return Response(employee_payload(request, emp))


@api_view(["GET"])
def my_dashboard(request):
    emp = my_profile(request.user)
    if not emp:
        raise NotFound("Your account is not linked to an employee profile.")
    return Response(employee_payload(request, emp))


# ---------- best performers ----------
METHOD = ("Ranked by the average overall rating of COMPLETED reviews only (drafts and submitted reviews are ignored) "
          "for active employees in the selected period/department. Ties share a rank and are listed by number of "
          "completed reviews.")


@api_view(["GET"])
def best_performers(request):
    require_roles(request, "admin", "manager")
    p = request.query_params
    qs = Review.objects.filter(status="completed", overall_rating__isnull=False,
                               employee__in=employees_for(request.user).filter(status="active"))
    if p.get("period", "").isdigit():
        qs = qs.filter(period_id=p["period"])
    if p.get("department", "").isdigit():
        qs = qs.filter(employee__department_id=p["department"])
    limit = min(int(p["limit"]), 50) if p.get("limit", "").isdigit() else 10
    rows = list(qs.values("employee").annotate(avg=Avg("overall_rating"), n=Count("id")).order_by("-avg", "-n", "employee")[:limit])
    emps = Employee.objects.select_related("department").in_bulk([r["employee"] for r in rows])
    out, rank, prev = [], 0, None
    for i, r in enumerate(rows, 1):
        a = round(float(r["avg"]), 2)
        if a != prev:
            rank, prev = i, a
        e = emps[r["employee"]]
        out.append({"rank": rank, "employee": e.id, "employee_name": e.full_name, "job_title": e.job_title,
                    "department_name": e.department.name if e.department else None, "avg_rating": a, "reviews_counted": r["n"]})
    return Response({"method": METHOD, "results": out})


# ---------- reports ----------
def report_rows(request):
    p = request.query_params
    _, revs, period = scoped_reviews(request.user, p.get("period"), p.get("department"))
    if p.get("status"):
        revs = revs.filter(status=p["status"])
    return revs.order_by("period__name", "employee__last_name"), period


@api_view(["GET"])
def report_summary(request):
    require_roles(request, "admin", "manager")
    p = request.query_params
    data = company_metrics(request.user, p.get("period"), p.get("department"))
    revs, _ = report_rows(request)
    data["reviews"] = [{"id": r.id, "employee": r.employee_id, "employee_name": r.employee.full_name,
                        "department_name": r.employee.department.name if r.employee.department else None,
                        "period_name": r.period.name, "rating": float(r.overall_rating) if r.overall_rating else None,
                        "status": r.status, "due_date": r.due_date} for r in revs[:500]]
    return Response(data)


@api_view(["GET"])
def report_export(request):
    require_roles(request, "admin", "manager")
    revs, _ = report_rows(request)
    resp = HttpResponse(content_type="text/csv")
    resp["Content-Disposition"] = f'attachment; filename="performance_reviews_{date.today()}.csv"'
    w = csv.writer(resp)
    w.writerow(["Employee ID", "Employee", "Department", "Job title", "Period", "Status", "Overall rating", "Due date", "Completed at"])
    for r in revs:
        e = r.employee
        w.writerow([e.employee_id, e.full_name, e.department.name if e.department else "", e.job_title, r.period.name,
                    r.status, r.overall_rating or "", r.due_date or "", r.completed_at.date() if r.completed_at else ""])
    return resp
