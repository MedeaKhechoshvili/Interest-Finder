# InterestFinder

COMPE 561 term project for discovering and organizing interests across movies, books, music, and attractions.

## Project Overview

InterestFinder helps users discover things they may enjoy, save items for later, track completed items, and share ratings and reviews.

The approved interface includes:

- Home
- Discover
- Detail
- My Lists
- Log In
- Sign Up

Users can organize saved items into planned and completed lists. Completed items can be rated and reviewed.

## Design Direction

The interface follows a forest-green and cream editorial visual identity. The desktop and responsive mobile designs were created in Figma and will guide the React implementation.

## Development Plan

1. Front-end design and responsive layout
2. React implementation
3. Backend development
4. Database and API integration
5. Testing and deployment

## Team Workflow

Work is organized through GitHub Issues, milestones, and the Interest Finder Project Board. Feature work should be completed on a separate branch and submitted through a pull request for review before merging into the main branch.

## Backend Development

The backend uses Python FastAPI, SQLAlchemy, SQLite, and Pydantic settings. The API is versioned under `/api/v1` and returns JSON responses. The current foundation includes the application entry point, configuration, database session setup, CORS, request IDs, safe request logging, shared error responses, a health endpoint, and smoke tests.

### Local setup

1. Create and activate a virtual environment:

   ```bash
   python -m venv .venv
   ```

   On Windows PowerShell:

   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```

   On macOS or Linux:

   ```bash
   source .venv/bin/activate
   ```

2. Install the project and development dependencies:

   ```bash
   python -m pip install --upgrade pip
   python -m pip install -e ".[dev]"
   ```

3. Copy `.env.example` to `.env` and replace the local JWT placeholder. Do not commit `.env`, API keys, passwords, or database files.

4. Start the API:

   ```bash
   uvicorn app.main:app --reload --app-dir src
   ```

5. Open the local documentation:

   - Swagger UI: `http://localhost:8000/docs`
   - ReDoc: `http://localhost:8000/redoc`
   - Health check: `http://localhost:8000/api/v1/health`

### Tests

Run the automated tests from the repository root:

```bash
pytest
```
 
