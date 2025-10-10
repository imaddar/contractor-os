# ContractorOS Backend

FastAPI backend service for ContractorOS construction management platform.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with your Supabase credentials:
   - Get your Supabase URL and keys from your Supabase dashboard
   - Update the values in `.env`

4. Run the SQL schema in your Supabase SQL editor:
   - Copy contents of `database/init.sql`
   - Run in Supabase SQL editor to create tables

5. Start the development server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

## API Documentation

- Interactive docs: `http://localhost:8000/docs`
- OpenAPI schema: `http://localhost:8000/openapi.json`

## Available Endpoints

### Projects
- `GET /projects` - List all projects
- `POST /projects` - Create new project
- `GET /projects/{id}` - Get specific project
- `PUT /projects/{id}` - Update project
- `DELETE /projects/{id}` - Delete project

### Subcontractors
- `GET /subcontractors` - List all subcontractors
- `POST /subcontractors` - Create new subcontractor
- `PUT /subcontractors/{id}` - Update subcontractor
- `DELETE /subcontractors/{id}` - Delete subcontractor

### Schedules
- `GET /schedules` - List all schedules (optional ?project_id filter)
- `POST /schedules` - Create new schedule
- `GET /schedules/{id}` - Get specific schedule
- `PUT /schedules/{id}` - Update schedule
- `DELETE /schedules/{id}` - Delete schedule

### Budgets
- `GET /budgets` - List all budgets (optional ?project_id filter)
- `POST /budgets` - Create new budget
- `GET /budgets/{id}` - Get specific budget
- `PUT /budgets/{id}` - Update budget
- `DELETE /budgets/{id}` - Delete budget

### General
- `GET /` - Root endpoint
- `GET /health` - Health check
