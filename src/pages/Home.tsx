import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { dashboardApi } from "../api/dashboard";
import { schedulesApi, type Schedule } from "../api/schedules";
import { projectsApi, type Project } from "../api/projects";
import { budgetsApi } from "../api/budgets";
import { Icon } from "../components/Icon";

interface DashboardStats {
  activeProjects: number;
  pendingTasks: number;
  totalBudget: number;
  activeSubcontractors: number;
  upcomingDeadlines: number;
}

interface ProjectWithHealth extends Project {
  budgetSpent: number;
  budgetTotal: number;
  taskCount: number;
}

interface HomeProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

const Home: React.FC<HomeProps> = ({ theme, onToggleTheme }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    pendingTasks: 0,
    totalBudget: 0,
    activeSubcontractors: 0,
    upcomingDeadlines: 0,
  });
  
  const [activeProjectsList, setActiveProjectsList] = useState<ProjectWithHealth[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all required data in parallel
      const [summary, allProjects, allSchedules, allBudgets] = await Promise.all([
        dashboardApi.getSummary(),
        projectsApi.getAll(),
        schedulesApi.getAll(),
        budgetsApi.getAll()
      ]);

      // 1. Process Project Health & Budget
      const projectsMap = new Map<number, ProjectWithHealth>();
      
      allProjects.forEach(p => {
        if (p.status === 'active' && p.id) {
            projectsMap.set(p.id, {
                ...p,
                budgetSpent: 0,
                budgetTotal: 0,
                taskCount: 0
            });
        }
      });

      // Sum up budgets per project
      allBudgets.forEach(b => {
        const project = projectsMap.get(b.project_id);
        if (project) {
            project.budgetTotal += b.budgeted_amount;
            project.budgetSpent += b.actual_amount;
        }
      });

      // Count pending tasks per project
      allSchedules.forEach(s => {
          const project = projectsMap.get(s.project_id);
          if (project && (s.status === 'pending' || s.status === 'in_progress')) {
              project.taskCount += 1;
          }
      });

      setActiveProjectsList(Array.from(projectsMap.values()));

      // 2. Process Upcoming Deadlines (Next 7 Days)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const upcoming = allSchedules.filter(task => {
        if (!task.end_date || task.status === 'completed' || task.status === 'proposed') return false;
        const endDate = new Date(task.end_date);
        return endDate >= today && endDate <= nextWeek;
      }).sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime());

      setUpcomingTasks(upcoming);

      // 3. Set Stats
      setStats({
        activeProjects: summary.projects.active,
        pendingTasks: summary.tasks.pending + summary.tasks.in_progress,
        totalBudget: summary.budgets.total_budgeted,
        activeSubcontractors: summary.subcontractors.total,
        upcomingDeadlines: upcoming.length,
      });

    } catch (err) {
      setError("Failed to fetch dashboard data");
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading-spinner">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="dashboard-header">
        <div className="dashboard-heading">
          <h1>Dashboard</h1>
          <p className="dashboard-subtitle">
            Overview of your active construction projects and tasks
          </p>
        </div>
        <div className="header-controls">
          <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            <span className="theme-toggle-icon">
              <Icon name={theme === "light" ? "moon" : "sun"} size={18} />
            </span>
            <span className="theme-toggle-label">
              {theme === "light" ? "Dark mode" : "Light mode"}
            </span>
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="dashboard-quick-actions-compact">
        <div className="quick-actions-compact-grid">
          <button className="quick-action-compact-btn" onClick={() => navigate("/projects?action=new")}>
            <span className="action-icon"><Icon name="plus" size={18} /></span>
            <span className="action-text">New Project</span>
          </button>
          <button className="quick-action-compact-btn" onClick={() => navigate("/schedule?action=new")}>
            <span className="action-icon"><Icon name="calendar" size={18} /></span>
            <span className="action-text">Add Task</span>
          </button>
          <button className="quick-action-compact-btn" onClick={() => navigate("/budgets?action=new")}>
            <span className="action-icon"><Icon name="budget" size={18} /></span>
            <span className="action-text">Add Budget</span>
          </button>
          <button className="quick-action-compact-btn" onClick={() => navigate("/constructiq")}>
            <span className="action-icon"><Icon name="ai" size={18} /></span>
            <span className="action-text">Ask AI</span>
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-icon">
            <Icon name="projects" size={22} />
          </div>
          <div className="card-content">
            <h3>Active Projects</h3>
            <div className="card-number">{stats.activeProjects}</div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">
            <Icon name="tasks" size={22} />
          </div>
          <div className="card-content">
            <h3>Pending Tasks</h3>
            <div className="card-number">{stats.pendingTasks}</div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">
            <Icon name="budget" size={22} />
          </div>
          <div className="card-content">
            <h3>Total Budget</h3>
            <div className="card-number">{formatCurrency(stats.totalBudget)}</div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">
            <Icon name="clock" size={22} />
          </div>
          <div className="card-content">
            <h3>Due Soon</h3>
            <div className="card-number">{stats.upcomingDeadlines}</div>
          </div>
        </div>
      </div>

      <div className="dashboard-content-wrapper">
        <div className="section-card">
          <div className="section-header">
            <h3>Active Projects Health</h3>
            <button className="btn btn-small btn-secondary" onClick={() => navigate('/projects')}>View All</button>
          </div>
          <div className="recent-projects-list">
            {activeProjectsList.length === 0 ? (
                <div className="empty-state-small">No active projects</div>
            ) : (
                activeProjectsList.slice(0, 5).map(project => {
                    const percentSpent = project.budgetTotal > 0 
                        ? Math.min(100, (project.budgetSpent / project.budgetTotal) * 100) 
                        : 0;
                    
                    return (
                        <div key={project.id} className="project-item-card" onClick={() => navigate(`/projects`)}>
                            <div className="project-item-header">
                                <h4>{project.name}</h4>
                                <span className="project-tasks-badge">{project.taskCount} tasks</span>
                            </div>
                            <div className="project-budget-bar">
                                <div className="budget-labels">
                                    <span>Budget Used</span>
                                    <span>{Math.round(percentSpent)}%</span>
                                </div>
                                <div className="progress-track">
                                    <div 
                                        className={`progress-fill ${percentSpent > 100 ? 'danger' : percentSpent > 85 ? 'warning' : ''}`} 
                                        style={{ width: `${percentSpent}%` }} 
                                    />
                                </div>
                                <div className="budget-values">
                                    <span>{formatCurrency(project.budgetSpent)}</span>
                                    <span>of {formatCurrency(project.budgetTotal)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="section-header">
            <h3>Upcoming Deadlines</h3>
            <button className="btn btn-small btn-secondary" onClick={() => navigate('/schedule')}>View Schedule</button>
          </div>
          <div className="upcoming-tasks-list">
            {upcomingTasks.length === 0 ? (
                <div className="empty-state-small">No tasks due in next 7 days</div>
            ) : (
                upcomingTasks.map(task => {
                    const isOverdue = new Date(task.end_date!) < new Date();
                    return (
                        <div key={task.id} className="task-item-card">
                           <div className="task-icon">
                               <Icon name={isOverdue ? 'warning' : 'clock'} size={16} className={isOverdue ? 'text-danger' : 'text-soft'} />
                           </div>
                           <div className="task-info">
                               <span className="task-name">{task.task_name}</span>
                               <span className="task-date">Due {new Date(task.end_date!).toLocaleDateString()}</span>
                           </div>
                        </div>
                    );
                })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
