import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./auth.jsx";

const NAV = [
  ["/dashboard", "speedometer2", "Company Dashboard", ["admin", "manager"]],
  ["/my-dashboard", "person-badge", "My Dashboard", ["admin", "manager", "employee"], true],
  ["/employees", "people", "Employees", ["admin", "manager"]],
  ["/best-performers", "trophy", "Best Performers", ["admin", "manager"]],
  ["/reviews", "clipboard-check", "Reviews", ["admin", "manager"]],
  ["/reports", "bar-chart-line", "Reports", ["admin", "manager"]],
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const search = (e) => { e.preventDefault(); nav(`/employees?search=${encodeURIComponent(q.trim())}`); };
  const roleLabel = { admin: "Admin/HR", manager: "Manager", employee: "Employee" }[user.role];

  return (
    <>
      <aside className={`sidebar ${open ? "open" : ""}`} onClick={() => setOpen(false)}>
        <div className="brand"><i className="bi bi-graph-up-arrow me-2" />Performance HQ</div>
        <nav className="mt-2">
          {NAV.filter(([, , , roles, needsProfile]) => roles.includes(user.role) && (!needsProfile || user.employee)).map(([to, icon, label]) => (
            <NavLink key={to} to={to}><i className={`bi bi-${icon}`} />{label}</NavLink>
          ))}
        </nav>
      </aside>
      <div className={`overlay ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar d-flex align-items-center gap-2 px-3 py-2">
          <button className="btn btn-outline-secondary btn-sm d-lg-none" onClick={() => setOpen(true)} aria-label="Menu"><i className="bi bi-list" /></button>
          {user.role !== "employee" ? (
            <form className="flex-grow-1" style={{ maxWidth: 420 }} onSubmit={search}>
              <div className="input-group input-group-sm">
                <span className="input-group-text"><i className="bi bi-search" /></span>
                <input className="form-control" placeholder="Search employees…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </form>
          ) : <div className="flex-grow-1" />}
          <div className="text-end small lh-sm d-none d-sm-block"><div className="fw-semibold">{user.full_name}</div><div className="text-muted">{roleLabel}</div></div>
          <button className="btn btn-outline-danger btn-sm" onClick={logout}><i className="bi bi-box-arrow-right" /><span className="d-none d-md-inline ms-1">Logout</span></button>
        </header>
        <main className="p-3 p-md-4"><Outlet /></main>
      </div>
    </>
  );
}
