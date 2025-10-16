from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from typing import List, Optional
from pydantic import BaseModel
import uvicorn
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import CharacterTextSplitter
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
import tempfile
import os as file_os
from datetime import datetime

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

# Initialize embeddings for RAG
try:
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-mpnet-base-v2")
    print("Embeddings model initialized")
except Exception as e:
    print(f"Warning: Could not initialize embeddings model: {e}")
    embeddings = None

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
        print("Using {'service role' if service_supabase else 'anon'} client for deletion")
        
        # First check if project exists
        project_check = client_to_use.table("projects").select("id").eq("id", project_id).execute()
        if not project_check.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        print(f"Attempting to delete project {project_id}")
        
        # Delete related schedules first
        try:
            schedules_result = client_to_use.table("schedules").delete().eq("project_id", project_id).execute()
            print(f"Schedules deletion result count: {len(schedules_result.data) if schedules_result.data else 0}")
        except Exception as schedule_error:
            print(f"Error deleting schedules: {str(schedule_error)}")
        
        # Delete related budgets
        try:
            budgets_result = client_to_use.table("budgets").delete().eq("project_id", project_id).execute()
            print(f"Budgets deletion result count: {len(budgets_result.data) if budgets_result.data else 0}")
        except Exception as budget_error:
            print(f"Error deleting budgets: {str(budget_error)}")
        
        # Finally delete the project
        result = client_to_use.table("projects").delete().eq("id", project_id).execute()
        print(f"Project deletion successful")
        
        return {"message": "Project and related data deleted successfully", "deleted_id": project_id}
        
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
        # Use service role client for deletions if available
        client_to_use = service_supabase if service_supabase else supabase_client
        
        # First check if subcontractor exists
        subcontractor_check = client_to_use.table("subcontractors").select("id").eq("id", subcontractor_id).execute()
        if not subcontractor_check.data:
            raise HTTPException(status_code=404, detail="Subcontractor not found")
        
        # Update schedules to remove the subcontractor assignment
        try:
            update_result = client_to_use.table("schedules").update({"assigned_to": None}).eq("assigned_to", subcontractor_id).execute()
            print(f"Updated schedules to remove subcontractor assignment")
        except Exception as update_error:
            print(f"Error updating schedules: {str(update_error)}")
        
        # Then delete the subcontractor
        result = client_to_use.table("subcontractors").delete().eq("id", subcontractor_id).execute()
        print(f"Subcontractor deletion successful")
        
        return {"message": "Subcontractor deleted successfully", "deleted_id": subcontractor_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting subcontractor {subcontractor_id}: {str(e)}")
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
        # Use service role client for deletions if available
        client_to_use = service_supabase if service_supabase else supabase_client
        
        # First check if schedule exists
        schedule_check = client_to_use.table("schedules").select("id").eq("id", schedule_id).execute()
        if not schedule_check.data:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Delete the schedule
        result = client_to_use.table("schedules").delete().eq("id", schedule_id).execute()
        print(f"Schedule deletion result: {result}")
        
        # Supabase delete returns empty data array when successful, so we just check for no error
        return {"message": "Schedule deleted successfully", "deleted_id": schedule_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting schedule {schedule_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete schedule: {str(e)}")

# Document endpoints
@app.get("/documents", response_model=List[Document])
async def get_documents(supabase_client: Client = Depends(get_supabase)):
    try:
        # Get unique documents from the vector store by grouping by filename
        result = supabase_client.table("documents").select("metadata").execute()
        
        # Group by filename to get unique documents
        documents_dict = {}
        for row in result.data:
            metadata = row.get('metadata', {})
            filename = metadata.get('filename')
            
            # Skip documents with invalid or missing filenames
            if not filename or filename == 'Unknown' or filename.strip() == '':
                continue
                
            if filename not in documents_dict:
                documents_dict[filename] = {
                    'id': f"{filename}_{metadata.get('upload_timestamp', 'unknown')}",
                    'filename': filename,
                    'content': f"Document stored as chunks for semantic search",
                    'file_size': metadata.get('file_size'),
                    'page_count': metadata.get('page_count'),
                    'chunk_count': 1,
                    'uploaded_at': metadata.get('upload_timestamp'),
                    'created_at': metadata.get('upload_timestamp'),
                    'updated_at': metadata.get('upload_timestamp')
                }
            else:
                # Increment chunk count for duplicate filenames
                documents_dict[filename]['chunk_count'] += 1
        
        return list(documents_dict.values())
    except Exception as e:
        print(f"Error fetching documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents/{filename}")
async def get_document_by_filename(filename: str, supabase_client: Client = Depends(get_supabase)):
    try:
        # Validate filename
        if not filename or filename == 'Unknown' or filename.strip() == '':
            raise HTTPException(status_code=400, detail="Invalid filename provided")
            
        print(f"Fetching document with filename: {filename}")
        
        # Get all chunks for this filename
        result = supabase_client.table("documents").select("*").eq("metadata->>filename", filename).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail=f"Document with filename '{filename}' not found")
        
        # Get metadata from first chunk
        first_chunk = result.data[0]
        metadata = first_chunk.get('metadata', {})
        
        # Get full document text from metadata
        full_document_text = metadata.get('full_document_text', '')
        
        # If no full text in metadata, combine chunks as fallback
        if not full_document_text:
            full_document_text = "\n\n".join([chunk.get('content', '') for chunk in result.data])
        
        return {
            'id': f"{filename}_{metadata.get('upload_timestamp', 'unknown')}",
            'filename': filename,
            'content': full_document_text,
            'file_size': metadata.get('file_size'),
            'page_count': metadata.get('page_count'),
            'chunk_count': len(result.data),
            'uploaded_at': metadata.get('upload_timestamp'),
            'created_at': metadata.get('upload_timestamp'),
            'updated_at': metadata.get('upload_timestamp')
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching document {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch document: {str(e)}")

@app.delete("/documents/{filename}")
async def delete_document_by_filename(filename: str, supabase_client: Client = Depends(get_supabase)):
    try:
        # Validate filename
        if not filename or filename == 'Unknown' or filename.strip() == '':
            raise HTTPException(status_code=400, detail="Invalid filename provided")
            
        # Use service role client for deletions if available
        client_to_use = service_supabase if service_supabase else supabase_client
        
        print(f"Attempting to delete document: {filename}")
        
        # Check if document exists
        document_check = client_to_use.table("documents").select("id").eq("metadata->>filename", filename).execute()
        if not document_check.data:
            raise HTTPException(status_code=404, detail=f"Document with filename '{filename}' not found")
        
        # Delete all chunks for this filename
        result = client_to_use.table("documents").delete().eq("metadata->>filename", filename).execute()
        deleted_count = len(result.data) if result.data else 0
        
        print(f"Deleted {deleted_count} chunks for document: {filename}")
        
        return {"message": f"Document '{filename}' and all {deleted_count} chunks deleted successfully", "deleted_filename": filename}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting document {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")

# Document parsing endpoint (updated for RAG-style chunking)
@app.post("/parse-document")
async def parse_document(file: UploadFile = File(...), supabase_client: Client = Depends(get_supabase)):
    print(f"Starting document parsing for file: {file.filename}")
    
    if not file.filename or not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    if not embeddings:
        print("Error: Embeddings model not available")
        raise HTTPException(status_code=500, detail="Embeddings model not available")
    
    temp_file_path = None
    try:
        print("Creating temporary file...")
        # Create a temporary file to store the uploaded PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
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
            raise HTTPException(status_code=400, detail="No content could be extracted from the PDF")
        
        # Combine all pages into full document text for viewing
        full_document_text = "\n\n".join([doc.page_content for doc in documents])
        
        # Split documents into chunks
        print("Splitting documents into chunks...")
        text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        docs = text_splitter.split_documents(documents)
        print(f"Document split into {len(docs)} chunks")
        
        if not docs:
            raise HTTPException(status_code=400, detail="Document could not be split into chunks")
        
        # Add comprehensive metadata to each chunk
        print("Adding metadata to chunks...")
        upload_timestamp = datetime.now().isoformat()
        for i, doc in enumerate(docs):
            doc.metadata.update({
                "filename": file.filename,
                "upload_timestamp": upload_timestamp,
                "file_size": len(content),
                "page_count": len(documents),
                "chunk_index": i,
                "total_chunks": len(docs),
                "full_document_text": full_document_text  # Store full text in metadata
            })
        
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
            "updated_at": upload_timestamp
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error during document processing: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to parse document: {str(e)}")
    finally:
        # Make sure to clean up temp file even if there's an error
        if temp_file_path and file_os.path.exists(temp_file_path):
            try:
                file_os.unlink(temp_file_path)
                print("Temporary file cleaned up")
            except Exception as cleanup_error:
                print(f"Failed to cleanup temp file: {cleanup_error}")

# Add endpoint for semantic search
@app.post("/documents/search")
async def search_documents(request_body: dict, supabase_client: Client = Depends(get_supabase)):
    if not embeddings:
        raise HTTPException(status_code=500, detail="Embeddings model not available")
    
    try:
        query = request_body.get("query", "")
        limit = request_body.get("limit", 5)
        
        if not query.strip():
            raise HTTPException(status_code=400, detail="Query cannot be empty")
        
        vector_store = SupabaseVectorStore(
            client=service_supabase if service_supabase else supabase_client,
            embedding=embeddings,
            table_name="documents",
            query_name="match_documents"
        )
        
        matched_docs = vector_store.similarity_search(query, k=limit)
        
        results = []
        for doc in matched_docs:
            results.append({
                "content": doc.page_content,
                "metadata": doc.metadata,
                "filename": doc.metadata.get("filename", "Unknown")
            })
        
        return {"query": query, "results": results}
        
    except Exception as e:
        print(f"Search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

# Remove the duplicate debug endpoint that appears twice
# Keep only one version at the end of the file

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
