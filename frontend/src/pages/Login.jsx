import { useState } from "react";
import { useAuth } from "../auth.jsx";
import { errText } from "../api.js";

export default function Login() {
  const { login } = useAuth();
  const [f, setF] = useState({ username: "", password: "" });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!f.username.trim()) v.username = "Please enter your username.";
    if (!f.password) v.password = "Please enter your password.";
    setErr(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try { await login(f.username.trim(), f.password); }
    catch (ex) { setErr({ form: errText(ex) }); setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <form className="card p-4 w-100" style={{ maxWidth: 400 }} onSubmit={submit} noValidate>
        <div className="text-center mb-3"><i className="bi bi-graph-up-arrow fs-1 text-primary" /><h1 className="h5 mt-2">Employee Performance Evaluation</h1><p className="text-muted small mb-0">Sign in to continue</p></div>
        {err.form && <div className="alert alert-danger py-2">{err.form}</div>}
        <div className="mb-3"><label className="form-label">Username</label>
          <input className={`form-control ${err.username ? "is-invalid" : ""}`} value={f.username} autoFocus onChange={(e) => setF({ ...f, username: e.target.value })} />
          <div className="invalid-feedback">{err.username}</div></div>
        <div className="mb-3"><label className="form-label">Password</label>
          <input type="password" className={`form-control ${err.password ? "is-invalid" : ""}`} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <div className="invalid-feedback">{err.password}</div></div>
        <button className="btn btn-primary w-100" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
