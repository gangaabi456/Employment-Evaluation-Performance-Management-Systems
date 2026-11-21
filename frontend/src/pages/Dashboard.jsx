import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Bar, Doughnut, COLORS, opts } from "../charts.js";
import { ErrorBox, Kpi, Loading, PeriodSelect, RatingBadge, StatusBadge, useFetch, useLookups } from "../ui.jsx";

export default function Dashboard() {
  const { periods } = useLookups();
  const [period, setPeriod] = useState("");
  const { data: d, loading, error } = useFetch(() => api("/dashboard/company/", { params: { period } }), [period]);

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div><h1 className="h4 mb-0">Company Dashboard</h1><small className="text-muted">{d?.period ? `Review period: ${d.period.name}` : "All periods"}</small></div>
        <PeriodSelect periods={periods} value={period} onChange={setPeriod} allOption />
      </div>
      <ErrorBox error={error} />
      {loading && !d ? <Loading /> : d && (
        <>
          <div className="row row-cols-2 row-cols-lg-4 g-3 mb-3">
            <Kpi icon="people" label="Total employees" value={d.total_employees} sub="active" />
            <Kpi icon="star" label="Average rating" value={d.average_rating ?? "—"} sub="completed reviews, out of 5" color="#f4a261" />
            <Kpi icon="check2-circle" label="Review completion" value={`${d.review_completion}%`} sub={`${d.completed_reviews} of ${d.total_reviews} reviews`} color="#2a9d8f" />
            <Kpi icon="hourglass-split" label="Reviews due" value={d.reviews_due} sub={`${d.reviews_overdue} overdue`} color="#e63946" />
          </div>
          <div className="row g-3 mb-3">
            <div className="col-lg-7"><div className="card h-100"><div className="card-body"><h2 className="h6">Rating distribution</h2>
              <div className="chart-box"><Bar options={opts} data={{ labels: d.rating_distribution.map((r) => r.label), datasets: [{ data: d.rating_distribution.map((r) => r.count), backgroundColor: COLORS }] }} /></div></div></div></div>
            <div className="col-lg-5"><div className="card h-100"><div className="card-body"><h2 className="h6">Review status</h2>
              <div className="chart-box"><Doughnut options={{ ...opts, plugins: { legend: { display: true, position: "bottom" } } }} data={{ labels: ["Draft", "Submitted", "Completed"], datasets: [{ data: Object.values(d.status_breakdown), backgroundColor: ["#adb5bd", "#0dcaf0", "#2a9d8f"] }] }} /></div></div></div></div>
          </div>
          <div className="row g-3">
            <div className="col-lg-6"><div className="card h-100"><div className="card-body"><h2 className="h6">Department summary</h2>
              <div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>Department</th><th>Staff</th><th>Avg</th><th style={{ minWidth: 110 }}>Completion</th></tr></thead><tbody>
                {d.departments.map((x) => { const pct = x.reviews ? Math.round((x.completed * 100) / x.reviews) : 0; return (
                  <tr key={x.id}><td>{x.name}</td><td>{x.headcount}</td><td><RatingBadge value={x.avg_rating} /></td>
                    <td><div className="progress" style={{ height: 8 }}><div className="progress-bar bg-success" style={{ width: `${pct}%` }} /></div><small className="text-muted">{pct}%</small></td></tr>); })}
                {!d.departments.length && <tr><td colSpan="4" className="text-muted">No data.</td></tr>}
              </tbody></table></div></div></div></div>
            <div className="col-lg-6"><div className="card h-100"><div className="card-body"><h2 className="h6">Recent reviews</h2>
              <div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>Employee</th><th>Period</th><th>Rating</th><th>Status</th></tr></thead><tbody>
                {d.recent_reviews.map((r) => (<tr key={r.id}><td><Link to={`/employees/${r.employee}`}>{r.employee_name}</Link></td><td>{r.period_name}</td><td><RatingBadge value={r.rating} /></td><td><StatusBadge value={r.status} /></td></tr>))}
                {!d.recent_reviews.length && <tr><td colSpan="4" className="text-muted">No reviews yet.</td></tr>}
              </tbody></table></div></div></div></div>
          </div>
        </>
      )}
    </>
  );
}
