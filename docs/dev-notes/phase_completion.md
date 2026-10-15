Phase 1: The Foundation (Environment & Storage)

Objective: Establish the local vault and the project skeleton.

    Task 1.1: Project Scaffolding: Initialize Vite + React and install Capacitor. [x]

        Input: Basic dependencies (Zustand, Recharts, Lucide-react).

        Output: A running "Hello World" desktop window via Electron.

    Task 1.2: The SQLite Engine: Create the sqliteClient.js. [x]

        Input: SQL schema (Transactions, Accounts, Categories).

        Output: A persistent database file in the browser's OPFS that survives refreshes.

Phase 2: The Ingestion Engine (The "Translators") [x]
 
 Objective: Convert your specific bank statements into raw data.
 
     Task 2.1: FNB PDF Worker: Build the fnbProcessor.js using pdf.js. [x]
 
         Input: Porting spatial logic from your camelot_fnb_savings.py.
 
         Output: A function that takes a PDF and returns a JSON array of transactions.
 
     Task 2.2: ABSA CSV Parser: Build the absaProcessor.js using PapaParse. [x]
 
         Input: Logic from camelot_absa.py.
 
         Output: A unified JSON format that matches the FNB output.
 
Phase 3: The "Staging Area" (Zustand Logic) [x]
 
 Objective: Create the "Review & Confirm" logic to ensure data accuracy.
 
     Task 3.1: The Staging Store: Initialize a Zustand store. [x]
 
         Logic: It holds "Incoming" transactions that haven't hit the database yet.
 
     Task 3.2: Validation Engine: Create validationEngine.js. [x]
 
         Logic: Compares Sum(Transaction Amounts) against the Closing Balance found in the statement metadata.
 
         Output: A "Match" or "Error" flag for the user.
 
Phase 4: UI & Visualization (The User Experience) [x]
 
 Objective: Build the glassmorphism interface and the dashboard.
 
     Task 4.1: The Transaction Ledger: Create the virtualized list component. [x]
 
         Feature: Search and filter functionality. (Performance priority)
 
     Task 4.2: The Analytics Dashboard: Integrate Recharts. [x]
 
         Metrics: Net worth trend, monthly spending pie chart, and income vs. expense bars.
 
     Task 4.3: Rules Manager UI: Allow users to define categorization keywords. [x]
 
     Task 4.4: Account Manager UI: Manage multiple accounts (Savings, Credit, etc.). [x]
 
Phase 5: Hardening & Desktop Packaging [x]
 
 Objective: Lock down the app for 100% offline use and cross-device portability.
 
     Task 5.1: Electron Lockdown: Configure the Electron main.js.
 
     Task 5.2: Final Integration: Connect the "Import" button to the "Processors".
 
     Task 5.3: Persistence Hardening: Ensure OPFS maps to a physical file on disk (True Local). [NEW]
 
     Task 5.4: Portability: Implement Backup/Export (JSON/SQLite) for data migration. [NEW]

---

*Ongoing: Bank Statement Flexibility Refinement - Iteratively improving PDF processors for new bank formats.*