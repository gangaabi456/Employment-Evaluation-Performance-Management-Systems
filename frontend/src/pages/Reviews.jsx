import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errText, fieldErrors } from "../api.js";
import { ErrorBox, Field, Loading, Modal, Pager, PeriodSelect, RatingBadge, StatusBadge, fmtDate, useFetch, useLookups } from "../ui.jsx";

const DEFAULT_CRITERIA = ["Quality of Work", "Productivity", "Communication", "Teamwork", "Initiative"];

function ReviewForm({ initial, periods, onClose, onSaved }) {
  const [form, setForm] = useState({
    employee: initial?.employee ?? "", period: initial?.period ?? (periods.find((p) => p.is_active)?.id ?? ""),
    status: initial?.status ?? "draft", due_date: initial?.due_date ?? "", comments: initial?.comments ?? "",
    criteria: initial?.criteria?.length ? initial.criteria : DEFAULT_CRITERIA.map((name) => ({ name, rating: "", comment: "" })),
  });
  const [errors, setErrors] = useState({});
  const [employees, setEmployees] = useState([]);
  useEffect(() => { api("/employees/", { params: { page_size: 200, status: "active" } }).then((r) => setEmployees(r.results)).catch(() => {}); }, []);
  const setC = (i, k, v) => setForm({ ...form, criteria: form.criteria.map((c, j) => (j === i ? { ...c, [k]: v } : c)) });

  const submit = async (ev) => {
    ev.preventDefault();
    const e = {};
    if (!form.employee) e.employee = "Select an employee.";
    if (!form.period) e.period = "Select a review period.";
    const rated = form.criteria.filter((c) => c.rating !== "");
    if (form.criteria.some((c) => !c.name.trim())) e.criteria = "Every criterion needs a name.";
    else if (form.status !== "draft" && (rated.length === 0 || rated.length !== form.criteria.length)) e.criteria = "Rate every criterion (1–5) before submitting or completing.";
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      const body = { ...form, due_date: form.due_date || null, criteria: rated.map((c) => ({ name: c.name, rating: Number(c.rating), comment: c.comment })) };
      await api(initial ? `/reviews/${initial.id}/` : "/reviews/", { method: initial ? "PUT" : "POST", body });
      onSaved();
    } catch (ex) { setErrors(fieldErrors(ex)); }
  };

  return (
    <Modal title={initial ? "Edit review" : "New review"} onClose={onClose} footer={<><button className="btn btn-light" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="rev-form">Save review</button></>}>
      <form id="rev-form" className="row g-3" onSubmit={submit} noValidate>
        {(errors._form || errors.non_field_errors) && <div className="alert alert-danger">{errors._form || errors.non_field_errors}</div>}
        <Field label="Employee *" error={errors.employee}><select className="form-select" value={form.employee} disabled={!!initial} onChange={(e) => setForm({ ...form, employee: e.target.value })}><option value="">Select…</option>{employees.map((x) => <option key={x.id} value={x.id}>{x.full_name} ({x.employee_id})</option>)}</select></Field>
        <Field label="Review period *" error={errors.period}><select className="form-select" value={form.period} disabled={!!initial} onChange={(e) => setForm({ ...form, period: e.target.value })}><option value="">Select…</option>{periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Status"><select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="draft">Draft</option><option value="submitted">Submitted</option><option value="completed">Completed</option></select></Field>
        <Field label="Due date" error={errors.due_date}><input type="date" className="form-control" value={form.due_date || ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
        <div className="col-12"><label className="form-label small fw-semibold mb-1">Rating criteria (1 = poor, 5 = outstanding)</label>
          {form.criteria.map((c, i) => (
            <div className="row g-2 mb-2" key={i}>
              <div className="col-12 col-md-4"><input className="form-control form-control-sm" value={c.name} onChange={(e) => setC(i, "name", e.target.value)} /></div>
              <div className="col-4 col-md-2"><select className="form-select form-select-sm" value={c.rating} onChange={(e) => setC(i, "rating", e.target.value)}><option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></div>
              <div className="col-6 col-md-5"><input className="form-control form-control-sm" placeholder="Comment" value={c.comment} onChange={(e) => setC(i, "comment", e.target.value)} /></div>
              <div className="col-2 col-md-1"><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setForm({ ...form, criteria: form.criteria.filter((_, j) => j !== i) })}><i className="bi bi-x" /></button></div>
            </div>))}
          {errors.criteria && <div className="invalid-feedback d-block">{errors.criteria}</div>}
          <button type="button" className="btn btn-sm btn-link p-0" onClick={() => setForm({ ...form, criteria: [...form.criteria, { name: "", rating: "", comment: "" }] })}>+ Add criterion</button>
          <div className="small text-muted mt-1">Overall rating is calculated automatically as the average.</div></div>
        <Field label="Overall comments" cls="col-12"><textarea className="form-control" rows="3" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} /></Field>
      </form>
    </Modal>
  );
}

export default function Reviews() {
  const { periods, departments } = useLookups();
  const [f, setF] = useState({ search: "", period: "", status: "", department: "" });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [msg, setMsg] = useState("");
  const { data, loading, error, reload } = useFetch(() => api("/reviews/", { params: { ...f, page } }), [f, page]);
  const set = (k, v) => { setF({ ...f, [k]: v }); setPage(1); };

  const remove = async (r) => {
    if (!window.confirm(`Delete ${r.employee_name}'s ${r.period_name} review?`)) return;
    try { await api(`/reviews/${r.id}/`, { method: "DELETE" }); reload(); } catch (e) { setMsg(errText(e)); }
  };

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h4 mb-0">Performance Reviews</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}><i className="bi bi-plus-lg me-1" />New review</button>
      </div>
      <div className="row g-2 mb-3">
        <div className="col-12 col-md-4"><input className="form-control form-control-sm" placeholder="Search employee" value={f.search} onChange={(e) => set("search", e.target.value)} /></div>
        <div className="col-6 col-md-3"><PeriodSelect periods={periods} value={f.period} blank="All periods" onChange={(v) => set("period", v)} /></div>
        <div className="col-6 col-md-2"><select className="form-select form-select-sm" value={f.status} onChange={(e) => set("status", e.target.value)}><option value="">Any status</option><option value="draft">Draft</option><option value="submitted">Submitted</option><option value="completed">Completed</option></select></div>
        <div className="col-12 col-md-3"><select className="form-select form-select-sm" value={f.department} onChange={(e) => set("department", e.target.value)}><option value="">All departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
      </div>
      <ErrorBox error={error || msg} />
      {loading && !data ? <Loading /> : data && (
        <div className="card"><div className="card-body">
          <div className="table-responsive"><table className="table table-hover align-middle mb-0">
            <thead><tr><th>Employee</th><th>Period</th><th>Rating</th><th>Status</th><th>Due</th><th>Reviewer</th><th className="text-end">Actions</th></tr></thead><tbody>
              {data.results.map((r) => (
                <tr key={r.id}><td><Link to={`/employees/${r.employee}`} className="text-decoration-none fw-semibold">{r.employee_name}</Link><div className="small text-muted">{r.department_name}</div></td>
                  <td>{r.period_name}</td><td><RatingBadge value={r.overall_rating} /></td><td><StatusBadge value={r.status} /></td><td>{fmtDate(r.due_date)}</td><td>{r.reviewer_name || "—"}</td>
                  <td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-primary me-1" onClick={() => setViewing(r)}><i className="bi bi-eye" /></button>
                    <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setEditing(r)}><i className="bi bi-pencil" /></button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => remove(r)}><i className="bi bi-trash" /></button></td></tr>))}
              {!data.results.length && <tr><td colSpan="7" className="text-center text-muted p-4">No reviews found.</td></tr>}
            </tbody></table></div>
          <Pager page={page} count={data.count} onPage={setPage} />
        </div></div>)}
      {editing && <ReviewForm initial={editing.id ? editing : null} periods={periods} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {viewing && (
        <Modal title={`${viewing.employee_name} — ${viewing.period_name}`} onClose={() => setViewing(null)}>
          <p><StatusBadge value={viewing.status} /> <RatingBadge value={viewing.overall_rating} /> <span className="text-muted small ms-2">Reviewer: {viewing.reviewer_name || "—"}</span></p>
          <table className="table table-sm"><thead><tr><th>Criterion</th><th>Rating</th><th>Comment</th></tr></thead><tbody>
            {viewing.criteria.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.rating} / 5</td><td>{c.comment || "—"}</td></tr>)}
            {!viewing.criteria.length && <tr><td colSpan="3" className="text-muted">No criteria rated yet.</td></tr>}</tbody></table>
          <p className="mb-0"><strong>Comments:</strong> {viewing.comments || "—"}</p>
        </Modal>)}
    </>
  );
}
