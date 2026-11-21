import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errText, fieldErrors } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Bar, Line, COLORS, opts } from "../charts.js";
import { ErrorBox, Field, Kpi, Loading, Modal, RatingBadge, StatusBadge, fmtDate, useFetch } from "../ui.jsx";

function GoalForm({ employeeId, goal, onClose, onSaved }) {
  const [form, setForm] = useState(goal || { title: "", description: "", due_date: "", progress: 0 });
  const [errors, setErrors] = useState({});
  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!form.title.trim()) v.title = "Title is required.";
    const p = Number(form.progress);
    if (Number.isNaN(p) || p < 0 || p > 100) v.progress = "Progress must be 0–100.";
    setErrors(v);
    if (Object.keys(v).length) return;
    try {
      await api(goal ? `/goals/${goal.id}/` : "/goals/", { method: goal ? "PUT" : "POST", body: { ...form, progress: p, due_date: form.due_date || null, employee: employeeId } });
      onSaved();
    } catch (ex) { setErrors(fieldErrors(ex)); }
  };
  return (
    <Modal title={goal ? "Edit goal" : "Add goal"} size="" onClose={onClose} footer={<button className="btn btn-primary" form="goal-form">Save</button>}>
      <form id="goal-form" className="row g-3" onSubmit={submit} noValidate>
        {errors._form && <div className="alert alert-danger">{errors._form}</div>}
        <Field label="Title *" cls="col-12" error={errors.title}><input className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Description" cls="col-12"><textarea className="form-control" rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Due date" error={errors.due_date}><input type="date" className="form-control" value={form.due_date || ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
        <Field label="Progress % (0–100)" error={errors.progress}><input type="number" min="0" max="100" className="form-control" value={form.progress} onChange={(e) => setForm({ ...form, progress: e.target.value })} /></Field>
      </form>
    </Modal>
  );
}

export default function EmployeeDashboard({ mine }) {
  const { user } = useAuth();
  const { id } = useParams();
  const canEdit = user.role !== "employee";
  const { data: d, loading, error, reload } = useFetch(() => api(mine ? "/dashboard/me/" : `/employees/${id}/dashboard/`), [mine, id]);
  const [goalModal, setGoalModal] = useState(null);
  const [msg, setMsg] = useState("");

  const delGoal = async (g) => {
    if (!window.confirm("Delete this goal?")) return;
    try { await api(`/goals/${g.id}/`, { method: "DELETE" }); reload(); } catch (e) { setMsg(errText(e)); }
  };
  if (loading && !d) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const e = d.employee;
  const delta = d.previous_rating != null && d.current_rating != null ? (d.current_rating - d.previous_rating).toFixed(2) : null;

  return (
    <>
      {!mine && <Link to="/employees" className="small text-decoration-none"><i className="bi bi-arrow-left" /> Back to directory</Link>}
      <div className="card mb-3 mt-1"><div className="card-body d-flex flex-wrap justify-content-between gap-3">
        <div><h1 className="h4 mb-1">{e.full_name} <StatusBadge value={e.status} /></h1>
          <div className="text-muted">{e.job_title} · {e.department_name || "No department"}</div>
          <div className="small text-muted mt-1"><i className="bi bi-envelope me-1" />{e.email}{e.phone && <> · <i className="bi bi-telephone me-1" />{e.phone}</>}</div></div>
        <div className="small text-muted"><div>Employee ID: <strong>{e.employee_id}</strong></div><div>Manager: <strong>{e.manager_name || "—"}</strong></div><div>Hired: <strong>{fmtDate(e.hire_date)}</strong></div></div>
      </div></div>
      <div className="row row-cols-2 row-cols-lg-4 g-3 mb-3">
        <Kpi icon="star" label="Current rating" value={d.current_rating ?? "—"} sub={delta ? `${delta > 0 ? "+" : ""}${delta} vs previous` : "latest completed review"} color="#f4a261" />
        <Kpi icon="clipboard-check" label="Completed reviews" value={d.rating_history.length} color="#2a9d8f" />
        <Kpi icon="bullseye" label="Goal progress" value={`${d.goal_progress}%`} sub="average of all goals" />
        <Kpi icon="flag" label="Goals" value={d.goals.length} color="#6f42c1" />
      </div>
      <div className="row g-3 mb-3">
        <div className="col-lg-6"><div className="card h-100"><div className="card-body"><h2 className="h6">Rating history</h2>
          {d.rating_history.length ? <div className="chart-box"><Line options={{ ...opts, scales: { y: { min: 0, max: 5 } } }} data={{ labels: d.rating_history.map((r) => r.period), datasets: [{ data: d.rating_history.map((r) => r.rating), borderColor: "#3d5afe", backgroundColor: "#3d5afe33", fill: true, tension: 0.3 }] }} /></div> : <p className="text-muted">No completed reviews yet.</p>}</div></div></div>
        <div className="col-lg-6"><div className="card h-100"><div className="card-body"><h2 className="h6">Latest review by criterion</h2>
          {d.latest_criteria.length ? <div className="chart-box"><Bar options={{ ...opts, indexAxis: "y", scales: { x: { min: 0, max: 5 } } }} data={{ labels: d.latest_criteria.map((c) => c.name), datasets: [{ data: d.latest_criteria.map((c) => c.rating), backgroundColor: COLORS[3] }] }} /></div> : <p className="text-muted">No data.</p>}</div></div></div>
      </div>
      <div className="card mb-3"><div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-2"><h2 className="h6 mb-0">Goals</h2>
          {canEdit && <button className="btn btn-sm btn-outline-primary" onClick={() => setGoalModal({})}><i className="bi bi-plus-lg" /> Add goal</button>}</div>
        <ErrorBox error={msg} />
        {d.goals.map((g) => (
          <div key={g.id} className="border-bottom py-2"><div className="d-flex justify-content-between gap-2">
            <div><strong>{g.title}</strong> <StatusBadge value={g.status} /><div className="small text-muted">{g.description} {g.due_date && `· Due ${fmtDate(g.due_date)}`}</div></div>
            {canEdit && <div className="text-nowrap"><button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setGoalModal(g)}><i className="bi bi-pencil" /></button><button className="btn btn-sm btn-outline-danger" onClick={() => delGoal(g)}><i className="bi bi-trash" /></button></div>}
          </div><div className="progress mt-1" style={{ height: 8 }}><div className="progress-bar" style={{ width: `${g.progress}%` }} /></div><small className="text-muted">{g.progress}%</small></div>))}
        {!d.goals.length && <p className="text-muted mb-0">No goals set.</p>}
      </div></div>
      <div className="card"><div className="card-body"><h2 className="h6">Review history</h2>
        <div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>Period</th><th>Rating</th><th>Status</th><th>Reviewer</th><th>Comments</th></tr></thead><tbody>
          {d.reviews.map((r) => <tr key={r.id}><td>{r.period_name}</td><td><RatingBadge value={r.overall_rating} /></td><td><StatusBadge value={r.status} /></td><td>{r.reviewer_name || "—"}</td><td className="small">{r.comments || "—"}</td></tr>)}
          {!d.reviews.length && <tr><td colSpan="5" className="text-muted">No reviews yet.</td></tr>}
        </tbody></table></div></div></div>
      {goalModal && <GoalForm employeeId={e.id} goal={goalModal.id ? goalModal : null} onClose={() => setGoalModal(null)} onSaved={() => { setGoalModal(null); reload(); }} />}
    </>
  );
}
