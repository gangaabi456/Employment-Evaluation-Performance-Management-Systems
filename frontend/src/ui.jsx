import { useCallback, useEffect, useState } from "react";
import { api, errText } from "./api.js";

export function useFetch(fn, deps) {
  const [s, setS] = useState({ data: null, error: "", loading: true });
  const load = useCallback(() => {
    setS((x) => ({ ...x, loading: true, error: "" }));
    fn().then((data) => setS({ data, error: "", loading: false }))
      .catch((e) => setS({ data: null, error: errText(e), loading: false }));
  }, deps); // eslint-disable-line
  useEffect(load, [load]);
  return { ...s, reload: load };
}

export function useLookups() {
  const [d, setD] = useState({ periods: [], departments: [] });
  useEffect(() => {
    Promise.all([api("/review-periods/"), api("/departments/")])
      .then(([periods, departments]) => setD({ periods, departments })).catch(() => {});
  }, []);
  return d;
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");

export function RatingBadge({ value }) {
  if (value == null) return <span className="text-muted">—</span>;
  const v = Number(value);
  const c = v >= 4.5 ? "success" : v >= 3.5 ? "primary" : v >= 2.5 ? "warning" : "danger";
  return <span className={`badge text-bg-${c}`}><i className="bi bi-star-fill me-1" />{v.toFixed(2)}</span>;
}

const SC = { draft: "secondary", submitted: "info", completed: "success", not_started: "secondary", in_progress: "primary", active: "success", inactive: "secondary" };
export const StatusBadge = ({ value }) => (
  <span className={`badge text-bg-${SC[value] || "secondary"} text-capitalize`}>{String(value).replace("_", " ")}</span>
);

export function Kpi({ icon, label, value, sub, color = "#3d5afe" }) {
  return (
    <div className="col"><div className="card kpi h-100" style={{ borderLeftColor: color }}><div className="card-body py-3 d-flex justify-content-between align-items-center">
      <div><div className="text-muted small">{label}</div><div className="value">{value}</div>{sub && <div className="small text-muted">{sub}</div>}</div>
      <i className={`bi bi-${icon} icon`} style={{ color }} />
    </div></div></div>
  );
}

export const Loading = () => <div className="text-center p-5"><div className="spinner-border text-primary" /></div>;
export const ErrorBox = ({ error }) => (error ? <div className="alert alert-danger">{error}</div> : null);

export function Field({ label, error, children, cls = "col-md-6" }) {
  return <div className={cls}><label className="form-label small fw-semibold mb-1">{label}</label>{children}{error && <div className="invalid-feedback d-block">{error}</div>}</div>;
}

export function Pager({ page, count, size = 10, onPage }) {
  const pages = Math.max(1, Math.ceil(count / size));
  return (
    <div className="d-flex justify-content-between align-items-center mt-2 small">
      <span className="text-muted">{count} result{count === 1 ? "" : "s"}</span>
      <div className="btn-group btn-group-sm">
        <button className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
        <button className="btn btn-outline-secondary" disabled>{page} / {pages}</button>
        <button className="btn btn-outline-secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, size = "modal-lg" }) {
  return (
    <>
      <div className="modal d-block" tabIndex="-1" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className={`modal-dialog modal-dialog-scrollable ${size}`}><div className="modal-content">
          <div className="modal-header"><h5 className="modal-title">{title}</h5><button className="btn-close" onClick={onClose} /></div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-footer">{footer}</div>}
        </div></div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

export function PeriodSelect({ periods, value, onChange, blank = "Active period", allOption }) {
  return (
    <select className="form-select form-select-sm w-auto" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{blank}</option>
      {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      {allOption && <option value="all">All periods</option>}
    </select>
  );
}
