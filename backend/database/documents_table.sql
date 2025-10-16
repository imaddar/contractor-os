-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    file_size INTEGER,
    page_count INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS (Row Level Security) if needed
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (adjust as needed for your auth requirements)
CREATE POLICY "Allow all operations on documents" ON documents
    FOR ALL USING (true);

-- Create an index on uploaded_at for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at DESC);
