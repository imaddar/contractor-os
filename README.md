# ContractorOS

**ContractorOS** is a comprehensive construction management platform designed to streamline project workflows, from planning and budgeting to execution and analysis. It features an AI-powered assistant, **ConstructIQ**, to provide intelligent insights from your project documents.

## ✨ Features

- **Dashboard**: Get a high-level overview of all your projects, tasks, budgets, and deadlines.
- **Project Management**: Create, track, and manage construction projects from start to finish.
- **Scheduling**: Plan and visualize project timelines with an interactive calendar and task management.
- **Budgeting**: Manage project finances, track budgeted vs. actual amounts, and monitor financial health.
- **Subcontractor Management**: Keep a directory of subcontractors, manage their information, and assign them to tasks.
- **ConstructIQ (AI Assistant)**:
    - **Document Parser**: Upload PDF documents (like SOWs, blueprints, contracts) for AI-powered analysis.
    - **Intelligent Chat**: Converse with an AI that understands your project documents and provides expert construction advice.
    - **Persistent Conversations**: Chat history is saved, allowing you to revisit past conversations and insights.

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Backend**: Python, FastAPI
- **Database**: Supabase (PostgreSQL with pgvector)
- **AI & Machine Learning**:
    - LangChain & LangGraph for building AI workflows
    - Ollama for local LLM hosting (e.g., `qwen3:8b`)
    - HuggingFace sentence-transformers for document embeddings

## 🚀 Getting Started

Follow these instructions to get a local copy up and running for development and testing purposes.

### Prerequisites

- Node.js and npm/yarn/pnpm
- Python 3.8+ and pip
- A Supabase account
- Ollama installed and running with a model (e.g., `ollama run qwen3:8b`)

### Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Create a virtual environment and activate it:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```

3.  **Install Python dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Create a `.env` file** in the `backend` directory and add your Supabase credentials. You can get these from your Supabase project settings.
    ```env
    SUPABASE_URL="YOUR_SUPABASE_URL"
    SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
    SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
    ```

5.  **Set up the database schema:**
    - Go to the SQL Editor in your Supabase dashboard.
    - Run the SQL scripts located in `backend/database/` to create the necessary tables and functions (`schema.sql`, `langchain.sql`, `chat_history.sql`).

6.  **Run the backend server:**
    ```bash
    uvicorn main:app --reload
    ```
    The backend will be running at `http://localhost:8000`.

### Frontend Setup

1.  **Navigate to the root directory** (if you were in the backend directory).
    ```bash
    cd ..
    ```

2.  **Install frontend dependencies:**
    ```bash
    npm install
    ```

3.  **Run the frontend development server:**
    ```bash
    npm run dev
    ```
    The frontend will be running at `http://localhost:5173`.

You can now access the application in your browser.
