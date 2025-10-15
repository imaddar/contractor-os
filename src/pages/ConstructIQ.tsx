import React, { useState } from 'react';

interface ParsedDocument {
  filename: string;
  content: string;
  uploadedAt: string;
}

function ConstructIQ() {
  const [uploadedFiles, setUploadedFiles] = useState<ParsedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ParsedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/parse-document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to parse document');
      }

      const result = await response.json();
      const newDoc: ParsedDocument = {
        filename: file.name,
        content: result.content,
        uploadedAt: new Date().toISOString(),
      };

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

  const openDocument = (doc: ParsedDocument) => {
    setSelectedDocument(doc);
  };

  const closeDocument = () => {
    setSelectedDocument(null);
  };

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

            {error && (
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
              {uploadedFiles.map((doc, index) => (
                <div key={index} className="document-card">
                  <div className="document-header">
                    <h4>📄 {doc.filename}</h4>
                    <span className="upload-time">
                      {new Date(doc.uploadedAt).toLocaleString()}
                    </span>
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
                <p><strong>Uploaded:</strong> {new Date(selectedDocument.uploadedAt).toLocaleString()}</p>
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
    </div>
  );
}

export default ConstructIQ;
