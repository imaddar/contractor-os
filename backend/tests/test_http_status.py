import os
import sys
import types
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

# Ensure required Supabase environment variables are present before the backend imports
os.environ.setdefault("SUPABASE_URL", "http://test.local")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")

# Provide lightweight stubs for optional dependencies that are not required for these tests.
def _stub_module(
    name: str, attrs: dict | None = None, *, is_pkg: bool = False
) -> types.ModuleType:
    module = sys.modules.get(name)
    if module is None:
        module = types.ModuleType(name)
        if is_pkg:
            module.__path__ = []  # Mark as package so submodule imports succeed
        sys.modules[name] = module
    if attrs:
        for key, value in attrs.items():
            setattr(module, key, value)
    return module


langchain_community_pkg = _stub_module("langchain_community", is_pkg=True)
_stub_module(
    "langchain_community.document_loaders",
    {"PyPDFLoader": object},
    is_pkg=True,
)
setattr(
    langchain_community_pkg,
    "document_loaders",
    sys.modules["langchain_community.document_loaders"],
)
_stub_module(
    "langchain_community.vectorstores",
    {"SupabaseVectorStore": object},
    is_pkg=True,
)
setattr(
    langchain_community_pkg,
    "vectorstores",
    sys.modules["langchain_community.vectorstores"],
)
_stub_module(
    "langchain_text_splitters",
    {"CharacterTextSplitter": object},
    is_pkg=True,
)
_stub_module(
    "langchain_huggingface",
    {"HuggingFaceEmbeddings": object},
)
_stub_module(
    "langchain_ollama",
    {"ChatOllama": object},
)
_stub_module(
    "langchain_core.tools",
    {
        "tool": lambda *args, **kwargs: (lambda func: func),
    },
)
messages_module = _stub_module("langchain_core.messages")
for cls_name in ("SystemMessage", "HumanMessage", "AIMessage"):
    setattr(messages_module, cls_name, type(cls_name, (), {}))

langchain_core_pkg = _stub_module("langchain_core", is_pkg=True)
setattr(
    langchain_core_pkg,
    "tools",
    sys.modules["langchain_core.tools"],
)
setattr(
    langchain_core_pkg,
    "messages",
    messages_module,
)

# Ensure repository root is on sys.path so `import backend` succeeds.
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


class _StubSupabaseTable:
    def select(self, *_args, **_kwargs):
        return self

    def update(self, *_args, **_kwargs):
        return self

    def delete(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=[])


class _StubSupabaseClient:
    def table(self, _name: str):
        return _StubSupabaseTable()


_stub_module(
    "supabase",
    {
        "Client": type("Client", (), {}),
        "create_client": lambda *_args, **_kwargs: _StubSupabaseClient(),
    },
)

graph_module = _stub_module(
    "langgraph.graph",
    {
        "MessagesState": type("MessagesState", (), {}),
        "StateGraph": type("StateGraph", (), {}),
        "END": object(),
    },
    is_pkg=True,
)
_stub_module(
    "langgraph.prebuilt",
    {
        "ToolNode": type("ToolNode", (), {}),
        "tools_condition": lambda _: None,
    },
    is_pkg=True,
)
_stub_module(
    "langgraph.checkpoint",
    is_pkg=True,
)
_stub_module(
    "langgraph.checkpoint.memory",
    {"MemorySaver": type("MemorySaver", (), {})},
    is_pkg=True,
)
langgraph_pkg = _stub_module("langgraph", is_pkg=True)
setattr(
    langgraph_pkg,
    "graph",
    sys.modules["langgraph.graph"],
)
setattr(
    langgraph_pkg,
    "prebuilt",
    sys.modules["langgraph.prebuilt"],
)
setattr(
    langgraph_pkg,
    "checkpoint",
    sys.modules["langgraph.checkpoint"],
)
setattr(
    sys.modules["langgraph.checkpoint"],
    "memory",
    sys.modules["langgraph.checkpoint.memory"],
)

from backend.main import app, get_supabase  # noqa: E402


class EmptySupabaseTable:
    """Stub Supabase table that always returns no rows."""

    def select(self, *_args, **_kwargs):
        return self

    def update(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=[])


class EmptySupabaseClient:
    """Stub Supabase client wired into the FastAPI dependency."""

    def table(self, _name: str):
        return EmptySupabaseTable()


@pytest.fixture()
def client():
    app.dependency_overrides[get_supabase] = lambda: EmptySupabaseClient()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_supabase, None)


def test_get_missing_project_returns_404(client: TestClient):
    response = client.get("/projects/123")
    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_get_missing_subcontractor_returns_404(client: TestClient):
    response = client.get("/subcontractors/456")
    assert response.status_code == 404
    assert response.json()["detail"] == "Subcontractor not found"


def test_get_missing_budget_returns_404(client: TestClient):
    response = client.get("/budgets/789")
    assert response.status_code == 404
    assert response.json()["detail"] == "Budget not found"


def test_update_missing_project_returns_404(client: TestClient):
    payload = {"name": "Updated Tower", "status": "active"}
    response = client.put("/projects/321", json=payload)
    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_update_missing_subcontractor_returns_404(client: TestClient):
    payload = {"name": "Jane Doe", "specialty": "Electrical"}
    response = client.put("/subcontractors/654", json=payload)
    assert response.status_code == 404
    assert response.json()["detail"] == "Subcontractor not found"


def test_update_missing_budget_returns_404(client: TestClient):
    payload = {
        "project_id": 1,
        "category": "Labor",
        "budgeted_amount": 5000.0,
        "actual_amount": 4500.0,
    }
    response = client.put("/budgets/987", json=payload)
    assert response.status_code == 404
    assert response.json()["detail"] == "Budget not found"
