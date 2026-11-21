from decimal import Decimal

from django.contrib.auth.models import AbstractUser
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class User(AbstractUser):
    """Login account. `role` drives all permissions."""
    ROLE_CHOICES = [("admin", "Admin/HR"), ("manager", "Manager"), ("employee", "Employee")]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="employee")

    def save(self, *args, **kwargs):
        if self.is_superuser:
            self.role = "admin"
        super().save(*args, **kwargs)


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Employee(models.Model):
    STATUS_CHOICES = [("active", "Active"), ("inactive", "Inactive")]
    user = models.OneToOneField(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="employee")
    employee_id = models.CharField(max_length=20, unique=True)
    first_name = models.CharField(max_length=60)
    last_name = models.CharField(max_length=60)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30, blank=True)
    job_title = models.CharField(max_length=100)
    department = models.ForeignKey(Department, null=True, blank=True, on_delete=models.SET_NULL, related_name="employees")
    manager = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="team")
    hire_date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="active")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def __str__(self):
        return f"{self.full_name} ({self.employee_id})"


class ReviewPeriod(models.Model):
    name = models.CharField(max_length=60, unique=True)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=False)

    class Meta:
        ordering = ["-end_date"]

    def __str__(self):
        return self.name


class Review(models.Model):
    STATUS_CHOICES = [("draft", "Draft"), ("submitted", "Submitted"), ("completed", "Completed")]
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="reviews")
    period = models.ForeignKey(ReviewPeriod, on_delete=models.CASCADE, related_name="reviews")
    reviewer = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviews_written")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="draft")
    overall_rating = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    comments = models.TextField(blank=True)
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("employee", "period")
        ordering = ["-updated_at"]

    def recalculate(self):
        """Overall rating = average of criteria ratings."""
        avg = self.criteria.aggregate(a=models.Avg("rating"))["a"]
        self.overall_rating = Decimal(str(round(avg, 2))) if avg is not None else None
        self.save(update_fields=["overall_rating"])


class ReviewCriterion(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="criteria")
    name = models.CharField(max_length=80)
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.CharField(max_length=300, blank=True)


class Goal(models.Model):
    STATUS_CHOICES = [("not_started", "Not started"), ("in_progress", "In progress"), ("completed", "Completed")]
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="goals")
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    due_date = models.DateField(null=True, blank=True)
    progress = models.PositiveSmallIntegerField(default=0, validators=[MaxValueValidator(100)])
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="not_started")

    class Meta:
        ordering = ["due_date", "id"]

    def save(self, *args, **kwargs):
        self.status = "completed" if self.progress >= 100 else "not_started" if self.progress == 0 else "in_progress"
        super().save(*args, **kwargs)
