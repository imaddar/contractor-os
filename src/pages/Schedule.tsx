import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { schedulesApi, type Schedule } from '../api/schedules';
import { projectsApi, type Project } from '../api/projects';
import { subcontractorsApi, type Subcontractor } from '../api/subcontractors';
import Calendar from '../components/Calendar';
import EditModal from '../components/EditModal';
import DeleteModal from '../components/DeleteModal';

const SchedulePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState({
    project_id: '',
    task_name: '',
    start_date: '',
    end_date: '',
    assigned_to: '',
    status: 'pending'
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Check if we should open the modal from URL parameter
    if (searchParams.get('action') === 'new') {
      setShowEditModal(true);
      // Clear the URL parameter
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

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

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      project_id: schedule.project_id.toString(),
      task_name: schedule.task_name,
      start_date: schedule.start_date || '',
      end_date: schedule.end_date || '',
      assigned_to: schedule.assigned_to ? schedule.assigned_to.toString() : '',
      status: schedule.status
    });
    setShowEditModal(true);
    setSelectedSchedule(null);
  };

  const handleDelete = (schedule: Schedule) => {
    setDeletingSchedule(schedule);
    setShowDeleteModal(true);
    setSelectedSchedule(null);
    setError(null); // Clear any previous errors
  };

  const confirmDelete = async () => {
    if (!deletingSchedule) return;
    
    try {
      setIsSubmitting(true);
      console.log('Deleting schedule:', deletingSchedule.id);
      await schedulesApi.delete(deletingSchedule.id!);
      console.log('Schedule deleted successfully');
      await fetchData(); // Refresh all data
      setShowDeleteModal(false);
      setDeletingSchedule(null);
      setError(null);
    } catch (err: any) {
      console.error('Error deleting schedule:', err);
      setError(err.message || 'Failed to delete schedule');
      // Keep modal open to show error
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingSchedule(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const scheduleData = {
        project_id: parseInt(formData.project_id),
        task_name: formData.task_name,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : undefined,
        status: formData.status
      };

      if (editingSchedule) {
        await schedulesApi.update(editingSchedule.id!, scheduleData);
      } else {
        await schedulesApi.create(scheduleData);
      }

      await fetchData();
      resetForm();
    } catch (err) {
      setError(editingSchedule ? 'Failed to update schedule' : 'Failed to create schedule');
      console.error('Error saving schedule:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      project_id: '',
      task_name: '',
      start_date: '',
      end_date: '',
      assigned_to: '',
      status: 'pending'
    });
    setEditingSchedule(null);
    setShowForm(false);
    setShowEditModal(false);
  };

  const getProjectName = (projectId: number) => {
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : 'Unknown Project';
  };

  const getSubcontractorName = (subcontractorId: number) => {
    const subcontractor = subcontractors.find(s => s.id === subcontractorId);
    return subcontractor ? subcontractor.name : 'Unassigned';
  };

  const handleEventClick = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
  };

  const handleDateClick = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, start_date: dateString }));
    setShowForm(true);
  };

  const closeModal = () => {
    setSelectedSchedule(null);
  };

  if (loading) return <div className="page-content">Loading...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Schedule</h1>
        <div className="header-controls">
          <div className="view-toggle">
            <button 
              className={`toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              📅 Calendar
            </button>
            <button 
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              📋 List
            </button>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => setShowEditModal(true)}
          >
            New Task
          </button>
        </div>
      </div>

      {error && !showDeleteModal && !showEditModal && (
        <div className="error-message">
          {error}
        </div>
      )}

      {viewMode === 'calendar' ? (
        <Calendar 
          schedules={schedules}
          projects={projects}
          onDateClick={handleDateClick}
          onEventClick={handleEventClick}
        />
      ) : (
        viewMode === 'list' && (
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
                      <button 
                        className="btn btn-small btn-secondary"
                        onClick={() => handleEdit(schedule)}
                      >
                        Edit
                      </button>
                      <button 
                        className="btn btn-small btn-danger"
                        onClick={() => handleDelete(schedule)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {selectedSchedule && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedSchedule.task_name}</h3>
              <button onClick={closeModal} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="detail">
                <strong>Project:</strong> {getProjectName(selectedSchedule.project_id)}
              </div>
              <div className="detail">
                <strong>Status:</strong> 
                <span className={`status ${selectedSchedule.status}`}>
                  {selectedSchedule.status}
                </span>
              </div>
              {selectedSchedule.start_date && (
                <div className="detail">
                  <strong>Start Date:</strong> {selectedSchedule.start_date ? new Date(selectedSchedule.start_date).toLocaleDateString() : ''}
                </div>
              )}
              {selectedSchedule.end_date && (
                <div className="detail">
                  <strong>End Date:</strong> {new Date(selectedSchedule.end_date).toLocaleDateString()}
                </div>
              )}
              {selectedSchedule.assigned_to && (
                <div className="detail">
                  <strong>Assigned to:</strong> {getSubcontractorName(selectedSchedule.assigned_to)}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => handleEdit(selectedSchedule)}
              >
                Edit
              </button>
              <button 
                className="btn btn-danger"
                onClick={() => handleDelete(selectedSchedule)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <EditModal
        isOpen={showEditModal}
        title={editingSchedule ? 'Edit Schedule Task' : 'Add Schedule Task'}
        onClose={resetForm}
        onSubmit={handleSubmit}
        submitText={editingSchedule ? 'Update Task' : 'Add Task'}
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
      </EditModal>

      <DeleteModal
        isOpen={showDeleteModal}
        title="Delete Schedule Task"
        message="Are you sure you want to delete this scheduled task?"
        itemName={deletingSchedule?.task_name || ''}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isLoading={isSubmitting}
        error={error}
      />
    </div>
  );
};

export default SchedulePage;
