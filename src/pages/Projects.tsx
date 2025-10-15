import React, { useState, useEffect } from 'react';
import { projectsApi, type Project } from '../api/projects';
import EditModal from '../components/EditModal';
import DeleteModal from '../components/DeleteModal';

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    start_date: '',
    end_date: '',
    budget: ''
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await projectsApi.getAll();
      setProjects(data);
    } catch (err) {
      setError('Failed to fetch projects');
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      status: project.status,
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      budget: project.budget ? project.budget.toString() : ''
    });
    setShowEditModal(true);
  };

  const handleDelete = (project: Project) => {
    setDeletingProject(project);
    setShowDeleteModal(true);
    setError(null); // Clear any previous errors
  };

  const confirmDelete = async () => {
    if (!deletingProject) return;
    
    try {
      setIsSubmitting(true);
      console.log('Deleting project:', deletingProject.id);
      await projectsApi.delete(deletingProject.id!);
      console.log('Project deleted successfully');
      await fetchProjects();
      setShowDeleteModal(false);
      setDeletingProject(null);
      setError(null);
    } catch (err: any) {
      console.error('Error deleting project:', err);
      setError(err.message || 'Failed to delete project');
      // Keep modal open to show error
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingProject(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const projectData = {
        name: formData.name,
        description: formData.description || undefined,
        status: formData.status,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        budget: formData.budget ? parseFloat(formData.budget) : undefined
      };

      if (editingProject) {
        await projectsApi.update(editingProject.id!, projectData);
      } else {
        await projectsApi.create(projectData);
      }

      await fetchProjects();
      resetForm();
    } catch (err) {
      setError(editingProject ? 'Failed to update project' : 'Failed to create project');
      console.error('Error saving project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      status: 'active',
      start_date: '',
      end_date: '',
      budget: ''
    });
    setEditingProject(null);
    setShowEditModal(false);
  };

  if (loading) return <div className="page-content">Loading...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Projects</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowEditModal(true)}
        >
          New Project
        </button>
      </div>

      {error && !showDeleteModal && !showEditModal && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="projects-list">
        {projects.length === 0 ? (
          <div className="empty-state">
            <p>No projects found. Create your first project to get started!</p>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((project) => (
              <div key={project.id} className="project-card">
                <div className="project-header">
                  <h3>{project.name}</h3>
                  <span className={`status ${project.status}`}>
                    {project.status}
                  </span>
                </div>
                
                {project.description && (
                  <p className="project-description">{project.description}</p>
                )}
                
                <div className="project-details">
                  {project.start_date && (
                    <div className="detail">
                      <strong>Start:</strong> {new Date(project.start_date).toLocaleDateString()}
                    </div>
                  )}
                  {project.end_date && (
                    <div className="detail">
                      <strong>End:</strong> {new Date(project.end_date).toLocaleDateString()}
                    </div>
                  )}
                  {project.budget && (
                    <div className="detail">
                      <strong>Budget:</strong> ${project.budget.toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="project-actions">
                  <button 
                    className="btn btn-small btn-secondary"
                    onClick={() => handleEdit(project)}
                  >
                    Edit
                  </button>
                  <button 
                    className="btn btn-small btn-danger"
                    onClick={() => handleDelete(project)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EditModal
        isOpen={showEditModal}
        title={editingProject ? 'Edit Project' : 'Create Project'}
        onClose={resetForm}
        onSubmit={handleSubmit}
        submitText={editingProject ? 'Update Project' : 'Create Project'}
        isLoading={isSubmitting}
      >
        <div className="form-group">
          <label htmlFor="name">Project Name *</label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="active">Active</option>
            <option value="planning">Planning</option>
            <option value="completed">Completed</option>
            <option value="on-hold">On Hold</option>
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="start_date">Start Date</label>
            <input
              type="date"
              id="start_date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="end_date">End Date</label>
            <input
              type="date"
              id="end_date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="budget">Budget</label>
          <input
            type="number"
            id="budget"
            step="0.01"
            value={formData.budget}
            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
            placeholder="0.00"
          />
        </div>
      </EditModal>

      <DeleteModal
        isOpen={showDeleteModal}
        title="Delete Project"
        message="Are you sure you want to delete this project? This will also delete all associated schedules and budgets."
        itemName={deletingProject?.name || ''}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isLoading={isSubmitting}
        error={error}
      />
    </div>
  );
};

export default Projects;
