import React, { useState, useEffect } from 'react';
import { subcontractorsApi } from '../api/subcontractors';
import type { Subcontractor } from '../api/subcontractors';

const Subcontractors: React.FC = () => {
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    phone: '',
    specialty: ''
  });

  useEffect(() => {
    fetchSubcontractors();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const subcontractorData = {
        name: formData.name,
        contact_email: formData.contact_email || undefined,
        phone: formData.phone || undefined,
        specialty: formData.specialty || undefined
      };

      await subcontractorsApi.create(subcontractorData);
      await fetchSubcontractors();
      setShowForm(false);
      setFormData({ name: '', contact_email: '', phone: '', specialty: '' });
    } catch (err) {
      setError('Failed to create subcontractor');
      console.error('Error creating subcontractor:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this subcontractor?')) {
      try {
        await subcontractorsApi.delete(id);
        await fetchSubcontractors();
      } catch (err) {
        setError('Failed to delete subcontractor');
        console.error('Error deleting subcontractor:', err);
      }
    }
  };

  if (loading) return <div className="page-content">Loading...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Subcontractors</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : 'New Subcontractor'}
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ color: 'red', margin: '1rem 0' }}>
          {error}
        </div>
      )}

      {showForm && (
        <div className="project-form">
          <h2>Add New Subcontractor</h2>
          <form onSubmit={handleSubmit}>
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

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Add Subcontractor
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
                  <button className="btn btn-small btn-secondary">Edit</button>
                  <button 
                    className="btn btn-small btn-danger"
                    onClick={() => handleDelete(subcontractor.id!)}
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

export default Subcontractors;
