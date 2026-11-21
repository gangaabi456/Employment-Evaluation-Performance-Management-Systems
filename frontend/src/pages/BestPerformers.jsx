import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { ErrorBox, Loading, PeriodSelect, RatingBadge, useFetch, useLookups } from "../ui.jsx";

const MEDAL = { 1: "#d4af37", 2: "#9aa0a6", 3: "#b87333" };

export default function BestPerformers() {
  const { periods, departments } = useLookups();
  const [period, setPeriod] = useState("");
  const [department, setDepartment] = useState("");
  const { data, loading, error } = useFetch(() => api("/best-performers/", { params: { period, department, limit: 10 } }), [period, department]);

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h4 mb-0"><i className="bi bi-trophy me-2 text-warning" />Best Performers</h1>
        <div className="d-flex gap-2 flex-wrap">
          <PeriodSelect periods={periods} value={period} onChange={setPeriod} blank="All periods" />
          <select className="form-select form-select-sm w-auto" value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <div className="alert alert-info small"><i className="bi bi-info-circle me-1" /><strong>Ranking method:</strong> {data?.method || "Average overall rating of completed reviews only."}</div>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : data && (
        <div className="card"><div className="table-responsive"><table className="table align-middle mb-0">
          <thead><tr><th>Rank</th><th>Employee</th><th>Department</th><th>Avg rating</th><th>Completed reviews</th><th /></tr></thead>
          <tbody>
            {data.results.map((r) => (
              <tr key={r.employee}>
                <td className="fw-bold">{MEDAL[r.rank] ? <i className="bi bi-award-fill me-1" style={{ color: MEDAL[r.rank] }} /> : null}#{r.rank}</td>
                <td><Link to={`/employees/${r.employee}`} className="fw-semibold text-decoration-none">{r.employee_name}</Link><div className="small text-muted">{r.job_title}</div></td>
                <td>{r.department_name || "—"}</td><td><RatingBadge value={r.avg_rating} /></td><td>{r.reviews_counted}</td>
                <td className="text-end"><Link className="btn btn-sm btn-outline-primary" to={`/employees/${r.employee}`}>View dashboard</Link></td>
              </tr>))}
            {!data.results.length && <tr><td colSpan="6" className="text-center text-muted p-4">No completed reviews match these filters.</td></tr>}
          </tbody></table></div></div>
      )}
    </>
  );
}
