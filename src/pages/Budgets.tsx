import React, { useState, useEffect } from 'react';
import { budgetsApi, type Budget } from '../api/budgets';
import { projectsApi, type Project } from '../api/projects';
import EditModal from '../components/EditModal';
import DeleteModal from '../components/DeleteModal';

const Budgets: React.FC = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const resetForm = () => {
    setFormData({
      project_id: '',
      category: '',
      budgeted_amount: '',
      actual_amount: ''
    });
    setEditingBudget(null);
    setShowEditModal(false);
  };

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setFormData({
      project_id: budget.project_id.toString(),
      category: budget.category,
      budgeted_amount: budget.budgeted_amount.toString(),
      actual_amount: budget.actual_amount.toString()
    });
    setShowEditModal(true);
  };

  const handleDelete = (budget: Budget) => {
    setDeletingBudget(budget);
    setShowDeleteModal(true);
    setError(null); // Clear any previous errors
  };

  const confirmDelete = async () => {
    if (!deletingBudget) return;
    
    try {
      setIsSubmitting(true);
      console.log('Deleting budget:', deletingBudget.id);
      await budgetsApi.delete(deletingBudget.id!);
      console.log('Budget deleted successfully');
      await fetchData(); // Refresh all data
      setShowDeleteModal(false);
      setDeletingBudget(null);
      setError(null);
    } catch (err: any) {
      console.error('Error deleting budget:', err);
      setError(err.message || 'Failed to delete budget');
      // Keep modal open to show error
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingBudget(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const budgetData = {
        project_id: parseInt(formData.project_id),
        category: formData.category,
        budgeted_amount: parseFloat(formData.budgeted_amount),
        actual_amount: formData.actual_amount ? parseFloat(formData.actual_amount) : 0
      };

      if (editingBudget) {
        await budgetsApi.update(editingBudget.id!, budgetData);
      } else {
        await budgetsApi.create(budgetData);
      }

      await fetchData();
      resetForm();
    } catch (err) {
      setError(editingBudget ? 'Failed to update budget' : 'Failed to create budget');
      console.error('Error saving budget:', err);
    } finally {
      setIsSubmitting(false);
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
          onClick={() => setShowEditModal(true)}
        >
          New Budget Item
        </button>
      </div>

      {error && !showDeleteModal && !showEditModal && (
        <div className="error-message" style={{ color: 'red', margin: '1rem 0' }}>
          {error}
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
                    <button 
                      className="btn btn-small btn-secondary"
                      onClick={() => handleEdit(budget)}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn btn-small btn-danger"
                      onClick={() => handleDelete(budget)}
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

      <EditModal
        isOpen={showEditModal}
        title={editingBudget ? 'Edit Budget Item' : 'Add Budget Item'}
        onClose={resetForm}
        onSubmit={handleSubmit}
        submitText={editingBudget ? 'Update Budget Item' : 'Add Budget Item'}
        isLoading={isSubmitting}
      >
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
      </EditModal>

      <DeleteModal
        isOpen={showDeleteModal}
        title="Delete Budget Item"
        message="Are you sure you want to delete this budget item?"
        itemName={`${deletingBudget?.category || ''} - ${getProjectName(deletingBudget?.project_id || 0)}`}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isLoading={isSubmitting}
        error={error}
      />
    </div>
  );
};

export default Budgets;
