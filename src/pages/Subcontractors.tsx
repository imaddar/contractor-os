import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { subcontractorsApi, type Subcontractor } from '../api/subcontractors';
import EditModal from '../components/EditModal';
import DeleteModal from '../components/DeleteModal';

const Subcontractors: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingSubcontractor, setEditingSubcontractor] = useState<Subcontractor | null>(null);
  const [deletingSubcontractor, setDeletingSubcontractor] = useState<Subcontractor | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    phone: '',
    specialty: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchSubcontractors();
  }, []);

  useEffect(() => {
    // Check if we should open the modal from URL parameter
    if (searchParams.get("action") === "new") {
      setShowEditModal(true);
      // Remove only the action param while preserving other query params
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("action");
      setSearchParams(nextParams);
    }
  }, [searchParams, setSearchParams]);

  const fetchSubcontractors = async () => {
    try {
      setLoading(true);
      const data = await subcontractorsApi.getAll();
      setSubcontractors(data);
    } catch (err) {
      setError('Failed to fetch subcontractors');
      console.error('Error fetching subcontractors:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (subcontractor: Subcontractor) => {
    setEditingSubcontractor(subcontractor);
    setFormData({
      name: subcontractor.name,
      contact_email: subcontractor.contact_email || '',
      phone: subcontractor.phone || '',
      specialty: subcontractor.specialty || ''
    });
    setShowEditModal(true);
  };

  const handleDelete = (subcontractor: Subcontractor) => {
    setDeletingSubcontractor(subcontractor);
    setShowDeleteModal(true);
    setError(null); // Clear any previous errors
  };

  const confirmDelete = async () => {
    if (!deletingSubcontractor) return;
    
    try {
      setIsSubmitting(true);
      console.log('Deleting subcontractor:', deletingSubcontractor.id);
      await subcontractorsApi.delete(deletingSubcontractor.id!);
      console.log('Subcontractor deleted successfully');
      await fetchSubcontractors();
      setShowDeleteModal(false);
      setDeletingSubcontractor(null);
      setError(null);
    } catch (err: unknown) {
      console.error('Error deleting subcontractor:', err);
      const message =
        err instanceof Error ? err.message : 'Failed to delete subcontractor';
      setError(message);
      // Keep modal open to show error
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingSubcontractor(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const subcontractorData = {
        name: formData.name,
        contact_email: formData.contact_email || undefined,
        phone: formData.phone || undefined,
        specialty: formData.specialty || undefined
      };

      if (editingSubcontractor) {
        await subcontractorsApi.update(editingSubcontractor.id!, subcontractorData);
      } else {
        await subcontractorsApi.create(subcontractorData);
      }

      await fetchSubcontractors();
      resetForm();
    } catch (err) {
      setError(editingSubcontractor ? 'Failed to update subcontractor' : 'Failed to create subcontractor');
      console.error('Error saving subcontractor:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', contact_email: '', phone: '', specialty: '' });
    setEditingSubcontractor(null);
    setShowEditModal(false);
  };

  if (loading) return <div className="page-content">Loading...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Subcontractors</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowEditModal(true)}
        >
          New Subcontractor
        </button>
      </div>

      {error && !showDeleteModal && !showEditModal && (
        <div className="error-message" style={{ color: 'red', margin: '1rem 0' }}>
          {error}
        </div>
      )}

      <div className="subcontractors-list">
        {subcontractors.length === 0 ? (
          <div className="empty-state">
            <p>No subcontractors found. Add your first subcontractor to get started!</p>
          </div>
        ) : (
          <div className="projects-grid">
            {subcontractors.map((subcontractor) => (
              <div key={subcontractor.id} className="project-card">
                <div className="project-header">
                  <h3>{subcontractor.name}</h3>
                  {subcontractor.specialty && (
                    <span className="status active">{subcontractor.specialty}</span>
                  )}
                </div>
                
                <div className="project-details">
                  {subcontractor.contact_email && (
                    <div className="detail">
                      <strong>Email:</strong> {subcontractor.contact_email}
                    </div>
                  )}
                  {subcontractor.phone && (
                    <div className="detail">
                      <strong>Phone:</strong> {subcontractor.phone}
                    </div>
                  )}
                </div>

                <div className="project-actions">
                  <button 
                    className="btn btn-small btn-secondary"
                    onClick={() => handleEdit(subcontractor)}
                  >
                    Edit
                  </button>
                  <button 
                    className="btn btn-small btn-danger"
                    onClick={() => handleDelete(subcontractor)}
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
        title={editingSubcontractor ? 'Edit Subcontractor' : 'Add Subcontractor'}
        onClose={resetForm}
        onSubmit={handleSubmit}
        submitText={editingSubcontractor ? 'Update Subcontractor' : 'Add Subcontractor'}
        isLoading={isSubmitting}
      >
        <div className="form-group">
          <label htmlFor="name">Name *</label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="contact_email">Email</label>
          <input
            type="email"
            id="contact_email"
            value={formData.contact_email}
            onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="phone">Phone</label>
          <input
            type="tel"
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="specialty">Specialty</label>
          <input
            type="text"
            id="specialty"
            value={formData.specialty}
            onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
            placeholder="e.g., Plumbing, Electrical, Carpentry"
          />
        </div>
      </EditModal>

      <DeleteModal
        isOpen={showDeleteModal}
        title="Delete Subcontractor"
        message="Are you sure you want to delete this subcontractor? They will be unassigned from any scheduled tasks."
        itemName={deletingSubcontractor?.name || ''}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isLoading={isSubmitting}
        error={error}
      />
    </div>
  );
};

export default Subcontractors;
