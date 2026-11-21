import { Chart, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend, Filler } from "chart.js";
Chart.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend, Filler);
export { Bar, Doughnut, Line } from "react-chartjs-2";
export const COLORS = ["#e63946", "#f4a261", "#e9c46a", "#3d5afe", "#2a9d8f"];
export const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };
