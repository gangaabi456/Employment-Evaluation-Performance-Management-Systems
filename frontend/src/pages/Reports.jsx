import { useState } from "react";
import { Link } from "react-router-dom";
import { api, errText } from "../api.js";
import { ErrorBox, Kpi, Loading, PeriodSelect, RatingBadge, StatusBadge, fmtDate, useFetch, useLookups } from "../ui.jsx";

export default function Reports() {
  const { periods, departments } = useLookups();
  const [f, setF] = useState({ period: "", department: "", status: "" });
  const [msg, setMsg] = useState("");
  const { data: d, loading, error } = useFetch(() => api("/reports/summary/", { params: f }), [f]);

  const exportCsv = async () => {
    setMsg("");
    try {
      const blob = await api("/reports/export/", { params: f, blob: true });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "performance_reviews.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { setMsg(errText(e)); }
  };

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h4 mb-0">Reports</h1>
        <div className="d-flex gap-2 flex-wrap">
          <PeriodSelect periods={periods} value={f.period} onChange={(v) => setF({ ...f, period: v })} allOption />
          <select className="form-select form-select-sm w-auto" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>
            <option value="">All departments</option>{departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select className="form-select form-select-sm w-auto" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">Any status</option><option value="draft">Draft</option><option value="submitted">Submitted</option><option value="completed">Completed</option></select>
          <button className="btn btn-success btn-sm" onClick={exportCsv}><i className="bi bi-download me-1" />Export CSV</button>
        </div>
      </div>
      <ErrorBox error={error || msg} />
      {loading && !d ? <Loading /> : d && (
        <>
          <div className="row row-cols-2 row-cols-lg-4 g-3 mb-3">
            <Kpi icon="clipboard-data" label="Total reviews" value={d.total_reviews} />
            <Kpi icon="check2-circle" label="Completed" value={`${d.completed_reviews} (${d.review_completion}%)`} color="#2a9d8f" />
            <Kpi icon="star" label="Average rating" value={d.average_rating ?? "—"} color="#f4a261" />
            <Kpi icon="exclamation-circle" label="Overdue" value={d.reviews_overdue} color="#e63946" />
          </div>
          <div className="card mb-3"><div className="card-body"><h2 className="h6">Department summary</h2>
            <div className="table-responsive"><table className="table table-sm mb-0"><thead><tr><th>Department</th><th>Staff</th><th>Reviews</th><th>Completed</th><th>Avg rating</th></tr></thead><tbody>
              {d.departments.map((x) => <tr key={x.id}><td>{x.name}</td><td>{x.headcount}</td><td>{x.reviews}</td><td>{x.completed}</td><td><RatingBadge value={x.avg_rating} /></td></tr>)}
            </tbody></table></div></div></div>
          <div className="card"><div className="card-body"><h2 className="h6">Review summary</h2>
            <div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>Employee</th><th>Department</th><th>Period</th><th>Rating</th><th>Status</th><th>Due</th></tr></thead><tbody>
              {d.reviews.map((r) => <tr key={r.id}><td><Link to={`/employees/${r.employee}`}>{r.employee_name}</Link></td><td>{r.department_name || "—"}</td><td>{r.period_name}</td><td><RatingBadge value={r.rating} /></td><td><StatusBadge value={r.status} /></td><td>{fmtDate(r.due_date)}</td></tr>)}
              {!d.reviews.length && <tr><td colSpan="6" className="text-muted">No reviews match.</td></tr>}
            </tbody></table></div></div></div>
        </>
      )}
    </>
  );
}
