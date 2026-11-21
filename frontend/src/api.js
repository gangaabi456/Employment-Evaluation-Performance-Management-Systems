// All data access goes through the Django REST API. The browser never talks to MySQL.
const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/$/, "");
export const getToken = () => localStorage.getItem("token");

export async function api(path, { method = "GET", body, params, blob } = {}) {
  const qs = params
    ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null))
    : "";
  const headers = { "Content-Type": "application/json" };
  if (getToken()) headers.Authorization = `Token ${getToken()}`;
  let res;
  try {
    res = await fetch(BASE + path + qs, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw { status: 0, data: { detail: "Cannot reach the server. Is the backend running?" } };
  }
  if (res.status === 401 && getToken()) {
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("auth-expired"));
  }
  if (!res.ok) throw { status: res.status, data: await res.json().catch(() => ({})) };
  if (res.status === 204) return null;
  return blob ? res.blob() : res.json();
}

const flat = (v) => (Array.isArray(v) ? flat(v[0]) : typeof v === "object" && v ? flat(Object.values(v)[0]) : String(v));
export function errText(e) {
  const d = e?.data;
  if (!d) return "Something went wrong.";
  if (d.detail) return d.detail;
  const [k, v] = Object.entries(d)[0] || [];
  return k ? `${k.replace(/_/g, " ")}: ${flat(v)}` : "Something went wrong.";
}
// Maps DRF validation errors to {fieldName: message}
export function fieldErrors(e) {
  const out = {};
  const d = e?.data;
  if (d && typeof d === "object" && !d.detail) for (const [k, v] of Object.entries(d)) out[k] = flat(v);
  out._form = d?.detail || (d?.non_field_errors ? flat(d.non_field_errors) : "");
  return out;
}
