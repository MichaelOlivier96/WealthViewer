# WealthViewer

A 100% offline, privacy-first personal finance tracker.

WealthViewer runs entirely on your local machine. All bank statements and transaction data stay in your local vault without sending any telemetry, metrics, or financial data to the cloud.

---

## Downloads

Prebuilt desktop binaries for Linux, Windows, and macOS are available on the [Releases](https://github.com/MichaelOlivier96/WealthViewer/releases) page.

---

## Supported Statement Formats

- **FNB (First National Bank)** — PDF statements (processed client-side via coordinate mapping)
- **ABSA** — CSV statements
- **Custom CSV** — User-configurable CSV column mapping

---

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Recharts
- **State Management**: Zustand
- **Storage**: SQLite (WASM / OPFS)
- **Desktop Runtime**: Electron & Capacitor
- **Parsing**: PDF.js, PapaParse

---

## Developer Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm`

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/MichaelOlivier96/WealthViewer.git
   cd WealthViewer
   ```

2. Install root dependencies:
   ```bash
   npm install
   ```

3. Install Electron dependencies:
   ```bash
   cd electron && npm install && cd ..
   ```

### Development

Run the Vite development server for web UI testing:
```bash
npm run dev
```

Run the Electron desktop app in development:
```bash
cd electron
npm run electron:start
```

### Production Build

1. Build the web application:
   ```bash
   npm run build
   ```

2. Build and package the Electron desktop application:
   ```bash
   cd electron
   npm run build
   npm run electron:pack
   ```

Packaged binaries and installers will be generated in `electron/dist/`.

---

## License

This project is licensed under the [MIT License](LICENSE).
