import React, { useState, useEffect } from 'react';
import { budgetsApi } from '../api/budgets';
import type { Budget } from '../api/budgets';
import { projectsApi } from '../api/projects';
import type { Project } from '../api/projects';

const Budgets: React.FC = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    project_id: '',
    category: '',
    budgeted_amount: '',
    actual_amount: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [budgetsData, projectsData] = await Promise.all([
        budgetsApi.getAll(),
        projectsApi.getAll()
      ]);
      setBudgets(budgetsData);
      setProjects(projectsData);
    } catch (err) {
      setError('Failed to fetch data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const budgetData = {
        project_id: parseInt(formData.project_id),
        category: formData.category,
        budgeted_amount: parseFloat(formData.budgeted_amount),
        actual_amount: formData.actual_amount ? parseFloat(formData.actual_amount) : 0
      };

      await budgetsApi.create(budgetData);
      await fetchData();
      setShowForm(false);
      setFormData({
        project_id: '',
        category: '',
        budgeted_amount: '',
        actual_amount: ''
      });
    } catch (err) {
      setError('Failed to create budget');
      console.error('Error creating budget:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this budget item?')) {
      try {
        await budgetsApi.delete(id);
        await fetchData();
      } catch (err) {
        setError('Failed to delete budget');
        console.error('Error deleting budget:', err);
      }
    }
  };

  const getProjectName = (projectId: number) => {
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : 'Unknown Project';
  };

  const calculateVariance = (budgeted: number, actual: number) => {
    return budgeted - actual;
  };

  const getVarianceClass = (variance: number) => {
    if (variance > 0) return 'positive';
    if (variance < 0) return 'negative';
    return 'neutral';
  };

  if (loading) return <div className="page-content">Loading...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Budgets</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : 'New Budget Item'}
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ color: 'red', margin: '1rem 0' }}>
          {error}
        </div>
      )}

      {showForm && (
        <div className="project-form">
          <h2>Add New Budget Item</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="project_id">Project *</label>
              <select
                id="project_id"
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                required
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="category">Category *</label>
              <input
                type="text"
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Materials, Labor, Equipment"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="budgeted_amount">Budgeted Amount *</label>
                <input
                  type="number"
                  id="budgeted_amount"
                  step="0.01"
                  value={formData.budgeted_amount}
                  onChange={(e) => setFormData({ ...formData, budgeted_amount: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="actual_amount">Actual Amount</label>
                <input
                  type="number"
                  id="actual_amount"
                  step="0.01"
                  value={formData.actual_amount}
                  onChange={(e) => setFormData({ ...formData, actual_amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Add Budget Item
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="budgets-list">
        {budgets.length === 0 ? (
          <div className="empty-state">
            <p>No budget items found. Add your first budget item to get started!</p>
          </div>
        ) : (
          <div className="projects-grid">
            {budgets.map((budget) => {
              const variance = calculateVariance(budget.budgeted_amount, budget.actual_amount);
              return (
                <div key={budget.id} className="project-card">
                  <div className="project-header">
                    <h3>{budget.category}</h3>
                    <span className={`variance ${getVarianceClass(variance)}`}>
                      {variance >= 0 ? '+' : ''}${variance.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="project-details">
                    <div className="detail">
                      <strong>Project:</strong> {getProjectName(budget.project_id)}
                    </div>
                    <div className="detail">
                      <strong>Budgeted:</strong> ${budget.budgeted_amount.toLocaleString()}
                    </div>
                    <div className="detail">
                      <strong>Actual:</strong> ${budget.actual_amount.toLocaleString()}
                    </div>
                  </div>

                  <div className="project-actions">
                    <button className="btn btn-small btn-secondary">Edit</button>
                    <button 
                      className="btn btn-small btn-danger"
                      onClick={() => handleDelete(budget.id!)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Budgets;
