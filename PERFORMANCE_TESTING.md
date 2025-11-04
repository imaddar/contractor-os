# Performance Testing Guide

This guide helps you verify and measure the performance improvements made in this PR.

## Prerequisites

- Node.js and npm installed
- Python 3.x with pip
- Backend dependencies installed (`pip install -r backend/requirements.txt`)
- Supabase instance configured

## Testing the Improvements

### 1. Frontend - Dashboard API Optimization

**Before (baseline - check out main branch):**
```bash
git checkout main
npm install
npm run dev
```

Open browser DevTools (F12) → Network tab:
- Navigate to http://localhost:5173
- Observe 4 separate API calls:
  - GET /projects
  - GET /schedules  
  - GET /budgets
  - GET /subcontractors

**After (this PR):**
```bash
git checkout copilot/improve-code-efficiency
npm run dev
```

Open browser DevTools → Network tab:
- Navigate to http://localhost:5173
- Observe 2 API calls:
  - GET /dashboard/summary
  - GET /schedules

**Expected Result:** 50% reduction in network requests (4 → 2)

### 2. Frontend - Calendar Component Performance

**Setup:**
Create test data with multiple schedules spanning different dates.

**Testing:**
```bash
npm run dev
```

1. Open React DevTools Profiler
2. Navigate to /schedule
3. Switch between months using navigation buttons
4. Observe render times in Profiler

**Expected Result:** 
- Minimal re-render time when switching months
- No repeated filtering visible in Profiler
- Consistent performance even with 100+ schedules

**Comparison Points:**
- Check out main branch and repeat
- Compare Profiler timings

### 3. Backend - Embeddings Lazy Loading

**Before:**
```bash
git checkout main
cd backend
time uvicorn main:app --reload
```

Observe: Startup includes "Embeddings model initialized" message

**After:**
```bash
git checkout copilot/improve-code-efficiency
cd backend  
time uvicorn main:app --reload
```

Observe: 
- Startup is faster (2-5 seconds improvement)
- "Embeddings model initialized" appears only when uploading first PDF

**Expected Result:** 2-5 second reduction in server startup time

### 4. End-to-End Performance Test

**Test Scenario:**
1. Start fresh session
2. Measure dashboard load time
3. Navigate to calendar with 50+ events
4. Test month navigation responsiveness

**Metrics to Record:**
```
Dashboard Load Time: _____ ms
First API Response: _____ ms
Calendar Render: _____ ms
Month Navigation: _____ ms
```

## Automated Performance Testing

### Frontend Performance

Create a simple performance test:

```typescript
// src/test/performance.test.ts
import { describe, it, expect } from 'vitest';
import { dashboardApi } from '../api/dashboard';

describe('Dashboard API Performance', () => {
  it('should fetch summary in reasonable time', async () => {
    const start = performance.now();
    await dashboardApi.getSummary();
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(1000); // Should complete in < 1s
  });
});
```

Run with:
```bash
npm test
```

### Backend Performance

Create a simple load test:

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test dashboard endpoint
ab -n 100 -c 10 http://localhost:8000/dashboard/summary

# Compare with individual endpoints
ab -n 100 -c 10 http://localhost:8000/projects
```

## Performance Benchmarks

Record your measurements:

### Dashboard Page Load
- **Before:** ___ requests, ___ ms total
- **After:** ___ requests, ___ ms total
- **Improvement:** ___ %

### Calendar Rendering (100 events)
- **Before:** ___ ms per month navigation
- **After:** ___ ms per month navigation
- **Improvement:** ___ %

### Server Startup
- **Before:** ___ seconds
- **After:** ___ seconds
- **Improvement:** ___ seconds saved

## Troubleshooting

### Frontend not showing improvements
- Clear browser cache (Ctrl+Shift+Del)
- Hard reload (Ctrl+F5)
- Check Network tab is not throttled

### Backend embeddings loading early
- Check for PDF upload tests in startup
- Verify no code is calling get_embeddings() at module level

### Performance worse than expected
- Check for browser extensions interfering
- Verify backend is running without debug mode
- Ensure database is properly indexed

## Best Practices

1. **Consistent Test Environment:**
   - Same hardware
   - Same browser version
   - Same dataset size
   - Close other applications

2. **Multiple Runs:**
   - Run tests 3-5 times
   - Use median value
   - Warm up with 1-2 trial runs

3. **Real-World Data:**
   - Test with realistic data volumes
   - Include edge cases (empty, very large)

## Reporting Results

When reporting performance improvements:

1. Include environment details (OS, browser, Node version)
2. Show before/after measurements
3. Note any anomalies or outliers
4. Include screenshots of DevTools

Example Report:
```
Environment:
- OS: Ubuntu 22.04
- Browser: Chrome 120
- Node: 20.10.0
- Data: 25 projects, 150 schedules

Results:
- Dashboard load: 450ms → 180ms (60% faster)
- Calendar render: 120ms → 35ms (71% faster)
- Server startup: 4.2s → 1.1s (74% faster)
```
