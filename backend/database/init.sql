-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    budget DECIMAL(12, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subcontractors table
CREATE TABLE IF NOT EXISTS subcontractors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    phone VARCHAR(20),
    specialty VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create schedules table
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    task_name VARCHAR(255) NOT NULL,
    start_date DATE,
    end_date DATE,
    assigned_to INTEGER REFERENCES subcontractors(id),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create budgets table
CREATE TABLE IF NOT EXISTS budgets (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    category VARCHAR(100) NOT NULL,
    budgeted_amount DECIMAL(12, 2),
    actual_amount DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Create policies (basic policies - adjust based on your auth requirements)
CREATE POLICY "Enable read access for all users" ON projects FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON projects FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON subcontractors FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON subcontractors FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON subcontractors FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON schedules FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON schedules FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON budgets FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON budgets FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON budgets FOR UPDATE USING (true);
