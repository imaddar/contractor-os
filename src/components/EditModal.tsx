import React from 'react';

interface EditModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  submitText?: string;
  isLoading?: boolean;
}

const EditModal: React.FC<EditModalProps> = ({
  isOpen,
  title,
  onClose,
  onSubmit,
  children,
  submitText = 'Save Changes',
  isLoading = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button onClick={onClose} className="modal-close">×</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            {children}
          </div>
          <div className="modal-actions">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : submitText}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditModal;
