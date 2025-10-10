from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from typing import List, Optional
from pydantic import BaseModel
import uvicorn

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="ContractorOS API",
    description="Backend API for ContractorOS construction management platform",
    version="1.0.0"
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Service role client for admin operations (if available)
service_supabase: Client = None
if SUPABASE_SERVICE_KEY:
    service_supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("Service role client initialized")
else:
    print("No service role key found")

# Dependency to get Supabase client
def get_supabase() -> Client:
    return supabase

# Basic models
class Project(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    status: str = "active"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget: Optional[float] = None

class Subcontractor(BaseModel):
    id: Optional[int] = None
    name: str
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    specialty: Optional[str] = None

class Schedule(BaseModel):
    id: Optional[int] = None
    project_id: int
    task_name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    assigned_to: Optional[int] = None
    status: str = "pending"

class Budget(BaseModel):
    id: Optional[int] = None
    project_id: int
    category: str
    budgeted_amount: float
    actual_amount: float = 0.0

# Basic routes
@app.get("/")
async def root():
    return {"message": "ContractorOS API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected"}

# Add debug endpoint
@app.get("/debug/project/{project_id}")
async def debug_project_relations(project_id: int, supabase_client: Client = Depends(get_supabase)):
    try:
        # Check project exists
        project = supabase_client.table("projects").select("*").eq("id", project_id).execute()
        
        # Check related schedules
        schedules = supabase_client.table("schedules").select("*").eq("project_id", project_id).execute()
        
        # Check related budgets
        budgets = supabase_client.table("budgets").select("*").eq("project_id", project_id).execute()
        
        return {
            "project_exists": len(project.data) > 0,
            "project_data": project.data,
            "schedules_count": len(schedules.data) if schedules.data else 0,
            "schedules_data": schedules.data,
            "budgets_count": len(budgets.data) if budgets.data else 0,
            "budgets_data": budgets.data
        }
    except Exception as e:
        return {"error": str(e), "error_type": str(type(e))}

# Projects endpoints
@app.get("/projects", response_model=List[Project])
async def get_projects(supabase_client: Client = Depends(get_supabase)):
    try:
        result = supabase_client.table("projects").select("*").execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/projects", response_model=Project)
async def create_project(project: Project, supabase_client: Client = Depends(get_supabase)):
    try:
        result = supabase_client.table("projects").insert(project.dict(exclude={"id"})).execute()
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: int, supabase_client: Client = Depends(get_supabase)):
    try:
        result = supabase_client.table("projects").select("*").eq("id", project_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/projects/{project_id}", response_model=Project)
async def update_project(project_id: int, project: Project, supabase_client: Client = Depends(get_supabase)):
    try:
        result = supabase_client.table("projects").update(project.dict(exclude={"id"})).eq("id", project_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/projects/{project_id}")
async def delete_project(project_id: int, supabase_client: Client = Depends(get_supabase)):
    try:
        # Use service role client for deletions if available
        client_to_use = service_supabase if service_supabase else supabase_client
        print(f"Using {'service role' if service_supabase else 'anon'} client for deletion")
        
        # First check if project exists
        project_check = client_to_use.table("projects").select("id").eq("id", project_id).execute()
        if not project_check.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        print(f"Attempting to delete project {project_id}")
        
        # Delete related schedules first
        try:
            schedules_result = client_to_use.table("schedules").delete().eq("project_id", project_id).execute()
            print(f"Schedules deletion result: {schedules_result}")
        except Exception as schedule_error:
            print(f"Error deleting schedules: {str(schedule_error)}")
        
        # Delete related budgets
        try:
            budgets_result = client_to_use.table("budgets").delete().eq("project_id", project_id).execute()
            print(f"Budgets deletion result: {budgets_result}")
        except Exception as budget_error:
            print(f"Error deleting budgets: {str(budget_error)}")
        
        # Finally delete the project
        result = client_to_use.table("projects").delete().eq("id", project_id).execute()
        print(f"Project deletion result: {result}")
        
        return {"message": "Project and related data deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")

# Subcontractors endpoints
@app.get("/subcontractors", response_model=List[Subcontractor])
async def get_subcontractors(supabase_client: Client = Depends(get_supabase)):
    try:
        result = supabase_client.table("subcontractors").select("*").execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/subcontractors", response_model=Subcontractor)
async def create_subcontractor(subcontractor: Subcontractor, supabase_client: Client = Depends(get_supabase)):
    try:
        result = supabase_client.table("subcontractors").insert(subcontractor.dict(exclude={"id"})).execute()
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/subcontractors/{subcontractor_id}", response_model=Subcontractor)
async def get_subcontractor(subcontractor_id: int, supabase_client: Client = Depends(get_supabase)):
    try:
        result = supabase_client.table("subcontractors").select("*").eq("id", subcontractor_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Subcontractor not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/subcontractors/{subcontractor_id}", response_model=Subcontractor)
async def update_subcontractor(subcontractor_id: int, subcontractor: Subcontractor, supabase_client: Client = Depends(get_supabase)):
    try:
        result = supabase_client.table("subcontractors").update(subcontractor.dict(exclude={"id"})).eq("id", subcontractor_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Subcontractor not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/subcontractors/{subcontractor_id}")
async def delete_subcontractor(subcontractor_id: int, supabase_client: Client = Depends(get_supabase)):
    try:
        # First check if subcontractor exists
        subcontractor_check = supabase_client.table("subcontractors").select("id").eq("id", subcontractor_id).execute()
        if not subcontractor_check.data:
            raise HTTPException(status_code=404, detail="Subcontractor not found")
        
        # Update schedules to remove the subcontractor assignment
        try:
            update_result = supabase_client.table("schedules").update({"assigned_to": None}).eq("assigned_to", subcontractor_id).execute()
            print(f"Updated {len(update_result.data) if update_result.data else 0} schedules to remove subcontractor assignment")
        except Exception as update_error:
            print(f"Error updating schedules: {str(update_error)}")
        
        # Then delete the subcontractor
        result = supabase_client.table("subcontractors").delete().eq("id", subcontractor_id).execute()
        print(f"Subcontractor deletion result: {result}")
        
        return {"message": "Subcontractor deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting subcontractor {subcontractor_id}: {str(e)}")
        print(f"Error type: {type(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete subcontractor: {str(e)}")

# Schedule endpoints
@app.get("/schedules", response_model=List[Schedule])
async def get_schedules(project_id: Optional[int] = None, supabase_client: Client = Depends(get_supabase)):
    try:
        query = supabase_client.table("schedules").select("*")
        if project_id:
            query = query.eq("project_id", project_id)
        result = query.execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/schedules", response_model=Schedule)
async def create_schedule(schedule: Schedule, supabase_client: Client = Depends(get_supabase)):
    try:
        result = supabase_client.table("schedules").insert(schedule.dict(exclude={"id"})).execute()
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/schedules/{schedule_id}", response_model=Schedule)
async def get_schedule(schedule_id: int, supabase_client: Client = Depends(get_supabase)):
    try:
        result = supabase_client.table("schedules").select("*").eq("id", schedule_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Schedule not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/schedules/{schedule_id}", response_model=Schedule)
async def update_schedule(schedule_id: int, schedule: Schedule, supabase_client: Client = Depends(get_supabase)):
    try:
        result = supabase_client.table("schedules").update(schedule.dict(exclude={"id"})).eq("id", schedule_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Schedule not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: int, supabase_client: Client = Depends(get_supabase)):
    try:
        # First check if schedule exists
        schedule_check = supabase_client.table("schedules").select("id").eq("id", schedule_id).execute()
        if not schedule_check.data:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        result = supabase_client.table("schedules").delete().eq("id", schedule_id).execute()
        print(f"Schedule deletion result: {result}")
        
        return {"message": "Schedule deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting schedule {schedule_id}: {str(e)}")
        print(f"Error type: {type(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete schedule: {str(e)}")

# Budget endpoints
@app.get("/budgets", response_model=List[Budget])
async def get_budgets(project_id: Optional[int] = None, supabase_client: Client = Depends(get_supabase)):
    try:
        query = supabase_client.table("budgets").select("*")
        if project_id:
            query = query.eq("project_id", project_id)
        result = query.execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/budgets", response_model=Budget)
async def create_budget(budget: Budget, supabase_client: Client = Depends(get_supabase)):
    try:
        result = supabase_client.table("budgets").insert(budget.dict(exclude={"id"})).execute()
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/budgets/{budget_id}", response_model=Budget)
async def get_budget(budget_id: int, supabase_client: Client = Depends(get_supabase)):
    try:
        result = supabase_client.table("budgets").select("*").eq("id", budget_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Budget not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/budgets/{budget_id}", response_model=Budget)
async def update_budget(budget_id: int, budget: Budget, supabase_client: Client = Depends(get_supabase)):
    try:
        result = supabase_client.table("budgets").update(budget.dict(exclude={"id"})).eq("id", budget_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Budget not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: int, supabase_client: Client = Depends(get_supabase)):
    try:
        # First check if budget exists
        budget_check = supabase_client.table("budgets").select("id").eq("id", budget_id).execute()
        if not budget_check.data:
            raise HTTPException(status_code=404, detail="Budget not found")
        
        result = supabase_client.table("budgets").delete().eq("id", budget_id).execute()
        print(f"Budget deletion result: {result}")
        
        return {"message": "Budget deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting budget {budget_id}: {str(e)}")
        print(f"Error type: {type(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete budget: {str(e)}")

# Add debug endpoint
@app.get("/debug/project/{project_id}")
async def debug_project_relations(project_id: int, supabase_client: Client = Depends(get_supabase)):
    try:
        # Check project exists
        project = supabase_client.table("projects").select("*").eq("id", project_id).execute()
        
        # Check related schedules
        schedules = supabase_client.table("schedules").select("*").eq("project_id", project_id).execute()
        
        # Check related budgets
        budgets = supabase_client.table("budgets").select("*").eq("project_id", project_id).execute()
        
        return {
            "project_exists": len(project.data) > 0,
            "project_data": project.data,
            "schedules_count": len(schedules.data) if schedules.data else 0,
            "schedules_data": schedules.data,
            "budgets_count": len(budgets.data) if budgets.data else 0,
            "budgets_data": budgets.data
        }
    except Exception as e:
        return {"error": str(e), "error_type": str(type(e))}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
