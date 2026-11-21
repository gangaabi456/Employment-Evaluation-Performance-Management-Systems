from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views as v

router = DefaultRouter()
router.register("departments", v.DepartmentViewSet, "department")
router.register("review-periods", v.ReviewPeriodViewSet, "review-period")
router.register("employees", v.EmployeeViewSet, "employee")
router.register("reviews", v.ReviewViewSet, "review")
router.register("goals", v.GoalViewSet, "goal")

urlpatterns = [
    path("auth/login/", v.login_view),
    path("auth/logout/", v.logout_view),
    path("auth/me/", v.me_view),
    path("dashboard/company/", v.company_dashboard),
    path("dashboard/me/", v.my_dashboard),
    path("employees/<int:pk>/dashboard/", v.employee_dashboard),
    path("best-performers/", v.best_performers),
    path("reports/summary/", v.report_summary),
    path("reports/export/", v.report_export),
    path("", include(router.urls)),
]
