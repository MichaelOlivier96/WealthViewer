Implementation Plan - Aura Finance
Build a premium, high-performance personal finance tracking application with a modern dashboard and smart data import capabilities.

User Review Required
IMPORTANT

Persistence: We will use SQLite-Wasm (OPFS) for relational data management. This ensures high durability and performance for local-first storage. Desktop Environment: The app will be wrapped using Capacitor + Electron to provide a strictly offline desktop experience. PDF Extraction: FNB ingestion will utilize pdf.js to replicate Camelot's spatial (coordinate-based) extraction logic, ensuring accuracy without relying on pre-converted CSVs.

Proposed Changes
1. Project Initialization & Architecture
Initialize a Vite + React project.
Configure Capacitor with the Electron platform.
Set up SQLite-Wasm with Origin Private File System (OPFS) for persistent, relational storage.
State Management: Use Zustand for a "Staging Area" temporal state, ensuring that parsed data is only committed to the database after user review.
Implement a robust CSS design system (colors, typography, spacing) tailored for a premium desktop app.
2. Core Logic & Data Ingestion
sqliteClient.js: Database initialization with specific schema:
Transactions: id, date, description, amount, is_transfer (BOOLEAN), category, account_id.
Accounts: id, name, account_currency (TEXT, default 'ZAR'), closing_balance_at_import (DECIMAL).
fnbProcessor.js: PDF coordinate-based extraction using pdf.js (porting spatial logic from camelot_fnb_savings.py).
absaProcessor.js: CSV parsing logic (porting from camelot_absa.py).
validationEngine.js: Logic to compare extracted transaction totals against the statement's final balance.
3. Components (Recharts Integration)
Layout: Sidebar navigation (Dashboard, Transactions, Accounts, Import).
Dashboard: High-level stats using Recharts for responsive, glassmorphism-compatible visuals.
TransactionList: Virtualized table for high-performance viewing of SQLite records.
ImportSection:
Drag-and-drop PDF/CSV upload.
'Review & Confirm' Step: Visual grid showing extracted data with a balance validation check.
4. Styling
Use a "Glassmorphism" design with a dark mode aesthetic.
CSS Variables for easy theme management.
Subtle animations using CSS transitions.
Verification Plan
Automated Tests
Browser-based validation of the import flow using the browser subagent.
Manual Verification
Upload a sample CSV to verify correct parsing and categorization.
Check responsiveness across different screen sizes.
Verify data persistence after page refresh.