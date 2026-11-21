# Employee Performance Evaluation System

A beginner-friendly full-stack app: **React + Bootstrap** (frontend) → **Django REST Framework** (backend) → **MySQL**.
The React app only talks to the REST API; it never connects to MySQL.

## Versions used
| Part | Version |
|---|---|
| Python | 3.10 – 3.13 |
| Django (LTS) / Django REST Framework | 5.2.x / 3.16.x |
| django-cors-headers, python-dotenv, whitenoise, gunicorn | 4.7+, 1.x, 6.9+, 23.x |
| mysqlclient (MySQL driver) | 2.2.x |
| MySQL | 8.0 or 8.4 |
| Node.js | 20 LTS or 22 LTS |
| React / React Router / Vite | 18.3 / 6.30 / 5.4 |
| Bootstrap / Bootstrap Icons / Chart.js | 5.3 / 1.11 / 4.4 |

## Project layout
```
backend/   Django project (config/) and the `core` app: models, serializers, views, metrics, seed command
frontend/  React (Vite) app: pages/, Layout, API client, shared UI
```

## 1. Set up MySQL
Install MySQL 8, then run in the MySQL shell (`mysql -u root -p`):
```sql
CREATE DATABASE employee_performance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'eps_user'@'localhost' IDENTIFIED BY 'choose_a_strong_password';
GRANT ALL PRIVILEGES ON employee_performance.* TO 'eps_user'@'localhost';
FLUSH PRIVILEGES;
```

## 2. Backend (Django)
```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # Windows: copy .env.example .env  — then edit .env (DB_PASSWORD, DJANGO_SECRET_KEY)
python manage.py migrate
python manage.py createsuperuser  # your Admin/HR account (superusers always get the Admin role)
python manage.py seed_demo        # optional demo data (24 employees, 3 review periods, reviews, goals)
python manage.py runserver        # http://localhost:8000
```
`mysqlclient` needs build tools: Ubuntu `sudo apt install python3-dev default-libmysqlclient-dev build-essential pkg-config`; macOS `brew install mysql pkg-config`; Windows normally installs a prebuilt wheel.
No MySQL yet? Set `USE_SQLITE=1` in `.env` for a quick trial only.

**Demo logins** (after `seed_demo`): `admin` / `Admin@12345` (superuser); `meera.iyer` (HR admin), `priya.raman` (Engineering manager), `arjun.mehta` (employee), all with password `Demo@12345`. Use `python manage.py seed_demo --reset` to recreate. Change these passwords before any real use.

## 3. Frontend (React)
```bash
cd frontend
npm install
cp .env.example .env              # VITE_API_URL=http://localhost:8000/api
npm run dev                       # http://localhost:5173
```
Django admin (`http://localhost:8000/admin`) can also be used to manage users, departments and review periods.

## Roles and permissions (enforced in the backend)
| | Admin/HR | Manager | Employee |
|---|---|---|---|
| Employees | full CRUD, create logins | read own team + self | own record only |
| Reviews / goals | full CRUD | create/edit/delete for own team (not self) | read own **completed** reviews and goals |
| Company dashboard, Best Performers, Reports | all employees | own team only | not allowed (403) |
| Departments / review periods | full CRUD | read | read |

All querysets are filtered in `core/access.py`, so another employee's data returns 404/empty rather than being hidden only in the UI.

## Design choices
- **Auth**: DRF token authentication (simple for beginners). The token is kept in `localStorage`; logout deletes it server-side.
- **Overall rating** = average of the review's criteria ratings (1–5), calculated by the server.
- **Dashboard metrics**: calculated per review period (default: the active period; "All periods" is available). *Review completion* = completed ÷ all reviews in the period; *Reviews due* = reviews not yet completed (overdue = past due date).
- **Best Performers ranking**: average overall rating of **completed reviews only**, active employees only; ties share a rank and are ordered by number of completed reviews. The method is shown on the page.
- **Employees cannot see** drafts/submitted reviews or other people's data; they get "My Dashboard".
- **Pagination**: employees and reviews lists are paginated (10 per page).
- Reports export is CSV (opens in Excel).

## API overview (all under `/api/`, header `Authorization: Token <token>`)
`POST auth/login/` · `POST auth/logout/` · `GET auth/me/` · `GET dashboard/company/?period=&department=` · `GET dashboard/me/` · `GET employees/<id>/dashboard/` · `GET best-performers/?period=&department=` · `GET reports/summary/` · `GET reports/export/` (CSV) · CRUD: `employees/` (`?search=&department=&status=`), `reviews/` (`?search=&period=&status=&department=&employee=`), `goals/`, `departments/`, `review-periods/`.

## Deployment (typical Linux server)
1. Provision MySQL (managed or self-hosted), create the DB/user as above.
2. **Backend**: set production env vars: `DJANGO_DEBUG=False`, a long random `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS=api.example.com`, `CORS_ALLOWED_ORIGINS=https://app.example.com`, DB settings. Then:
   `pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --noinput`
   and run `gunicorn config.wsgi:application --bind 127.0.0.1:8000` as a service (systemd) behind Nginx with HTTPS (e.g. Let's Encrypt). WhiteNoise serves the admin static files.
3. **Frontend**: set `VITE_API_URL=https://api.example.com/api` in `frontend/.env`, run `npm run build`, and serve `frontend/dist` as static files (Nginx, Netlify, Vercel…). For client-side routing configure a fallback to `index.html` (Nginx: `try_files $uri /index.html;`).
4. Do not run `seed_demo` in production, and never commit `.env`.
