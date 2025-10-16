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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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
    if (!deletingDocument?.filename) return;
    
    try {
      setIsDeleting(true);
      console.log('Deleting document:', deletingDocument.filename);
      
      // Use the new API method
      await documentsApi.deleteByFilename(deletingDocument.filename);
      
      console.log('Document deleted successfully');
      setUploadedFiles(prev => prev.filter(d => d.filename !== deletingDocument.filename));
      if (selectedDocument?.filename === deletingDocument.filename) {
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

  const openDocument = async (doc: Document) => {
    // Check if filename is valid
    if (!doc.filename || doc.filename === 'Unknown' || doc.filename.trim() === '') {
      setError('Cannot open document with invalid filename');
      return;
    }
    
    try {
      // Fetch the full document content using the new API method
      const fullDocument = await documentsApi.getByFilename(doc.filename);
      setSelectedDocument(fullDocument);
    } catch (error) {
      console.error('Error fetching full document:', error);
      setError('Failed to load document content');
      // Fallback to the summary document
      setSelectedDocument(doc);
    }
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setIsSearching(true);
      const response = await fetch('http://localhost:8000/documents/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery, limit: 5 }),
      });
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const data = await response.json();
      setSearchResults(data.results);
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
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
            <p>Upload PDF documents to extract and analyze their content using AI. Documents are automatically chunked and stored for intelligent search.</p>
            
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
                    Processing & Chunking...
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

        {/* Add Search Section */}
        <div className="search-section">
          <div className="upload-card">
            <h2>🔍 Semantic Search</h2>
            <p>Search across all your uploaded documents using natural language queries.</p>
            
            <div className="search-area">
              <div className="search-input-group">
                <input
                  type="text"
                  placeholder="Ask questions about your documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="search-input"
                />
                <button 
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="btn btn-primary"
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="search-results">
                <h4>Search Results:</h4>
                {searchResults.map((result, index) => (
                  <div key={index} className="search-result-card">
                    <div className="result-header">
                      <strong>📄 {result.filename}</strong>
                    </div>
                    <div className="result-content">
                      {result.content.substring(0, 200)}...
                    </div>
                  </div>
                ))}
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
                <div key={`${doc.filename}-${index}`} className="document-card">
                  <div className="document-header">
                    <h4>📄 {doc.filename}</h4>
                    <span className="upload-time">
                      {formatDate(doc.uploaded_at)}
                    </span>
                  </div>
                  <div className="document-metadata">
                    <p><strong>Size:</strong> {formatFileSize(doc.file_size)}</p>
                    <p><strong>Pages:</strong> {doc.page_count || 'Unknown'}</p>
                    <p><strong>Chunks:</strong> {doc.chunk_count || 'Unknown'}</p>
                    <p><strong>Status:</strong> Stored as searchable chunks</p>
                  </div>
                  <div className="document-preview">
                    <p>{doc.content}</p>
                  </div>
                  <div className="document-actions">
                    <button 
                      className="btn btn-small btn-primary"
                      onClick={() => openDocument(doc)}
                      disabled={!doc.filename || doc.filename === 'Unknown'}
                    >
                      View Full Text
                    </button>
                    <button 
                      className="btn btn-small btn-danger"
                      onClick={() => handleDeleteDocument(doc)}
                      disabled={!doc.filename || doc.filename === 'Unknown'}
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
          <h3>AI-Powered Features</h3>
          <div className="features-grid">
            <div className="feature-card">
              <h4>🔍 Smart Search</h4>
              <p>Search through document content using natural language queries with semantic understanding.</p>
            </div>
            <div className="feature-card">
              <h4>📊 Chunk Analysis</h4>
              <p>Documents are intelligently chunked for better retrieval and analysis of specific information.</p>
            </div>
            <div className="feature-card">
              <h4>🤖 Vector Search</h4>
              <p>Advanced vector embeddings enable finding relevant content even when exact keywords don't match.</p>
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
                <p><strong>Chunks:</strong> {selectedDocument.chunk_count || 'Unknown'}</p>
                <p><strong>Storage:</strong> Vector database with semantic search</p>
              </div>
              <div className="document-content">
                {selectedDocument.content.includes('Document processed into') ? (
                  <div>
                    <p><em>This document has been processed and stored as searchable chunks in the vector database. Use the search feature above to query the document content.</em></p>
                    <div className="document-summary">
                      <h4>Processing Summary:</h4>
                      <p>{selectedDocument.content}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p><em>Full document text extracted from PDF. This content is also stored as searchable chunks for AI analysis.</em></p>
                    <textarea
                      value={selectedDocument.content}
                      readOnly
                      className="document-text"
                      rows={20}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="modal-actions">
              {!selectedDocument.content.includes('Document processed into') && (
                <button 
                  className="btn btn-secondary"
                  onClick={() => navigator.clipboard.writeText(selectedDocument.content)}
                >
                  Copy Full Text
                </button>
              )}
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
        message="Are you sure you want to delete this document? This will remove all associated chunks from the vector database. This action cannot be undone."
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
