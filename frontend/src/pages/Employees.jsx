import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, errText, fieldErrors } from "../api.js";
import { useAuth } from "../auth.jsx";
import { ErrorBox, Field, Loading, Modal, Pager, RatingBadge, StatusBadge, useFetch, useLookups } from "../ui.jsx";

const EMPTY = { employee_id: "", first_name: "", last_name: "", email: "", phone: "", job_title: "", department: "", manager: "",
  hire_date: "", status: "active", create_login: false, login_username: "", login_password: "", login_role_input: "employee" };

function EmployeeForm({ initial, departments, onClose, onSaved }) {
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial, department: initial.department ?? "", manager: initial.manager ?? "" } : EMPTY);
  const [errors, setErrors] = useState({});
  const [managers, setManagers] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/employees/", { params: { page_size: 200 } }).then((r) => setManagers(r.results)).catch(() => {}); }, []);
  const f = (n) => ({ value: form[n] ?? "", onChange: (e) => setForm({ ...form, [n]: e.target.value }), className: `form-control ${errors[n] ? "is-invalid" : ""}` });

  const validate = () => {
    const e = {};
    ["employee_id", "first_name", "last_name", "job_title", "hire_date"].forEach((k) => { if (!String(form[k]).trim()) e[k] = "This field is required."; });
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email address.";
    if (form.hire_date && new Date(form.hire_date) > new Date()) e.hire_date = "Hire date cannot be in the future.";
    if (form.create_login) {
      if (!form.login_username.trim()) e.login_username = "Username is required.";
      if (form.login_password.length < 8) e.login_password = "Password must be at least 8 characters.";
    }
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;
    const { create_login, ...rest } = form;
    const body = { ...rest, department: form.department || null, manager: form.manager || null };
    if (!create_login) { delete body.login_username; delete body.login_password; delete body.login_role_input; }
    setBusy(true);
    try {
      await api(initial ? `/employees/${initial.id}/` : "/employees/", { method: initial ? "PUT" : "POST", body });
      onSaved();
    } catch (ex) { setErrors(fieldErrors(ex)); setBusy(false); }
  };

  return (
    <Modal title={initial ? "Edit employee" : "Add employee"} onClose={onClose}
      footer={<><button className="btn btn-light" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="emp-form" disabled={busy}>{busy ? "Saving…" : "Save"}</button></>}>
      <form id="emp-form" className="row g-3" onSubmit={submit} noValidate>
        {errors._form && <div className="alert alert-danger">{errors._form}</div>}
        <Field label="Employee ID *" error={errors.employee_id}><input {...f("employee_id")} /></Field>
        <Field label="Job title *" error={errors.job_title}><input {...f("job_title")} /></Field>
        <Field label="First name *" error={errors.first_name}><input {...f("first_name")} /></Field>
        <Field label="Last name *" error={errors.last_name}><input {...f("last_name")} /></Field>
        <Field label="Email *" error={errors.email}><input type="email" {...f("email")} /></Field>
        <Field label="Phone" error={errors.phone}><input {...f("phone")} /></Field>
        <Field label="Department" error={errors.department}><select {...f("department")} className="form-select"><option value="">— None —</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Manager" error={errors.manager}><select {...f("manager")} className="form-select"><option value="">— None —</option>{managers.filter((m) => m.id !== initial?.id).map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></Field>
        <Field label="Hire date *" error={errors.hire_date}><input type="date" {...f("hire_date")} /></Field>
        <Field label="Status" error={errors.status}><select {...f("status")} className="form-select"><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
        {!initial?.has_login && (
          <div className="col-12 border-top pt-3">
            <div className="form-check mb-2"><input id="cl" type="checkbox" className="form-check-input" checked={form.create_login} onChange={(e) => setForm({ ...form, create_login: e.target.checked })} /><label htmlFor="cl" className="form-check-label">Create a login account for this employee</label></div>
            {form.create_login && <div className="row g-3">
              <Field label="Username *" error={errors.login_username} cls="col-md-4"><input {...f("login_username")} /></Field>
              <Field label="Password * (min 8)" error={errors.login_password} cls="col-md-4"><input type="password" {...f("login_password")} /></Field>
              <Field label="Role" cls="col-md-4"><select {...f("login_role_input")} className="form-select"><option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin/HR</option></select></Field>
            </div>}
          </div>)}
      </form>
    </Modal>
  );
}

export default function Employees() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [sp] = useSearchParams();
  const { departments } = useLookups();
  const [filters, setFilters] = useState({ search: sp.get("search") || "", department: "", status: "" });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // null | {} (new) | employee
  const [msg, setMsg] = useState("");
  useEffect(() => { setFilters((x) => ({ ...x, search: sp.get("search") || "" })); setPage(1); }, [sp]);
  const { data, loading, error, reload } = useFetch(() => api("/employees/", { params: { ...filters, page } }), [filters, page]);
  const setF = (k, v) => { setFilters({ ...filters, [k]: v }); setPage(1); };

  const remove = async (e) => {
    if (!window.confirm(`Delete ${e.full_name}? Their reviews, goals and login will also be deleted.`)) return;
    try { await api(`/employees/${e.id}/`, { method: "DELETE" }); reload(); } catch (ex) { setMsg(errText(ex)); }
  };

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h4 mb-0">Employee Directory</h1>
        {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}><i className="bi bi-plus-lg me-1" />Add employee</button>}
      </div>
      <div className="row g-2 mb-3">
        <div className="col-12 col-md-5"><input className="form-control form-control-sm" placeholder="Search name, email, title or ID" value={filters.search} onChange={(e) => setF("search", e.target.value)} /></div>
        <div className="col-6 col-md-3"><select className="form-select form-select-sm" value={filters.department} onChange={(e) => setF("department", e.target.value)}><option value="">All departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div className="col-6 col-md-3"><select className="form-select form-select-sm" value={filters.status} onChange={(e) => setF("status", e.target.value)}><option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      </div>
      <ErrorBox error={error || msg} />
      {loading && !data ? <Loading /> : data && (
        <div className="card"><div className="card-body">
          <div className="table-responsive"><table className="table table-hover align-middle mb-0">
            <thead><tr><th>ID</th><th>Name</th><th>Department</th><th>Title</th><th>Rating</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
            <tbody>
              {data.results.map((e) => (
                <tr key={e.id}><td>{e.employee_id}</td>
                  <td><Link className="fw-semibold text-decoration-none" to={`/employees/${e.id}`}>{e.full_name}</Link><div className="small text-muted">{e.email}</div></td>
                  <td>{e.department_name || "—"}</td><td>{e.job_title}</td><td><RatingBadge value={e.current_rating} /></td><td><StatusBadge value={e.status} /></td>
                  <td className="text-end text-nowrap">
                    <Link className="btn btn-sm btn-outline-primary me-1" to={`/employees/${e.id}`} title="View"><i className="bi bi-eye" /></Link>
                    {isAdmin && <><button className="btn btn-sm btn-outline-secondary me-1" title="Edit" onClick={() => setEditing(e)}><i className="bi bi-pencil" /></button>
                      <button className="btn btn-sm btn-outline-danger" title="Delete" onClick={() => remove(e)}><i className="bi bi-trash" /></button></>}
                  </td></tr>))}
              {!data.results.length && <tr><td colSpan="7" className="text-center text-muted p-4">No employees found.</td></tr>}
            </tbody></table></div>
          <Pager page={page} count={data.count} onPage={setPage} />
        </div></div>)}
      {editing && <EmployeeForm initial={editing.id ? editing : null} departments={departments} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}
