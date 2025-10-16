import React, { useState, useEffect } from 'react';
import { documentsApi, type Document } from '../api/documents';
import DeleteModal from '../components/DeleteModal';

function ConstructIQ() {
  const [uploadedFiles, setUploadedFiles] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingDocument, setDeletingDocument] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const documents = await documentsApi.getAll();
      setUploadedFiles(documents);
    } catch (err) {
      setError('Failed to load documents');
      console.error('Error fetching documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const newDoc = await documentsApi.uploadAndParse(file);
      setUploadedFiles(prev => [newDoc, ...prev]);
    } catch (err) {
      setError('Failed to parse document. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleDeleteDocument = (doc: Document) => {
    setDeletingDocument(doc);
    setShowDeleteModal(true);
    setError(null); // Clear any previous errors
  };

  const confirmDelete = async () => {
    if (!deletingDocument?.id) return;
    
    try {
      setIsDeleting(true);
      console.log('Deleting document:', deletingDocument.id);
      await documentsApi.delete(deletingDocument.id);
      console.log('Document deleted successfully');
      setUploadedFiles(prev => prev.filter(d => d.id !== deletingDocument.id));
      if (selectedDocument?.id === deletingDocument.id) {
        setSelectedDocument(null);
      }
      setShowDeleteModal(false);
      setDeletingDocument(null);
      setError(null);
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.message || 'Failed to delete document');
      // Keep modal open to show error
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingDocument(null);
    setError(null);
  };

  const openDocument = (doc: Document) => {
    setSelectedDocument(doc);
  };

  const closeDocument = () => {
    setSelectedDocument(null);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h1>ConstructIQ</h1>
          <p className="dashboard-subtitle">AI-powered document processing and insights</p>
        </div>
        <div style={{ textAlign: 'center', padding: '2rem' }}>Loading documents...</div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>ConstructIQ</h1>
        <p className="dashboard-subtitle">AI-powered document processing and insights</p>
      </div>

      <div className="constructiq-container">
        <div className="upload-section">
          <div className="upload-card">
            <h2>📄 Document Parser</h2>
            <p>Upload PDF documents to extract and analyze their content using AI.</p>
            
            <div className="upload-area">
              <input
                type="file"
                id="file-upload"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={isUploading}
                style={{ display: 'none' }}
              />
              <label htmlFor="file-upload" className={`upload-button ${isUploading ? 'uploading' : ''}`}>
                {isUploading ? (
                  <>
                    <span className="upload-icon">⏳</span>
                    Processing...
                  </>
                ) : (
                  <>
                    <span className="upload-icon">📎</span>
                    Upload PDF Document
                  </>
                )}
              </label>
            </div>

            {error && !showDeleteModal && (
              <div className="error-message" style={{ marginTop: '1rem' }}>
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="documents-section">
          <h3>Processed Documents</h3>
          {uploadedFiles.length === 0 ? (
            <div className="empty-state">
              <p>No documents uploaded yet. Upload your first PDF to get started!</p>
            </div>
          ) : (
            <div className="documents-grid">
              {uploadedFiles.map((doc) => (
                <div key={doc.id} className="document-card">
                  <div className="document-header">
                    <h4>📄 {doc.filename}</h4>
                    <span className="upload-time">
                      {formatDate(doc.uploaded_at)}
                    </span>
                  </div>
                  <div className="document-metadata">
                    <p><strong>Size:</strong> {formatFileSize(doc.file_size)}</p>
                    <p><strong>Pages:</strong> {doc.page_count || 'Unknown'}</p>
                    <p><strong>Characters:</strong> {doc.content.length.toLocaleString()}</p>
                  </div>
                  <div className="document-preview">
                    <p>{doc.content.substring(0, 150)}...</p>
                  </div>
                  <div className="document-actions">
                    <button 
                      className="btn btn-small btn-primary"
                      onClick={() => openDocument(doc)}
                    >
                      View Full Text
                    </button>
                    <button 
                      className="btn btn-small btn-danger"
                      onClick={() => handleDeleteDocument(doc)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="features-section">
          <h3>Coming Soon</h3>
          <div className="features-grid">
            <div className="feature-card">
              <h4>🔍 Smart Analysis</h4>
              <p>Extract key information like costs, dates, and specifications automatically.</p>
            </div>
            <div className="feature-card">
              <h4>📊 Project Insights</h4>
              <p>Generate intelligent schedules and budget estimates from documents.</p>
            </div>
            <div className="feature-card">
              <h4>🤖 AI Assistant</h4>
              <p>Ask questions about your documents and get instant answers.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <div className="modal-overlay" onClick={closeDocument}>
          <div className="modal-content document-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📄 {selectedDocument.filename}</h3>
              <button onClick={closeDocument} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="document-metadata">
                <p><strong>Uploaded:</strong> {formatDate(selectedDocument.uploaded_at)}</p>
                <p><strong>Size:</strong> {formatFileSize(selectedDocument.file_size)}</p>
                <p><strong>Pages:</strong> {selectedDocument.page_count || 'Unknown'}</p>
                <p><strong>Characters:</strong> {selectedDocument.content.length.toLocaleString()}</p>
              </div>
              <div className="document-content">
                <textarea
                  value={selectedDocument.content}
                  readOnly
                  className="document-text"
                  rows={20}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => navigator.clipboard.writeText(selectedDocument.content)}
              >
                Copy Text
              </button>
              <button 
                className="btn btn-primary"
                onClick={closeDocument}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteModal
        isOpen={showDeleteModal}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        itemName={deletingDocument?.filename || ''}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isLoading={isDeleting}
        error={error}
      />
    </div>
  );
}

export default ConstructIQ;
