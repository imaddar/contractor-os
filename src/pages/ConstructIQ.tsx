import React, { useState, useEffect } from 'react';
import { documentsApi, type Document } from '../api/documents';
import DeleteModal from '../components/DeleteModal';

interface ChatConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  message_type: 'user' | 'ai';
  content: string;
  created_at: string;
  index_order: number;
}

function ConstructIQ() {
  const [uploadedFiles, setUploadedFiles] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingDocument, setDeletingDocument] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Updated chat-related state
  const [chatMessages, setChatMessages] = useState<Array<{
    type: 'user' | 'ai';
    content: string;
    timestamp: string;
  }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // New conversation management state
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  useEffect(() => {
    fetchDocuments();
    fetchConversations();
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

  const fetchConversations = async () => {
    try {
      setIsLoadingConversations(true);
      const response = await fetch('http://localhost:8000/chat/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setIsLoadingConversations(false);
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

  const createNewConversation = async () => {
    try {
      const title = `Chat ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
      const response = await fetch('http://localhost:8000/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      
      if (response.ok) {
        const newConversation = await response.json();
        setConversations(prev => [newConversation, ...prev]);
        setCurrentConversationId(newConversation.id);
        setChatMessages([{
          type: 'ai',
          content: 'Hello! I\'m ConstructIQ, your AI assistant for construction project management. How can I help you today?',
          timestamp: new Date().toISOString()
        }]);
        return newConversation.id;
      }
    } catch (err) {
      console.error('Error creating conversation:', err);
    }
    return null;
  };

  const loadConversation = async (conversationId: string) => {
    try {
      setCurrentConversationId(conversationId);
      const response = await fetch(`http://localhost:8000/chat/conversations/${conversationId}/messages`);
      if (response.ok) {
        const messages = await response.json();
        setChatMessages(messages.map((msg: ChatMessage) => ({
          type: msg.message_type,
          content: msg.content,
          timestamp: msg.created_at
        })));
      }
    } catch (err) {
      console.error('Error loading conversation:', err);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/chat/conversations/${conversationId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== conversationId));
        if (currentConversationId === conversationId) {
          setCurrentConversationId(null);
          setChatMessages([]);
        }
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    let conversationId = currentConversationId;
    
    // Create new conversation if none exists
    if (!conversationId) {
      conversationId = await createNewConversation();
      if (!conversationId) {
        setError('Failed to create conversation');
        return;
      }
    }
    
    const userMessage = {
      type: 'user' as const,
      content: chatInput.trim(),
      timestamp: new Date().toISOString()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8000/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversation_id: conversationId
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      const data = await response.json();
      
      // Add AI response to chat
      if (data.ai_response) {
        setChatMessages(prev => [...prev, {
          type: 'ai',
          content: data.ai_response,
          timestamp: data.timestamp
        }]);
      }
      
      // Refresh conversations to update the timestamp
      fetchConversations();
      
    } catch (err) {
      console.error('Chat error:', err);
      setError('Failed to send message. Please try again.');
      setChatMessages(prev => [...prev, {
        type: 'ai',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const clearChatHistory = async () => {
    try {
      // If there's no active conversation, just reset the messages locally
      if (!currentConversationId) {
        setChatMessages([{
          type: 'ai',
          content: 'Hello! I\'m ConstructIQ, your AI assistant for construction project management. How can I help you today?',
          timestamp: new Date().toISOString()
        }]);
        return;
      }

      // Attempt to clear messages for the current conversation (API endpoint may vary)
      const response = await fetch(`http://localhost:8000/chat/conversations/${currentConversationId}/messages`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setChatMessages([{
          type: 'ai',
          content: 'Hello! I\'m ConstructIQ, your AI assistant for construction project management. How can I help you today?',
          timestamp: new Date().toISOString()
        }]);
      } else {
        console.error('Failed to clear chat history:', await response.text());
      }
    } catch (err) {
      console.error('Error clearing chat:', err);
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
        <p className="dashboard-subtitle">AI-powered document processing and construction intelligence</p>
      </div>

      <div className="constructiq-container">
        {/* AI Chat Section with History Sidebar */}
        <div className="chat-section">
          <div className="upload-card">
            <div className="chat-header">
              <h2>🧠 ConstructIQ AI Assistant</h2>
              <div className="chat-controls">
                <button 
                  onClick={() => setShowChatHistory(!showChatHistory)}
                  className="btn btn-small btn-secondary"
                >
                  {showChatHistory ? 'Hide' : 'Show'} History
                </button>
                <button 
                  onClick={createNewConversation}
                  className="btn btn-small btn-primary"
                >
                  New Chat
                </button>
              </div>
            </div>
            
            <div className="chat-layout">
              {/* Chat History Sidebar */}
              {showChatHistory && (
                <div className="chat-history-sidebar">
                  <h4>Chat History</h4>
                  {isLoadingConversations ? (
                    <div>Loading conversations...</div>
                  ) : conversations.length === 0 ? (
                    <div className="empty-history">No conversations yet</div>
                  ) : (
                    <div className="conversation-list">
                      {conversations.map(conversation => (
                        <div 
                          key={conversation.id} 
                          className={`conversation-item ${currentConversationId === conversation.id ? 'active' : ''}`}
                        >
                          <div 
                            className="conversation-title"
                            onClick={() => loadConversation(conversation.id)}
                          >
                            {conversation.title}
                          </div>
                          <div className="conversation-meta">
                            {new Date(conversation.updated_at).toLocaleDateString()}
                          </div>
                          <button 
                            className="delete-conversation"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation(conversation.id);
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Main Chat Area */}
              <div className={`chat-main ${showChatHistory ? 'with-sidebar' : ''}`}>
                <div className="chat-container">
                  <div className="chat-messages">
                    {chatMessages.map((message, index) => (
                      <div key={index} className={`chat-message ${message.type}`}>
                        <div className="message-avatar">
                          {message.type === 'user' ? '👤' : '🧠'}
                        </div>
                        <div className="message-content">
                          <div className="message-text">{message.content}</div>
                          <div className="message-time">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="chat-message ai">
                        <div className="message-avatar">🧠</div>
                        <div className="message-content">
                          <div className="message-text typing">ConstructIQ is thinking...</div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="chat-input-area">
                    <div className="chat-input-group">
                      <input
                        type="text"
                        placeholder="Ask ConstructIQ about your projects, documents, or construction topics..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        className="chat-input"
                        disabled={isChatLoading}
                      />
                      <button 
                        onClick={handleSendMessage}
                        disabled={isChatLoading || !chatInput.trim()}
                        className="btn btn-primary chat-send-btn"
                      >
                        {isChatLoading ? '...' : 'Send'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="documents-section">
          <div className="documents-header">
            <h3>📄 Document Library</h3>
            <div className="upload-controls">
              <input
                type="file"
                id="file-upload"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={isUploading}
                style={{ display: 'none' }}
              />
              <label htmlFor="file-upload" className={`btn btn-primary upload-btn ${isUploading ? 'uploading' : ''}`}>
                {isUploading ? (
                  <>
                    <span className="upload-icon">⏳</span>
                    Processing...
                  </>
                ) : (
                  <>
                    <span className="upload-icon">📎</span>
                    Upload PDF
                  </>
                )}
              </label>
            </div>
          </div>
          
          {error && !showDeleteModal && (
            <div className="error-message" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <p className="documents-description">
            Upload PDF documents to extract and analyze their content using AI. Documents are automatically chunked and stored for intelligent analysis.
          </p>

          {uploadedFiles.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📚</div>
              <h4>No documents uploaded yet</h4>
              <p>Upload your first PDF to get started with AI-powered document analysis!</p>
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
              <h4>🧠 Intelligent Chat</h4>
              <p>Conversational AI that understands construction context and can analyze your uploaded documents.</p>
            </div>
            <div className="feature-card">
              <h4>📊 Document Analysis</h4>
              <p>AI automatically processes and understands construction documents for intelligent question answering.</p>
            </div>
            <div className="feature-card">
              <h4>🔧 Construction Expertise</h4>
              <p>Specialized knowledge in project management, scheduling, budgeting, and construction best practices.</p>
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
