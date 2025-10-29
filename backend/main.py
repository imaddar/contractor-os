from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from typing import Dict, List, Optional
from pydantic import BaseModel
import uvicorn
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import CharacterTextSplitter
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
import tempfile
import os as file_os
from datetime import datetime
from uuid import UUID
from langchain_ollama import ChatOllama
from langchain_core.tools import tool
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langgraph.graph import MessagesState, StateGraph, END
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver
from typing_extensions import TypedDict

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="ContractorOS API",
    description="Backend API for ContractorOS construction management platform",
    version="1.0.0",
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(
        "Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
    )

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Service role client for admin operations (if available)
service_supabase: Client = None
if SUPABASE_SERVICE_KEY:
    service_supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("Service role client initialized")
else:
    print("No service role key found")

# Initialize embeddings for RAG
try:
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-mpnet-base-v2"
    )
    print("Embeddings model initialized")
except Exception as e:
    print(f"Warning: Could not initialize embeddings model: {e}")
    embeddings = None

# Initialize LLM for chat functionality
try:
    chat_llm = ChatOllama(model="qwen3:8b", validate_model_on_init=True)

    print("Chat LLM initialized")
except Exception as e:
    print(f"Warning: Could not initialize chat LLM: {e}")
    chat_llm = None

# Initialize memory for conversation persistence
memory = MemorySaver()

# Ephemeral in-memory conversations for non-persisted threads
ephemeral_chat_threads: Dict[str, List[dict]] = {}


# Dependency to get Supabase client
def get_supabase() -> Client:
    return supabase


# Basic models
class Project(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    address: Optional[str] = None
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


class Document(BaseModel):
    id: Optional[str] = None  # Vector store uses string IDs
    filename: str
    content: str
    file_size: Optional[int] = None
    page_count: Optional[int] = None
    chunk_count: Optional[int] = None
    uploaded_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ChatConversation(BaseModel):
    id: Optional[str] = None
    title: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ChatMessage(BaseModel):
    id: Optional[str] = None
    conversation_id: str
    message_type: str  # 'user' or 'ai'
    content: str
    created_at: Optional[str] = None
    index_order: int


# Basic routes
@app.get("/")
async def root():
    return {"message": "ContractorOS API is running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected"}


# Add debug endpoint
@app.get("/debug/project/{project_id}")
async def debug_project_relations(
    project_id: int, supabase_client: Client = Depends(get_supabase)
):
    try:
        # Check project exists
        project = (
            supabase_client.table("projects").select("*").eq("id", project_id).execute()
        )

        # Check related schedules
        schedules = (
            supabase_client.table("schedules")
            .select("*")
            .eq("project_id", project_id)
            .execute()
        )

        # Check related budgets
        budgets = (
            supabase_client.table("budgets")
            .select("*")
            .eq("project_id", project_id)
            .execute()
        )

        return {
            "project_exists": len(project.data) > 0,
            "project_data": project.data,
            "schedules_count": len(schedules.data) if schedules.data else 0,
            "schedules_data": schedules.data,
            "budgets_count": len(budgets.data) if budgets.data else 0,
            "budgets_data": budgets.data,
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
async def create_project(
    project: Project, supabase_client: Client = Depends(get_supabase)
):
    try:
        result = (
            supabase_client.table("projects")
            .insert(project.dict(exclude={"id"}))
            .execute()
        )
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: int, supabase_client: Client = Depends(get_supabase)):
    try:
        result = (
            supabase_client.table("projects").select("*").eq("id", project_id).execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/projects/{project_id}", response_model=Project)
async def update_project(
    project_id: int, project: Project, supabase_client: Client = Depends(get_supabase)
):
    try:
        result = (
            supabase_client.table("projects")
            .update(project.dict(exclude={"id"}))
            .eq("id", project_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/projects/{project_id}")
async def delete_project(
    project_id: int, supabase_client: Client = Depends(get_supabase)
):
    try:
        # Use service role client for deletions if available
        client_to_use = service_supabase if service_supabase else supabase_client
        print(
            "Using {'service role' if service_supabase else 'anon'} client for deletion"
        )

        # First check if project exists
        project_check = (
            client_to_use.table("projects").select("id").eq("id", project_id).execute()
        )
        if not project_check.data:
            raise HTTPException(status_code=404, detail="Project not found")

        print(f"Attempting to delete project {project_id}")

        # Delete related schedules first
        try:
            schedules_result = (
                client_to_use.table("schedules")
                .delete()
                .eq("project_id", project_id)
                .execute()
            )
            print(
                f"Schedules deletion result count: {len(schedules_result.data) if schedules_result.data else 0}"
            )
        except Exception as schedule_error:
            print(f"Error deleting schedules: {str(schedule_error)}")

        # Delete related budgets
        try:
            budgets_result = (
                client_to_use.table("budgets")
                .delete()
                .eq("project_id", project_id)
                .execute()
            )
            print(
                f"Budgets deletion result count: {len(budgets_result.data) if budgets_result.data else 0}"
            )
        except Exception as budget_error:
            print(f"Error deleting budgets: {str(budget_error)}")

        # Finally delete the project
        result = client_to_use.table("projects").delete().eq("id", project_id).execute()
        print(f"Project deletion successful")

        return {
            "message": "Project and related data deleted successfully",
            "deleted_id": project_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete project: {str(e)}"
        )


# Subcontractors endpoints
@app.get("/subcontractors", response_model=List[Subcontractor])
async def get_subcontractors(supabase_client: Client = Depends(get_supabase)):
    try:
        result = supabase_client.table("subcontractors").select("*").execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/subcontractors", response_model=Subcontractor)
async def create_subcontractor(
    subcontractor: Subcontractor, supabase_client: Client = Depends(get_supabase)
):
    try:
        result = (
            supabase_client.table("subcontractors")
            .insert(subcontractor.dict(exclude={"id"}))
            .execute()
        )
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/subcontractors/{subcontractor_id}", response_model=Subcontractor)
async def get_subcontractor(
    subcontractor_id: int, supabase_client: Client = Depends(get_supabase)
):
    try:
        result = (
            supabase_client.table("subcontractors")
            .select("*")
            .eq("id", subcontractor_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Subcontractor not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/subcontractors/{subcontractor_id}", response_model=Subcontractor)
async def update_subcontractor(
    subcontractor_id: int,
    subcontractor: Subcontractor,
    supabase_client: Client = Depends(get_supabase),
):
    try:
        result = (
            supabase_client.table("subcontractors")
            .update(subcontractor.dict(exclude={"id"}))
            .eq("id", subcontractor_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Subcontractor not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/subcontractors/{subcontractor_id}")
async def delete_subcontractor(
    subcontractor_id: int, supabase_client: Client = Depends(get_supabase)
):
    try:
        # Use service role client for deletions if available
        client_to_use = service_supabase if service_supabase else supabase_client

        # First check if subcontractor exists
        subcontractor_check = (
            client_to_use.table("subcontractors")
            .select("id")
            .eq("id", subcontractor_id)
            .execute()
        )
        if not subcontractor_check.data:
            raise HTTPException(status_code=404, detail="Subcontractor not found")

        # Update schedules to remove the subcontractor assignment
        try:
            update_result = (
                client_to_use.table("schedules")
                .update({"assigned_to": None})
                .eq("assigned_to", subcontractor_id)
                .execute()
            )
            print(f"Updated schedules to remove subcontractor assignment")
        except Exception as update_error:
            print(f"Error updating schedules: {str(update_error)}")

        # Then delete the subcontractor
        result = (
            client_to_use.table("subcontractors")
            .delete()
            .eq("id", subcontractor_id)
            .execute()
        )
        print(f"Subcontractor deletion successful")

        return {
            "message": "Subcontractor deleted successfully",
            "deleted_id": subcontractor_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting subcontractor {subcontractor_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete subcontractor: {str(e)}"
        )


# Schedule endpoints
@app.get("/schedules", response_model=List[Schedule])
async def get_schedules(
    project_id: Optional[int] = None, supabase_client: Client = Depends(get_supabase)
):
    try:
        query = supabase_client.table("schedules").select("*")
        if project_id:
            query = query.eq("project_id", project_id)
        result = query.execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/schedules", response_model=Schedule)
async def create_schedule(
    schedule: Schedule, supabase_client: Client = Depends(get_supabase)
):
    try:
        result = (
            supabase_client.table("schedules")
            .insert(schedule.dict(exclude={"id"}))
            .execute()
        )
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/schedules/{schedule_id}", response_model=Schedule)
async def get_schedule(
    schedule_id: int, supabase_client: Client = Depends(get_supabase)
):
    try:
        result = (
            supabase_client.table("schedules")
            .select("*")
            .eq("id", schedule_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Schedule not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/schedules/{schedule_id}", response_model=Schedule)
async def update_schedule(
    schedule_id: int,
    schedule: Schedule,
    supabase_client: Client = Depends(get_supabase),
):
    try:
        result = (
            supabase_client.table("schedules")
            .update(schedule.dict(exclude={"id"}))
            .eq("id", schedule_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Schedule not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: int, supabase_client: Client = Depends(get_supabase)
):
    try:
        # Use service role client for deletions if available
        client_to_use = service_supabase if service_supabase else supabase_client

        # First check if schedule exists
        schedule_check = (
            client_to_use.table("schedules")
            .select("id")
            .eq("id", schedule_id)
            .execute()
        )
        if not schedule_check.data:
            raise HTTPException(status_code=404, detail="Schedule not found")

        # Delete the schedule
        result = (
            client_to_use.table("schedules").delete().eq("id", schedule_id).execute()
        )
        print(f"Schedule deletion result: {result}")

        # Supabase delete returns empty data array when successful, so we just check for no error
        return {"message": "Schedule deleted successfully", "deleted_id": schedule_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting schedule {schedule_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete schedule: {str(e)}"
        )


# Budget endpoints
@app.get("/budgets", response_model=List[Budget])
async def get_budgets(
    project_id: Optional[int] = None, supabase_client: Client = Depends(get_supabase)
):
    try:
        query = supabase_client.table("budgets").select("*")
        if project_id:
            query = query.eq("project_id", project_id)
        result = query.execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/budgets", response_model=Budget)
async def create_budget(
    budget: Budget, supabase_client: Client = Depends(get_supabase)
):
    try:
        result = (
            supabase_client.table("budgets")
            .insert(budget.dict(exclude={"id"}))
            .execute()
        )
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/budgets/{budget_id}", response_model=Budget)
async def get_budget(budget_id: int, supabase_client: Client = Depends(get_supabase)):
    try:
        result = (
            supabase_client.table("budgets").select("*").eq("id", budget_id).execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Budget not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/budgets/{budget_id}", response_model=Budget)
async def update_budget(
    budget_id: int, budget: Budget, supabase_client: Client = Depends(get_supabase)
):
    try:
        result = (
            supabase_client.table("budgets")
            .update(budget.dict(exclude={"id"}))
            .eq("id", budget_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Budget not found")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/budgets/{budget_id}")
async def delete_budget(
    budget_id: int, supabase_client: Client = Depends(get_supabase)
):
    try:
        # Use service role client for deletions if available
        client_to_use = service_supabase if service_supabase else supabase_client

        # First check if budget exists
        budget_check = (
            client_to_use.table("budgets").select("id").eq("id", budget_id).execute()
        )
        if not budget_check.data:
            raise HTTPException(status_code=404, detail="Budget not found")

        # Delete the budget
        result = client_to_use.table("budgets").delete().eq("id", budget_id).execute()
        print(f"Budget deletion successful")

        return {"message": "Budget deleted successfully", "deleted_id": budget_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting budget {budget_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete budget: {str(e)}"
        )


# Add dashboard summary endpoint
@app.get("/dashboard/summary")
async def get_dashboard_summary(supabase_client: Client = Depends(get_supabase)):
    try:
        # Get project statistics
        projects_result = supabase_client.table("projects").select("*").execute()
        projects = projects_result.data or []

        active_projects = len([p for p in projects if p.get("status") == "active"])
        total_budget = sum(p.get("budget", 0) or 0 for p in projects)

        # Get schedule statistics
        schedules_result = supabase_client.table("schedules").select("*").execute()
        schedules = schedules_result.data or []

        pending_tasks = len([s for s in schedules if s.get("status") == "pending"])
        in_progress_tasks = len(
            [s for s in schedules if s.get("status") == "in_progress"]
        )
        completed_tasks = len([s for s in schedules if s.get("status") == "completed"])

        # Get budget statistics
        budgets_result = supabase_client.table("budgets").select("*").execute()
        budgets = budgets_result.data or []

        total_budgeted = sum(b.get("budgeted_amount", 0) or 0 for b in budgets)
        total_actual = sum(b.get("actual_amount", 0) or 0 for b in budgets)
        budget_variance = total_budgeted - total_actual

        # Get subcontractor count
        subcontractors_result = (
            supabase_client.table("subcontractors").select("id").execute()
        )
        subcontractor_count = len(subcontractors_result.data or [])

        return {
            "projects": {
                "total": len(projects),
                "active": active_projects,
                "total_budget": total_budget,
            },
            "tasks": {
                "total": len(schedules),
                "pending": pending_tasks,
                "in_progress": in_progress_tasks,
                "completed": completed_tasks,
            },
            "budgets": {
                "total_budgeted": total_budgeted,
                "total_actual": total_actual,
                "variance": budget_variance,
            },
            "subcontractors": {"total": subcontractor_count},
        }
    except Exception as e:
        print(f"Error fetching dashboard summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Document endpoints
@app.get("/documents", response_model=List[Document])
async def get_documents(supabase_client: Client = Depends(get_supabase)):
    try:
        # Get unique documents from the vector store by grouping on filename
        result = supabase_client.table("documents").select("metadata").execute()

        # Group by filename to get unique documents
        documents_dict = {}
        for row in result.data:
            metadata = row.get("metadata", {})
            filename = metadata.get("filename")

            # Skip documents with invalid or missing filenames
            if not filename or filename == "Unknown" or filename.strip() == "":
                continue

            if filename not in documents_dict:
                documents_dict[filename] = {
                    "id": f"{filename}_{metadata.get('upload_timestamp', 'unknown')}",
                    "filename": filename,
                    "content": f"Document stored as chunks for semantic search",
                    "file_size": metadata.get("file_size"),
                    "page_count": metadata.get("page_count"),
                    "chunk_count": 1,
                    "uploaded_at": metadata.get("upload_timestamp"),
                    "created_at": metadata.get("upload_timestamp"),
                    "updated_at": metadata.get("upload_timestamp"),
                }
            else:
                # Increment chunk count for duplicate filenames
                documents_dict[filename]["chunk_count"] += 1

        return list(documents_dict.values())
    except Exception as e:
        print(f"Error fetching documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/documents/{filename}")
async def get_document_by_filename(
    filename: str, supabase_client: Client = Depends(get_supabase)
):
    try:
        # Validate filename
        if not filename or filename == "Unknown" or filename.strip() == "":
            raise HTTPException(status_code=400, detail="Invalid filename provided")

        print(f"Fetching document with filename: {filename}")

        # Get all chunks for this filename
        result = (
            supabase_client.table("documents")
            .select("*")
            .eq("metadata->>filename", filename)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=404, detail=f"Document with filename '{filename}' not found"
            )

        # Get metadata from first chunk
        first_chunk = result.data[0]
        metadata = first_chunk.get("metadata", {})

        # Get full document text from metadata
        full_document_text = metadata.get("full_document_text", "")

        # If no full text in metadata, combine chunks as fallback
        if not full_document_text:
            full_document_text = "\n\n".join(
                [chunk.get("content", "") for chunk in result.data]
            )

        return {
            "id": f"{filename}_{metadata.get('upload_timestamp', 'unknown')}",
            "filename": filename,
            "content": full_document_text,
            "file_size": metadata.get("file_size"),
            "page_count": metadata.get("page_count"),
            "chunk_count": len(result.data),
            "uploaded_at": metadata.get("upload_timestamp"),
            "created_at": metadata.get("upload_timestamp"),
            "updated_at": metadata.get("upload_timestamp"),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching document {filename}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch document: {str(e)}"
        )


@app.delete("/documents/{filename}")
async def delete_document_by_filename(
    filename: str, supabase_client: Client = Depends(get_supabase)
):
    try:
        # Validate filename
        if not filename or filename == "Unknown" or filename.strip() == "":
            raise HTTPException(status_code=400, detail="Invalid filename provided")

        # Use service role client for deletions if available
        client_to_use = service_supabase if service_supabase else supabase_client

        print(f"Attempting to delete document: {filename}")

        # Check if document exists
        document_check = (
            client_to_use.table("documents")
            .select("id")
            .eq("metadata->>filename", filename)
            .execute()
        )
        if not document_check.data:
            raise HTTPException(
                status_code=404, detail=f"Document with filename '{filename}' not found"
            )

        # Delete all chunks for this filename
        result = (
            client_to_use.table("documents")
            .delete()
            .eq("metadata->>filename", filename)
            .execute()
        )
        deleted_count = len(result.data) if result.data else 0

        print(f"Deleted {deleted_count} chunks for document: {filename}")

        return {
            "message": f"Document '{filename}' and all {deleted_count} chunks deleted successfully",
            "deleted_filename": filename,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting document {filename}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete document: {str(e)}"
        )


# Document parsing endpoint (updated for RAG-style chunking)
@app.post("/parse-document")
async def parse_document(
    file: UploadFile = File(...), supabase_client: Client = Depends(get_supabase)
):
    print(f"Starting document parsing for file: {file.filename}")

    if not file.filename or not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    if not embeddings:
        print("Error: Embeddings model not available")
        raise HTTPException(status_code=500, detail="Embeddings model not available")

    temp_file_path = None
    try:
        print("Creating temporary file...")
        # Create a temporary file to store the uploaded PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        print(f"Temporary file created: {temp_file_path}")
        print(f"File size: {len(content)} bytes")

        # Use PyPDFLoader to extract text
        print("Loading PDF with PyPDFLoader...")
        loader = PyPDFLoader(file_path=temp_file_path)
        documents = loader.load()
        print(f"PDF loaded successfully. Pages: {len(documents)}")

        if not documents:
            raise HTTPException(
                status_code=400, detail="No content could be extracted from the PDF"
            )

        # Combine all pages into full document text for viewing
        full_document_text = "\n\n".join([doc.page_content for doc in documents])

        # Split documents into chunks
        print("Splitting documents into chunks...")
        text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        docs = text_splitter.split_documents(documents)
        print(f"Document split into {len(docs)} chunks")

        if not docs:
            raise HTTPException(
                status_code=400, detail="Document could not be split into chunks"
            )

        # Add comprehensive metadata to each chunk
        print("Adding metadata to chunks...")
        upload_timestamp = datetime.now().isoformat()
        for i, doc in enumerate(docs):
            doc.metadata.update(
                {
                    "filename": file.filename,
                    "upload_timestamp": upload_timestamp,
                    "file_size": len(content),
                    "page_count": len(documents),
                    "chunk_index": i,
                    "total_chunks": len(docs),
                    "full_document_text": full_document_text,  # Store full text in metadata
                }
            )

        # Clean up the temporary file
        print("Cleaning up temporary file...")
        file_os.unlink(temp_file_path)
        temp_file_path = None

        # Store chunks in vector database
        print("Storing chunks in vector database...")
        vector_store = SupabaseVectorStore.from_documents(
            docs,
            embeddings,
            client=service_supabase if service_supabase else supabase_client,
            table_name="documents",
            query_name="match_documents",
            chunk_size=500,
        )
        print("Chunks stored successfully in vector database")

        # Return document info
        return {
            "id": f"{file.filename}_{upload_timestamp}",
            "filename": file.filename,
            "content": f"Document processed into {len(docs)} searchable chunks",
            "file_size": len(content),
            "page_count": len(documents),
            "chunk_count": len(docs),
            "uploaded_at": upload_timestamp,
            "created_at": upload_timestamp,
            "updated_at": upload_timestamp,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error during document processing: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback

        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, detail=f"Failed to parse document: {str(e)}"
        )
    finally:
        # Make sure to clean up temp file even if there's an error
        if temp_file_path and file_os.path.exists(temp_file_path):
            try:
                file_os.unlink(temp_file_path)
                print("Temporary file cleaned up")
            except Exception as cleanup_error:
                print(f"Failed to cleanup temp file: {cleanup_error}")


# Add document retrieval tool for LangGraph
@tool(response_format="content_and_artifact")
def retrieve_documents(query: str):
    """Retrieve construction document information related to a query."""
    if not embeddings:
        return "Document search is not available", []

    try:
        vector_store = SupabaseVectorStore(
            client=service_supabase if service_supabase else supabase,
            embedding=embeddings,
            table_name="documents",
            query_name="match_documents",
        )

        retrieved_docs = vector_store.similarity_search(query, k=3)
        serialized = "\n\n".join(
            (
                f"Document: {doc.metadata.get('filename', 'Unknown')}\n"
                f"Content: {doc.page_content[:500]}..."
            )
            for doc in retrieved_docs
        )
        return serialized, retrieved_docs
    except Exception as e:
        return f"Error retrieving documents: {str(e)}", []


# LangGraph workflow functions
def query_or_respond(state: MessagesState):
    """Generate tool call for retrieval or respond directly."""
    if not chat_llm:
        return {"messages": [AIMessage(content="Chat functionality is not available.")]}

    llm_with_tools = chat_llm.bind_tools([retrieve_documents])
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}


def generate_response(state: MessagesState):
    """Generate response using retrieved document content."""
    if not chat_llm:
        return {"messages": [AIMessage(content="Chat functionality is not available.")]}

    # Get recent tool messages
    recent_tool_messages = []
    for message in reversed(state["messages"]):
        if message.type == "tool":
            recent_tool_messages.append(message)
        else:
            break
    tool_messages = recent_tool_messages[::-1]

    # Format context from retrieved documents
    docs_content = "\n\n".join(doc.content for doc in tool_messages)

    system_message_content = (
        "You are ConstructIQ, an AI assistant specialized in construction project management. "
        "You help contractors with project planning, scheduling, budgeting, and document analysis. "
        "Use the following retrieved document content to answer questions accurately. "
        "If the documents don't contain relevant information, provide general construction advice. "
        "Keep responses practical and actionable for construction professionals. "
        "IMPORTANT: Do not include any <think> tags or thinking processes in your response. "
        "Provide only the direct, clean answer without showing your reasoning process."
        "\n\nRetrieved Documents:\n"
        f"{docs_content}"
    )

    # Get conversation history (excluding tool calls)
    conversation_messages = [
        message
        for message in state["messages"]
        if message.type in ("human", "system")
        or (message.type == "ai" and not message.tool_calls)
    ]

    prompt = [SystemMessage(content=system_message_content)] + conversation_messages
    response = chat_llm.invoke(prompt)

    # Clean the response content to remove <think> tags
    cleaned_content = clean_ai_response(response.content)
    response.content = cleaned_content

    return {"messages": [response]}


def clean_ai_response(content: str) -> str:
    """Remove <think> sections from AI responses."""
    import re

    # Remove <think>...</think> blocks (case insensitive, multiline)
    cleaned = re.sub(
        r"<think>.*?</think>\s*", "", content, flags=re.DOTALL | re.IGNORECASE
    )

    # Also handle think blocks without closing tags (just in case)
    cleaned = re.sub(
        r"<think>.*?(?=\n\n|\Z)", "", cleaned, flags=re.DOTALL | re.IGNORECASE
    )

    # Clean up any extra whitespace at the beginning
    cleaned = cleaned.strip()

    return cleaned


# Build the chat graph
def create_chat_graph():
    """Create and compile the LangGraph chat workflow."""
    if not chat_llm:
        return None

    graph_builder = StateGraph(MessagesState)

    # Add nodes
    graph_builder.add_node("query_or_respond", query_or_respond)
    graph_builder.add_node("tools", ToolNode([retrieve_documents]))
    graph_builder.add_node("generate", generate_response)

    # Set entry point and edges
    graph_builder.set_entry_point("query_or_respond")
    graph_builder.add_conditional_edges(
        "query_or_respond",
        tools_condition,
        {END: END, "tools": "tools"},
    )
    graph_builder.add_edge("tools", "generate")
    graph_builder.add_edge("generate", END)

    return graph_builder.compile(checkpointer=memory)


# Initialize chat graph
chat_graph = create_chat_graph()


# Utilities
def _is_valid_uuid(value: str) -> bool:
    try:
        UUID(str(value))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def ensure_chat_backend() -> bool:
    """Attempt to ensure the chat LLM and graph are ready before processing."""
    global chat_llm, chat_graph

    if chat_graph:
        return True

    if chat_llm and not chat_graph:
        try:
            chat_graph = create_chat_graph()
            if chat_graph:
                print("[ConstructIQ] Chat graph compiled using existing LLM")
                return True
        except Exception as compile_error:
            print(f"Chat graph compile error with existing LLM: {compile_error}")
            chat_graph = None

    if not chat_llm:
        # Try reinitializing via Ollama first
        try:
            ollama_model = os.getenv("OLLAMA_MODEL", "qwen3:8b")
            chat_llm = ChatOllama(model=ollama_model, validate_model_on_init=True)
            print(f"[ConstructIQ] Chat LLM initialized via Ollama ({ollama_model})")
        except Exception as ollama_error:
            print(f"Chat Ollama init error: {ollama_error}")
            chat_llm = None

        # Fall back to OpenAI if available
        if not chat_llm:
            openai_key = os.getenv("OPENAI_API_KEY")
            if openai_key:
                try:
                    from langchain_openai import ChatOpenAI

                    openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
                    temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.2"))
                    chat_llm = ChatOpenAI(
                        model=openai_model,
                        temperature=temperature,
                    )
                    print(
                        f"[ConstructIQ] Chat LLM initialized via OpenAI ({openai_model})"
                    )
                except Exception as openai_error:
                    print(f"Chat OpenAI init error: {openai_error}")
                    chat_llm = None
            else:
                print("[ConstructIQ] No LLM available (missing Ollama/OpenAI backend)")

    if chat_llm and not chat_graph:
        try:
            chat_graph = create_chat_graph()
            if chat_graph:
                print("[ConstructIQ] Chat graph compiled successfully")
                return True
        except Exception as compile_error:
            print(f"Chat graph compile error: {compile_error}")
            chat_graph = None

    return chat_graph is not None


def build_fallback_response(user_message: str) -> str:
    """Generate a simple, deterministic fallback response when the LLM is unavailable."""
    context_sections: List[str] = []

    if embeddings and hasattr(retrieve_documents, "func"):
        try:
            retrieval_result = retrieve_documents.func(user_message)
            if isinstance(retrieval_result, tuple):
                serialized, docs = retrieval_result
            else:
                serialized, docs = retrieval_result, []

            if docs:
                snippets = []
                for doc in docs[:3]:
                    filename = doc.metadata.get("filename", "Document")
                    snippet = doc.page_content.replace("\n", " ").strip()
                    if len(snippet) > 220:
                        snippet = snippet[:220].rstrip() + "..."
                    snippets.append(f"- {filename}: {snippet}")
                context_sections.append(
                    "Relevant document excerpts:\n" + "\n".join(snippets)
                )
            elif isinstance(serialized, str) and serialized:
                context_sections.append(serialized)
        except Exception as retrieval_error:
            print(f"ConstructIQ fallback retrieval error: {retrieval_error}")

    if context_sections:
        guidance = (
            "I'm currently operating in fallback mode and don't have full AI reasoning available. "
            "Here is what I can share based on your project documents:"
        )
        return f"{guidance}\n\n" + "\n\n".join(context_sections)

    return (
        "I'm currently operating in fallback mode and can't access the ConstructIQ AI model. "
        "Please verify that the model service is running, then try again."
    )


# Chat conversation endpoints
@app.get("/chat/conversations", response_model=List[ChatConversation])
async def get_chat_conversations(supabase_client: Client = Depends(get_supabase)):
    """Get all chat conversations ordered by most recent."""
    try:
        result = (
            supabase_client.table("chat_conversations")
            .select("*")
            .order("updated_at", desc=True)
            .execute()
        )
        return result.data
    except Exception as e:
        print(f"Error fetching conversations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/conversations", response_model=ChatConversation)
async def create_chat_conversation(
    conversation: ChatConversation, supabase_client: Client = Depends(get_supabase)
):
    """Create a new chat conversation."""
    try:
        result = (
            supabase_client.table("chat_conversations")
            .insert(conversation.dict(exclude={"id"}))
            .execute()
        )
        return result.data[0]
    except Exception as e:
        print(f"Error creating conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/chat/conversations/{conversation_id}")
async def delete_chat_conversation(
    conversation_id: str, supabase_client: Client = Depends(get_supabase)
):
    """Delete a chat conversation and all its messages."""
    try:
        # Use service role client for deletions if available
        client_to_use = service_supabase if service_supabase else supabase_client

        # Check if conversation exists
        conversation_check = (
            client_to_use.table("chat_conversations")
            .select("id")
            .eq("id", conversation_id)
            .execute()
        )
        if not conversation_check.data:
            raise HTTPException(status_code=404, detail="Conversation not found")

        # Delete the conversation (messages will be deleted via CASCADE)
        result = (
            client_to_use.table("chat_conversations")
            .delete()
            .eq("id", conversation_id)
            .execute()
        )

        return {
            "message": "Conversation deleted successfully",
            "deleted_id": conversation_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting conversation {conversation_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete conversation: {str(e)}"
        )


@app.get(
    "/chat/conversations/{conversation_id}/messages", response_model=List[ChatMessage]
)
async def get_conversation_messages(
    conversation_id: str, supabase_client: Client = Depends(get_supabase)
):
    """Get all messages for a specific conversation."""
    try:
        result = (
            supabase_client.table("chat_messages")
            .select("*")
            .eq("conversation_id", conversation_id)
            .order("index_order")
            .execute()
        )
        return result.data
    except Exception as e:
        print(f"Error fetching messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/conversations/{conversation_id}/messages", response_model=ChatMessage)
async def add_message_to_conversation(
    conversation_id: str,
    message: ChatMessage,
    supabase_client: Client = Depends(get_supabase),
):
    """Add a message to a conversation."""
    try:
        message.conversation_id = conversation_id
        result = (
            supabase_client.table("chat_messages")
            .insert(message.dict(exclude={"id"}))
            .execute()
        )
        return result.data[0]
    except Exception as e:
        print(f"Error adding message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Update the existing chat message endpoint
@app.post("/chat/message")
async def send_chat_message(
    request_body: dict, supabase_client: Client = Depends(get_supabase)
):
    """Send a message to the AI chat system with persistence."""
    try:
        message = (request_body.get("message") or "").strip()
        # Support both the legacy `conversation_id` and the newer `thread_id` field
        conversation_id = (
            request_body.get("conversation_id") or request_body.get("thread_id") or ""
        ).strip()

        persist_messages = _is_valid_uuid(conversation_id)

        if not message:
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        if not conversation_id:
            raise HTTPException(
                status_code=400,
                detail="Conversation or thread identifier is required",
            )
        print(f"[ConstructIQ] Incoming chat message for {conversation_id}: '{message}'")
        if not persist_messages:
            print(
                f"[ConstructIQ] Conversation id '{conversation_id}' is not a UUID; "
                "skipping Supabase persistence and using ephemeral history."
            )

        backend_ready = ensure_chat_backend()
        if not backend_ready:
            print("[ConstructIQ] Chat backend not ready; operating in fallback mode")

        # Build conversation history for LangGraph
        conversation_messages: List = []
        existing_messages: List[dict] = []
        next_index = 0

        # Attempt to hydrate history from Supabase, but don't fail the request if unavailable.
        if persist_messages:
            try:
                existing_result = (
                    supabase_client.table("chat_messages")
                    .select("*")
                    .eq("conversation_id", conversation_id)
                    .order("index_order")
                    .execute()
                )
                existing_messages = existing_result.data or []
                print(
                    f"[ConstructIQ] Retrieved {len(existing_messages)} prior messages for {conversation_id}"
                )
            except Exception as db_error:
                print(f"Supabase fetch error for chat history: {db_error}")
                existing_messages = []
        else:
            existing_messages = (
                ephemeral_chat_threads.get(conversation_id, []).copy()
                if conversation_id
                else []
            )

        for msg in existing_messages:
            if msg.get("message_type") == "user":
                conversation_messages.append(
                    HumanMessage(content=msg.get("content", ""))
                )
            else:
                conversation_messages.append(AIMessage(content=msg.get("content", "")))

        conversation_messages.append(HumanMessage(content=message))
        next_index = len(existing_messages)

        # Best-effort persistence of the user message
        if persist_messages:
            try:
                # Ensure conversation exists in chat_conversations table
                conversation_check = (
                    supabase_client.table("chat_conversations")
                    .select("id")
                    .eq("id", conversation_id)
                    .execute()
                )

                if not conversation_check.data:
                    # Create new conversation with a title from the first message
                    title = message[:50] + "..." if len(message) > 50 else message
                    supabase_client.table("chat_conversations").insert(
                        {
                            "id": conversation_id,
                            "title": title,
                        }
                    ).execute()
                    print(f"[ConstructIQ] Created new conversation {conversation_id}")
                else:
                    # Update conversation timestamp
                    supabase_client.table("chat_conversations").update(
                        {"updated_at": datetime.now().isoformat()}
                    ).eq("id", conversation_id).execute()

                # Insert the user message
                supabase_client.table("chat_messages").insert(
                    {
                        "conversation_id": conversation_id,
                        "message_type": "user",
                        "content": message,
                        "index_order": next_index,
                    }
                ).execute()
                print(
                    f"[ConstructIQ] Stored user message at index {next_index} for {conversation_id}"
                )
            except Exception as db_error:
                print(f"Supabase write error for user message: {db_error}")
        else:
            thread_history = ephemeral_chat_threads.setdefault(conversation_id, [])
            thread_history.append(
                {
                    "conversation_id": conversation_id,
                    "message_type": "user",
                    "content": message,
                    "index_order": next_index,
                    "created_at": datetime.now().isoformat(),
                }
            )

        config = {"configurable": {"thread_id": conversation_id}} if chat_graph else {}

        ai_response_text: Optional[str] = None

        if chat_graph:
            try:
                for step in chat_graph.stream(
                    {"messages": conversation_messages},
                    config=config,
                    stream_mode="values",
                ):
                    if not step.get("messages"):
                        continue

                    last_message = step["messages"][-1]
                    if last_message.type == "ai" and not last_message.tool_calls:
                        ai_response_text = clean_ai_response(last_message.content)
                        print(
                            f"[ConstructIQ] Generated AI response for {conversation_id}"
                        )
                        break
            except Exception as graph_error:
                print(f"Chat graph execution error: {graph_error}")
                ai_response_text = None
        else:
            print("[ConstructIQ] Chat graph unavailable; skipping generation stage")

        ai_timestamp = datetime.now().isoformat()

        if not ai_response_text:
            ai_response_text = build_fallback_response(message)
            print(
                f"[ConstructIQ] Using fallback response for {conversation_id} (no AI output)"
            )

        # Persist AI response if we have one
        if persist_messages and ai_response_text:
            try:
                # Insert the AI message
                supabase_client.table("chat_messages").insert(
                    {
                        "conversation_id": conversation_id,
                        "message_type": "ai",
                        "content": ai_response_text,
                        "index_order": next_index + 1,
                    }
                ).execute()

                # Update conversation timestamp
                supabase_client.table("chat_conversations").update(
                    {"updated_at": datetime.now().isoformat()}
                ).eq("id", conversation_id).execute()

                print(
                    f"[ConstructIQ] Stored AI response at index {next_index + 1} for {conversation_id}"
                )
            except Exception as db_error:
                print(f"Supabase write error for AI response: {db_error}")
        elif ai_response_text:
            thread_history = ephemeral_chat_threads.setdefault(conversation_id, [])
            thread_history.append(
                {
                    "conversation_id": conversation_id,
                    "message_type": "ai",
                    "content": ai_response_text,
                    "index_order": next_index + 1,
                    "created_at": ai_timestamp,
                }
            )

        return {
            "conversation_id": conversation_id,
            "thread_id": conversation_id,
            "user_message": message,
            "ai_response": ai_response_text,
            "ai_responses": (
                [{"content": ai_response_text, "timestamp": ai_timestamp}]
                if ai_response_text
                else []
            ),
            "timestamp": ai_timestamp,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


# Remove the duplicate debug endpoint that appears twice
# Keep only one version at the end of the file

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
