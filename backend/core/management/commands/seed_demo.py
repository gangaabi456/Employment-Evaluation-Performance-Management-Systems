import random
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import Department, Employee, Goal, Review, ReviewCriterion, ReviewPeriod, User

DEPTS = {
    "Engineering": [("Priya", "Raman", "Engineering Manager"), ("Arjun", "Mehta", "Backend Developer"), ("Sara", "Thomas", "Frontend Developer"), ("Kevin", "Dsouza", "QA Engineer")],
    "Human Resources": [("Meera", "Iyer", "HR Director"), ("Daniel", "Cruz", "Recruiter"), ("Fatima", "Khan", "HR Generalist"), ("Louis", "Baker", "Payroll Analyst")],
    "Sales": [("Rahul", "Nair", "Sales Manager"), ("Emily", "Clark", "Account Executive"), ("Vikram", "Singh", "Sales Associate"), ("Nora", "Ali", "Business Developer")],
    "Marketing": [("Ananya", "Das", "Marketing Manager"), ("Tom", "Reed", "Content Strategist"), ("Lakshmi", "Pillai", "SEO Specialist"), ("Omar", "Haddad", "Designer")],
    "Finance": [("Suresh", "Kumar", "Finance Manager"), ("Grace", "Lee", "Accountant"), ("Ravi", "Shankar", "Financial Analyst"), ("Isha", "Patel", "Auditor")],
    "Customer Support": [("Deepa", "Menon", "Support Lead"), ("Chris", "Evans", "Support Agent"), ("Nisha", "Rao", "Support Agent"), ("Paul", "Joseph", "Support Agent")],
}
CRITERIA = ["Quality of Work", "Productivity", "Communication", "Teamwork", "Initiative"]
COMMENTS = ["Consistently delivers high quality work.", "Strong collaborator; should take on more leadership.",
            "Meets expectations; focus on time management next period.", "Excellent growth this period.",
            "Good results, needs to document processes better."]
GOALS = ["Complete advanced certification", "Improve customer satisfaction score", "Mentor a new team member",
         "Reduce turnaround time by 15%", "Lead a cross-team project", "Improve documentation coverage"]
DEMO_PASSWORD = "Demo@12345"


class Command(BaseCommand):
    help = "Create realistic demo data (use --reset to wipe and recreate)."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true")

    @transaction.atomic
    def handle(self, *args, **opts):
        if opts["reset"]:
            for m in (Review, Goal, Employee, ReviewPeriod, Department):
                m.objects.all().delete()
            User.objects.filter(is_superuser=False).delete()
        if Employee.objects.exists():
            self.stdout.write("Demo data already exists. Use --reset to recreate it.")
            return
        rnd = random.Random(42)
        if not User.objects.filter(username="admin").exists():
            User.objects.create_superuser("admin", "admin@example.com", "Admin@12345")
        periods = [ReviewPeriod.objects.create(name=n, start_date=s, end_date=e, is_active=a) for n, s, e, a in [
            ("2025 H2", date(2025, 7, 1), date(2025, 12, 31), False),
            ("2026 H1", date(2026, 1, 1), date(2026, 6, 30), False),
            ("2026 H2", date(2026, 7, 1), date(2026, 12, 31), True)]]
        n = 0
        for dname, people in DEPTS.items():
            dept = Department.objects.create(name=dname, description=f"{dname} department")
            lead = None
            for i, (fn, ln, title) in enumerate(people):
                n += 1
                uname = f"{fn}.{ln}".lower()
                role = "admin" if (dname == "Human Resources" and i == 0) else "manager" if i == 0 else "employee"
                user = User.objects.create_user(uname, f"{uname}@example.com", DEMO_PASSWORD, first_name=fn, last_name=ln,
                                                role=role, is_staff=(role == "admin"))
                emp = Employee.objects.create(
                    user=user, employee_id=f"EMP{n:03d}", first_name=fn, last_name=ln, email=f"{uname}@example.com",
                    phone=f"+91 98{rnd.randint(10000000, 99999999)}", job_title=title, department=dept, manager=lead,
                    hire_date=date(2019, 1, 1) + timedelta(days=rnd.randint(0, 2000)),
                    status="inactive" if n == 24 else "active")
                if i == 0:
                    lead = emp
                base = rnd.uniform(2.9, 4.6)
                reviewer = lead.user if lead and i else User.objects.get(username="admin")
                for pi, per in enumerate(periods):
                    status = "completed" if pi < 2 else rnd.choices(["completed", "submitted", "draft"], [4, 2, 3])[0]
                    rev = Review.objects.create(
                        employee=emp, period=per, reviewer=reviewer, status=status, comments=rnd.choice(COMMENTS),
                        due_date=per.end_date + timedelta(days=14),
                        completed_at=timezone.now() - timedelta(days=rnd.randint(1, 120)) if status == "completed" else None)
                    ReviewCriterion.objects.bulk_create([
                        ReviewCriterion(review=rev, name=c, rating=max(1, min(5, round(base + rnd.gauss(0, 0.6)))))
                        for c in CRITERIA])
                    rev.recalculate()
                for t in rnd.sample(GOALS, 3):
                    Goal.objects.create(employee=emp, title=t, description="Agreed with manager during the last review.",
                                        due_date=date(2026, 12, 31) + timedelta(days=rnd.randint(0, 120)),
                                        progress=rnd.choice([0, 20, 40, 60, 75, 90, 100]))
        self.stdout.write(self.style.SUCCESS(
            f"Created {n} employees. Logins: admin / Admin@12345 (superuser), meera.iyer (HR admin), "
            f"priya.raman (manager), arjun.mehta (employee) — password {DEMO_PASSWORD}"))
