import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '../api/projects';
import { schedulesApi } from '../api/schedules';
import { budgetsApi } from '../api/budgets';
import { subcontractorsApi } from '../api/subcontractors';

interface DashboardStats {
  activeProjects: number;
  pendingTasks: number;
  totalBudget: number;
  activeSubcontractors: number;
  upcomingDeadlines: number;
}

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    pendingTasks: 0,
    totalBudget: 0,
    activeSubcontractors: 0,
    upcomingDeadlines: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [projects, schedules, budgets, subcontractors] = await Promise.all([
        projectsApi.getAll(),
        schedulesApi.getAll(),
        budgetsApi.getAll(),
        subcontractorsApi.getAll()
      ]);

      // Calculate active projects
      const activeProjects = projects.filter(p => p.status === 'active').length;

      // Calculate pending tasks
      const pendingTasks = schedules.filter(s => s.status === 'pending' || s.status === 'in-progress').length;

      // Calculate total budget across all projects
      const totalBudget = budgets.reduce((sum, budget) => sum + budget.budgeted_amount, 0);

      // Count active subcontractors (all subcontractors are considered active)
      const activeSubcontractors = subcontractors.length;

      // Calculate upcoming deadlines (tasks ending within next 7 days)
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const upcomingDeadlines = schedules.filter(schedule => {
        if (!schedule.end_date) return false;
        const endDate = new Date(schedule.end_date);
        const today = new Date();
        return endDate >= today && endDate <= nextWeek && schedule.status !== 'completed';
      }).length;

      setStats({
        activeProjects,
        pendingTasks,
        totalBudget,
        activeSubcontractors,
        upcomingDeadlines
      });
    } catch (err) {
      setError('Failed to fetch dashboard data');
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
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
        <h1>Dashboard</h1>
        <p className="dashboard-subtitle">Welcome to ContractorOS - Your construction management hub</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-icon">🏗️</div>
          <div className="card-content">
            <h3>Active Projects</h3>
            <div className="card-number">{stats.activeProjects}</div>
            <p className="card-description">Currently in progress</p>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">📋</div>
          <div className="card-content">
            <h3>Pending Tasks</h3>
            <div className="card-number">{stats.pendingTasks}</div>
            <p className="card-description">Tasks to be completed</p>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">💰</div>
          <div className="card-content">
            <h3>Total Budget</h3>
            <div className="card-number">{formatCurrency(stats.totalBudget)}</div>
            <p className="card-description">Across all projects</p>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">👥</div>
          <div className="card-content">
            <h3>Subcontractors</h3>
            <div className="card-number">{stats.activeSubcontractors}</div>
            <p className="card-description">Available for work</p>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">⚠️</div>
          <div className="card-content">
            <h3>Upcoming Deadlines</h3>
            <div className="card-number">{stats.upcomingDeadlines}</div>
            <p className="card-description">Due within 7 days</p>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">🧠</div>
          <div className="card-content">
            <h3>ConstructIQ</h3>
            <div className="card-number">AI</div>
            <p className="card-description">Smart insights ready</p>
          </div>
        </div>
      </div>

      <div className="dashboard-quick-actions">
        <h2>Quick Actions</h2>
        <div className="quick-actions-grid">
          <button className="quick-action-btn" onClick={() => navigate('/projects?action=new')}>
            <span className="action-icon">➕</span>
            <span className="action-text">New Project</span>
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/schedule?action=new')}>
            <span className="action-icon">📅</span>
            <span className="action-text">Schedule Task</span>
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/subcontractors?action=new')}>
            <span className="action-icon">👤</span>
            <span className="action-text">Add Subcontractor</span>
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/budgets?action=new')}>
            <span className="action-icon">💵</span>
            <span className="action-text">Manage Budget</span>
          </button>
        </div>
      </div>

      <div className="dashboard-recent">
        <h2>Getting Started</h2>
        <div className="getting-started-tips">
          <div className="tip-card">
            <h4>📊 Track Your Progress</h4>
            <p>Monitor project status, budgets, and deadlines all in one place.</p>
          </div>
          <div className="tip-card">
            <h4>📅 Stay Organized</h4>
            <p>Use the calendar view to visualize your project timeline and task dependencies.</p>
          </div>
          <div className="tip-card">
            <h4>🤝 Manage Your Team</h4>
            <p>Keep track of subcontractors and assign tasks efficiently.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
