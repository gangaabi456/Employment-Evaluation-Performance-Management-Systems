"""Role-based data scoping. Every queryset the API returns goes through these helpers."""
from rest_framework.pagination import PageNumberPagination

from .models import Employee, Goal, Review


class StandardPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 200


def my_profile(user):
    return getattr(user, "employee", None)


def employees_for(user):
    qs = Employee.objects.select_related("department", "manager")
    if user.role == "admin":
        return qs
    me = my_profile(user)
    if not me:
        return qs.none()
    if user.role == "manager":
        return qs.filter(manager=me) | qs.filter(pk=me.pk)  # own team + self
    return qs.filter(pk=me.pk)  # employees: only themselves


def reviews_for(user):
    qs = Review.objects.filter(employee__in=employees_for(user))
    if user.role == "employee":
        qs = qs.filter(status="completed")  # employees never see drafts / in-progress reviews
    return qs


def goals_for(user):
    return Goal.objects.filter(employee__in=employees_for(user)).select_related("employee")
