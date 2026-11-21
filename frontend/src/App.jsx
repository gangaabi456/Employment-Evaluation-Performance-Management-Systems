import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import { Loading } from "./ui.jsx";
import Layout from "./Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Employees from "./pages/Employees.jsx";
import EmployeeDashboard from "./pages/EmployeeDashboard.jsx";
import BestPerformers from "./pages/BestPerformers.jsx";
import Reviews from "./pages/Reviews.jsx";
import Reports from "./pages/Reports.jsx";

const Guard = ({ roles, children }) => {
  const { user } = useAuth();
  return roles.includes(user.role) ? children : <Navigate to="/" replace />;
};
const staff = ["admin", "manager"];

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Routes><Route path="*" element={<Login />} /></Routes>;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to={user.role === "employee" ? "/my-dashboard" : "/dashboard"} replace />} />
        <Route path="login" element={<Navigate to="/" replace />} />
        <Route path="dashboard" element={<Guard roles={staff}><Dashboard /></Guard>} />
        <Route path="my-dashboard" element={<EmployeeDashboard mine />} />
        <Route path="employees" element={<Guard roles={staff}><Employees /></Guard>} />
        <Route path="employees/:id" element={<Guard roles={staff}><EmployeeDashboard /></Guard>} />
        <Route path="best-performers" element={<Guard roles={staff}><BestPerformers /></Guard>} />
        <Route path="reviews" element={<Guard roles={staff}><Reviews /></Guard>} />
        <Route path="reports" element={<Guard roles={staff}><Reports /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
