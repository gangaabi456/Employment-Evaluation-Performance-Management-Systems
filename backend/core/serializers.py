from datetime import date

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from .access import employees_for, my_profile
from .models import Department, Employee, Goal, Review, ReviewCriterion, ReviewPeriod, User


class DepartmentSerializer(serializers.ModelSerializer):
    employee_count = serializers.IntegerField(source="employees.count", read_only=True)

    class Meta:
        model = Department
        fields = ["id", "name", "description", "employee_count"]


class ReviewPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewPeriod
        fields = ["id", "name", "start_date", "end_date", "is_active"]

    def validate(self, a):
        s = a.get("start_date", getattr(self.instance, "start_date", None))
        e = a.get("end_date", getattr(self.instance, "end_date", None))
        if s and e and e <= s:
            raise serializers.ValidationError({"end_date": "End date must be after the start date."})
        return a


class EmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)
    manager_name = serializers.CharField(source="manager.full_name", read_only=True, default=None)
    current_rating = serializers.SerializerMethodField()
    has_login = serializers.SerializerMethodField()
    login_role = serializers.SerializerMethodField()
    # write-only helpers to create a login account together with the employee
    login_username = serializers.CharField(write_only=True, required=False, allow_blank=True)
    login_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    login_role_input = serializers.ChoiceField(choices=["employee", "manager", "admin"], write_only=True, required=False)

    class Meta:
        model = Employee
        fields = ["id", "employee_id", "first_name", "last_name", "full_name", "email", "phone", "job_title",
                  "department", "department_name", "manager", "manager_name", "hire_date", "status",
                  "current_rating", "has_login", "login_role", "login_username", "login_password", "login_role_input"]

    def get_current_rating(self, obj):
        r = obj.reviews.filter(status="completed", overall_rating__isnull=False).order_by("-period__end_date").first()
        return float(r.overall_rating) if r else None

    def get_has_login(self, obj):
        return obj.user_id is not None

    def get_login_role(self, obj):
        return obj.user.role if obj.user_id else None

    def validate_hire_date(self, v):
        if v > date.today():
            raise serializers.ValidationError("Hire date cannot be in the future.")
        return v

    def validate(self, a):
        if self.instance and a.get("manager") and a["manager"].pk == self.instance.pk:
            raise serializers.ValidationError({"manager": "An employee cannot be their own manager."})
        uname, pw = a.get("login_username", "").strip(), a.get("login_password", "")
        if uname:
            if User.objects.filter(username__iexact=uname).exclude(pk=getattr(self.instance, "user_id", None)).exists():
                raise serializers.ValidationError({"login_username": "This username is already taken."})
            try:
                validate_password(pw)
            except DjangoValidationError as e:
                raise serializers.ValidationError({"login_password": list(e.messages)})
        return a

    def _make_login(self, emp, a):
        uname = a.get("login_username", "").strip()
        if uname and not emp.user_id:
            emp.user = User.objects.create_user(
                username=uname, password=a["login_password"], email=emp.email, first_name=emp.first_name,
                last_name=emp.last_name, role=a.get("login_role_input", "employee"))
            emp.save(update_fields=["user"])

    def create(self, vd):
        extra = {k: vd.pop(k) for k in ("login_username", "login_password", "login_role_input") if k in vd}
        emp = super().create(vd)
        self._make_login(emp, extra)
        return emp

    def update(self, inst, vd):
        extra = {k: vd.pop(k) for k in ("login_username", "login_password", "login_role_input") if k in vd}
        emp = super().update(inst, vd)
        self._make_login(emp, extra)
        return emp


class CriterionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewCriterion
        fields = ["id", "name", "rating", "comment"]
        read_only_fields = ["id"]


class ReviewSerializer(serializers.ModelSerializer):
    criteria = CriterionSerializer(many=True, required=False)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    department_name = serializers.CharField(source="employee.department.name", read_only=True, default=None)
    period_name = serializers.CharField(source="period.name", read_only=True)
    reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ["id", "employee", "employee_name", "department_name", "period", "period_name", "reviewer_name",
                  "status", "overall_rating", "comments", "due_date", "completed_at", "updated_at", "criteria"]
        read_only_fields = ["overall_rating", "completed_at", "updated_at"]

    def get_reviewer_name(self, obj):
        return (obj.reviewer.get_full_name() or obj.reviewer.username) if obj.reviewer else None

    def validate(self, a):
        request = self.context.get("request")
        emp = a.get("employee") or (self.instance.employee if self.instance else None)
        if request and emp:
            if not employees_for(request.user).filter(pk=emp.pk).exists():
                raise serializers.ValidationError({"employee": "You can only review employees you are authorised for."})
            me = my_profile(request.user)
            if request.user.role != "admin" and me and me.pk == emp.pk:
                raise serializers.ValidationError({"employee": "You cannot review yourself."})
        status = a.get("status", self.instance.status if self.instance else "draft")
        crit = a.get("criteria")
        if status != "draft" and crit is not None and len(crit) == 0:
            raise serializers.ValidationError({"criteria": "Add at least one rated criterion before submitting."})
        return a

    def _save_criteria(self, review, criteria):
        review.criteria.all().delete()
        ReviewCriterion.objects.bulk_create([ReviewCriterion(review=review, **c) for c in criteria])
        review.recalculate()

    def _finish(self, review):
        if review.status == "completed" and not review.completed_at:
            review.completed_at = timezone.now()
        elif review.status != "completed":
            review.completed_at = None
        review.save(update_fields=["completed_at"])

    def create(self, vd):
        criteria = vd.pop("criteria", [])
        review = Review.objects.create(reviewer=self.context["request"].user, **vd)
        self._save_criteria(review, criteria)
        self._finish(review)
        return review

    def update(self, inst, vd):
        criteria = vd.pop("criteria", None)
        for k, v in vd.items():
            setattr(inst, k, v)
        inst.save()
        if criteria is not None:
            self._save_criteria(inst, criteria)
        self._finish(inst)
        return inst


class GoalSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)

    class Meta:
        model = Goal
        fields = ["id", "employee", "employee_name", "title", "description", "due_date", "progress", "status"]
        read_only_fields = ["status"]

    def validate_progress(self, v):
        if not 0 <= v <= 100:
            raise serializers.ValidationError("Progress must be between 0 and 100.")
        return v

    def validate_employee(self, emp):
        request = self.context.get("request")
        if request and not employees_for(request.user).filter(pk=emp.pk).exists():
            raise serializers.ValidationError("You are not allowed to manage goals for this employee.")
        return emp
