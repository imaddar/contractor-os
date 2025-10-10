import React, { useState, useEffect } from 'react';
import { schedulesApi } from '../api/schedules';
import type { Schedule } from '../api/schedules';
import { projectsApi } from '../api/projects';
import type { Project } from '../api/projects';
import { subcontractorsApi } from '../api/subcontractors';
import type { Subcontractor } from '../api/subcontractors';

const SchedulePage: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    project_id: '',
    task_name: '',
    start_date: '',
    end_date: '',
    assigned_to: '',
    status: 'pending'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [schedulesData, projectsData, subcontractorsData] = await Promise.all([
        schedulesApi.getAll(),
        projectsApi.getAll(),
        subcontractorsApi.getAll()
      ]);
      setSchedules(schedulesData);
      setProjects(projectsData);
      setSubcontractors(subcontractorsData);
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
      const scheduleData = {
        project_id: parseInt(formData.project_id),
        task_name: formData.task_name,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : undefined,
        status: formData.status
      };

      await schedulesApi.create(scheduleData);
      await fetchData();
      setShowForm(false);
      setFormData({
        project_id: '',
        task_name: '',
        start_date: '',
        end_date: '',
        assigned_to: '',
        status: 'pending'
      });
    } catch (err) {
      setError('Failed to create schedule');
      console.error('Error creating schedule:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this schedule item?')) {
      try {
        await schedulesApi.delete(id);
        await fetchData();
      } catch (err) {
        setError('Failed to delete schedule');
        console.error('Error deleting schedule:', err);
      }
    }
  };

  const getProjectName = (projectId: number) => {
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : 'Unknown Project';
  };

  const getSubcontractorName = (subcontractorId: number) => {
    const subcontractor = subcontractors.find(s => s.id === subcontractorId);
    return subcontractor ? subcontractor.name : 'Unassigned';
  };

  if (loading) return <div className="page-content">Loading...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Schedule</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : 'New Task'}
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ color: 'red', margin: '1rem 0' }}>
          {error}
        </div>
      )}

      {showForm && (
        <div className="project-form">
          <h2>Add New Schedule Task</h2>
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
              <label htmlFor="task_name">Task Name *</label>
              <input
                type="text"
                id="task_name"
                value={formData.task_name}
                onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
                required
              />
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

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="assigned_to">Assigned To</label>
                <select
                  id="assigned_to"
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {subcontractors.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="delayed">Delayed</option>
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Add Task
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

      <div className="schedule-list">
        {schedules.length === 0 ? (
          <div className="empty-state">
            <p>No scheduled tasks found. Add your first task to get started!</p>
          </div>
        ) : (
          <div className="projects-grid">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="project-card">
                <div className="project-header">
                  <h3>{schedule.task_name}</h3>
                  <span className={`status ${schedule.status}`}>
                    {schedule.status}
                  </span>
                </div>
                
                <div className="project-details">
                  <div className="detail">
                    <strong>Project:</strong> {getProjectName(schedule.project_id)}
                  </div>
                  {schedule.start_date && (
                    <div className="detail">
                      <strong>Start:</strong> {new Date(schedule.start_date).toLocaleDateString()}
                    </div>
                  )}
                  {schedule.end_date && (
                    <div className="detail">
                      <strong>End:</strong> {new Date(schedule.end_date).toLocaleDateString()}
                    </div>
                  )}
                  {schedule.assigned_to && (
                    <div className="detail">
                      <strong>Assigned to:</strong> {getSubcontractorName(schedule.assigned_to)}
                    </div>
                  )}
                </div>

                <div className="project-actions">
                  <button className="btn btn-small btn-secondary">Edit</button>
                  <button 
                    className="btn btn-small btn-danger"
                    onClick={() => handleDelete(schedule.id!)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulePage;
