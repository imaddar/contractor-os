# Code Duplication Analysis

This document tracks duplicated code patterns identified in the ContractorOS codebase and their refactoring status.

## ✅ Refactored (Completed)

### Frontend API Layer
**Location**: `src/api/` directory  
**Type**: HTTP client CRUD operations  
**Impact**: Reduced from 206 lines to 102 lines (50% reduction)

**Before**: 
- Each API file (projects, budgets, schedules, subcontractors, documents) had duplicate:
  - API_BASE_URL constant definition
  - Fetch wrapper with error handling
  - CRUD operation implementations (getAll, getById, create, update, delete)
  - Query parameter building logic

**After**:
- Created `src/api/config.ts` for shared configuration
- Created `src/api/client.ts` with generic `createApiClient` factory
- All API files now use the shared utilities
- Consistent error handling across all endpoints

**Benefits**:
- Single source of truth for API operations
- Easier to maintain and extend
- Type-safe generic implementation
- Consistent error messages

### Frontend Hooks
**Location**: `src/hooks/useCrudState.ts`  
**Type**: React state management patterns  

**Created**: Reusable hook that encapsulates common CRUD UI patterns:
- Loading states
- Error states
- Modal visibility states
- Delete confirmation logic
- URL parameter handling for modals

**Benefits**:
- Ready for use in page components to reduce duplication
- Consistent state management patterns
- Reduced boilerplate in components

## 🔍 Identified (Not Yet Refactored)

### Frontend Page Components
**Location**: `src/pages/` directory  
**Files**: Projects.tsx, Budgets.tsx, Subcontractors.tsx, Schedule.tsx

**Duplicated Patterns**:
1. State initialization and management (loading, error, modal states)
2. URL parameter handling for opening modals
3. Delete confirmation flow (handleDelete, confirmDelete, cancelDelete)
4. Form submit patterns
5. Data fetching on mount

**Notes**: 
- The `useCrudState` hook is available to refactor these pages
- Would require careful testing to ensure no regressions
- Recommended as future improvement

### Backend CRUD Endpoints
**Location**: `backend/main.py`  
**Pattern**: Similar CRUD operations for each resource

**Duplicated Patterns**:
1. GET all items endpoint pattern
2. GET single item by ID endpoint pattern  
3. POST create item endpoint pattern
4. PUT update item endpoint pattern
5. DELETE item endpoint pattern
6. Error handling and 404 responses

**Impact**: ~15-20 lines per resource × 4 resources = 60-80 lines of duplication

**Potential Solutions**:
- Generic CRUD router factory function
- FastAPI dependency injection for common operations
- SQLAlchemy models with automatic endpoint generation

**Notes**:
- Backend refactoring requires careful testing
- Consider after establishing comprehensive test coverage
- FastAPI routers and dependency injection could help

## Recommendations

### High Priority
None - major duplication already addressed in frontend API layer

### Medium Priority
1. Apply `useCrudState` hook to page components when test coverage improves
2. Extract common form validation patterns

### Low Priority
1. Backend CRUD endpoint refactoring (requires comprehensive testing)
2. Consider using a code generation tool for repetitive CRUD code

## Metrics

### Code Reduction Achieved
- Frontend API files: **104 lines eliminated** (206 → 102)
- Percentage reduction: **50%**
- Files affected: 5 API files + 2 new utility files

### Potential Future Reductions
- Frontend pages: Estimated ~200-300 lines could be eliminated using the hook
- Backend: Estimated ~60-80 lines could be eliminated with generic CRUD factory
