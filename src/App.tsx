import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import Home from "./pages/Home";
import Projects from "./pages/Projects";
import Schedule from "./pages/Schedule";
import Budgets from "./pages/Budgets";
import Subcontractors from "./pages/Subcontractors";
import ConstructIQ from "./pages/ConstructIQ";
import { Icon, type IconName } from "./components/Icon";
import GenerationStatusPanel from "./components/GenerationStatusPanel";
import { GenerationStatusProvider } from "./context/GenerationStatusContext";
import "./App.css";

type Theme = "dark" | "light";

function Navigation() {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Home", icon: "home" },
    { path: "/projects", label: "Projects", icon: "projects" },
    { path: "/schedule", label: "Schedule", icon: "calendar" },
    { path: "/budgets", label: "Budgets", icon: "budget" },
    { path: "/subcontractors", label: "Subcontractors", icon: "team" },
    { path: "/constructiq", label: "ConstructIQ", icon: "ai" },
  ] as Array<{ path: string; label: string; icon: IconName }>;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h2>Contractor-OS</h2>
      </div>
      <ul className="nav-links">
        {navItems.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              className={location.pathname === item.path ? "active" : ""}
            >
              <span className="nav-icon">
                <Icon name={item.icon} size={18} />
              </span>
              <span className="label">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    const stored = window.localStorage.getItem("contractor-os-theme");
    if (stored === "light" || stored === "dark") {
      return stored;
    }

    const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)");
    if (prefersLight?.matches) {
      return "light";
    }

    return "dark";
  });

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    document.body.classList.remove("light-theme", "dark-theme");
    document.body.classList.add(theme === "light" ? "light-theme" : "dark-theme");
    window.localStorage.setItem("contractor-os-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  };

  return (
    <GenerationStatusProvider>
      <Router>
        <div className="app">
          <Navigation />
          <div className="app-body">
            <main className="main-content">
              <Routes>
                <Route
                  path="/"
                  element={<Home onToggleTheme={toggleTheme} theme={theme} />}
                />
                <Route path="/projects" element={<Projects />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/budgets" element={<Budgets />} />
                <Route path="/subcontractors" element={<Subcontractors />} />
                <Route path="/constructiq" element={<ConstructIQ />} />
              </Routes>
            </main>
          </div>
          <GenerationStatusPanel />
        </div>
      </Router>
    </GenerationStatusProvider>
  );
}

export default App;
