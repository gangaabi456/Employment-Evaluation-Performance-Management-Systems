from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Department, Employee, Goal, Review, ReviewCriterion, ReviewPeriod, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Role", {"fields": ("role",)}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("Role", {"fields": ("role",)}),)
    list_display = ("username", "email", "role", "is_active")


class CriterionInline(admin.TabularInline):
    model = ReviewCriterion
    extra = 0


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("employee", "period", "status", "overall_rating")
    inlines = [CriterionInline]


admin.site.register([Department, Employee, ReviewPeriod, Goal])
