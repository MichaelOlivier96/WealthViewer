import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const start = async () => {
  try {
    const sqlite3 = await sqlite3InitModule({
      print: console.log,
      printErr: console.error,
    });

    if (sqlite3.oo1 && sqlite3.oo1.OpfsDb) {
      let db = new sqlite3.oo1.OpfsDb('/budget.db');

      const runMigrations = (currentDb) => {
        currentDb.exec(`
          PRAGMA foreign_keys = ON;
          CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY
          );
        `);

        let currentVersion = 0;
        const versionRow = currentDb.selectValues('SELECT version FROM schema_version');
        if (versionRow.length > 0) {
          currentVersion = versionRow[0];
        }

        const migrations = [
          {
            version: 1,
            sql: `
              CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                account_type TEXT,
                current_balance DECIMAL DEFAULT 0
              );
              CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                budget_limit DECIMAL DEFAULT 0
              );
              CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                raw_description TEXT NOT NULL,
                cleaned_description TEXT,
                amount DECIMAL NOT NULL,
                category_id INTEGER,
                account_id TEXT NOT NULL,
                is_verified INTEGER DEFAULT 0,
                FOREIGN KEY(category_id) REFERENCES categories(id),
                FOREIGN KEY(account_id) REFERENCES accounts(id),
                UNIQUE(date, amount, raw_description)
              );
              INSERT OR IGNORE INTO categories (name) VALUES ('Uncategorized');
              INSERT OR IGNORE INTO accounts (id, name, type) VALUES ('default_account', 'Main Account', 'checkings');
            `
          },
          {
            version: 2,
            sql: `
              CREATE TABLE IF NOT EXISTS category_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                keyword TEXT UNIQUE NOT NULL,
                category_id INTEGER NOT NULL,
                FOREIGN KEY(category_id) REFERENCES categories(id)
              );
            `
          },
          {
            version: 3,
            sql: `
              INSERT OR IGNORE INTO categories (name) VALUES ('Groceries');
              INSERT OR IGNORE INTO categories (name) VALUES ('Rent/Mortgage');
              INSERT OR IGNORE INTO categories (name) VALUES ('Utilities');
              INSERT OR IGNORE INTO categories (name) VALUES ('Salary');
              INSERT OR IGNORE INTO categories (name) VALUES ('Transport');
              INSERT OR IGNORE INTO categories (name) VALUES ('Dining Out');
            `
          },
          {
            version: 4,
            sql: `
              INSERT OR IGNORE INTO accounts (id, name, type) VALUES ('default_account', 'Main Account', 'checkings');
            `
          },
          {
            version: 5,
            sql: `
              ALTER TABLE transactions ADD COLUMN is_transfer INTEGER DEFAULT 0;
              INSERT OR IGNORE INTO categories (name) VALUES ('Transfers');
              INSERT OR IGNORE INTO categories (name) VALUES ('Card Repayments');
            `
          },
          {
            version: 6,
            sql: `
              ALTER TABLE accounts ADD COLUMN previous_balance DECIMAL DEFAULT 0;
            `
          },
          {
            version: 7,
            sql: `
              ALTER TABLE categories ADD COLUMN type TEXT DEFAULT 'expense';
            `
          }
        ];

        for (const m of migrations) {
          if (m.version > currentVersion) {
            console.log(`Running migration to version ${m.version}...`);
            currentDb.exec(m.sql);
            currentDb.exec('DELETE FROM schema_version');
            currentDb.exec('INSERT INTO schema_version (version) VALUES (?)', { bind: [m.version] });
            currentVersion = m.version;
          }
        }
      };

      runMigrations(db);

      self.onmessage = async (event) => {
        const { type, payload, id } = event.data;
        try {
          let result;
          switch (type) {
            case 'exec':
              result = db.exec(payload.sql, {
                bind: payload.params,
                returnValue: 'resultRows',
                rowMode: 'object',
              });
              break;
            case 'query':
              result = db.selectObjects(payload.sql, payload.params);
              break;
            case 'export':
              result = sqlite3.capi.sqlite3_js_db_export(db.pointer);
              break;
            case 'import':
              db.close();
              const root = await navigator.storage.getDirectory();
              const fileHandle = await root.getFileHandle('budget.db', {create: true});
              const writable = await fileHandle.createSyncAccessHandle();
              writable.truncate(0);
              writable.write(new Uint8Array(payload.buffer));
              writable.flush();
              writable.close();
              db = new sqlite3.oo1.OpfsDb('/budget.db');
              runMigrations(db);
              result = { success: true };
              break;
            default:
              throw new Error(`Unknown message type: ${type}`);
          }
          self.postMessage({ id, result });
        } catch (error) {
          self.postMessage({ id, error: { message: error.message } });
        }
      };
      self.postMessage({ type: 'ready' });
    }
  } catch (err) {
    self.postMessage({ type: 'error', error: err.message });
  }
};

start();
