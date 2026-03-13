# ContractFlow — Smart Contract Management Platform

A production-ready web platform for managing contract templates, generating filled contracts (PDF & DOCX), and maintaining a complete audit trail.

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+
- *(Optional but recommended)* LibreOffice — for best-quality PDF generation

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up the Database & Seed Data

```bash
npm run seed
```

This will:
- Create the SQLite database at `./database/database.sqlite`
- Create initial users, categories, and a sample template with yellow-highlighted fields
- Generate `storage/templates/<id>/1/template.docx` — a working sample DOCX file

### 3. Start the App

```bash
npm run dev
```

This starts both the backend (port 3001) and frontend (port 5173) concurrently.

Open: **http://localhost:5173**

### Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@company.com` | `Admin1234!` |
| User (Alisa) | `alisa@company.com` | `User1234!` |

---

## Docker (One Command)

```bash
docker-compose up
```

- Frontend at: http://localhost:80
- Backend at: http://localhost:3001

> **Note:** LibreOffice is installed in the Docker image for high-quality PDF generation.

---

## How It Works

### The Yellow Field System

1. Create a Word (DOCX) document
2. Highlight any text you want to become a fillable field with **yellow background** (Format → Text Highlight Color → Yellow in Microsoft Word)
3. Upload the DOCX to ContractFlow at `/templates/upload`
4. The platform automatically detects all yellow-highlighted text as fields
5. When Alisa opens the platform, she selects a template, fills in a clean form, and downloads a professional PDF/DOCX

### Roles

- **Admin**: Full access — upload templates, configure fields, manage users, view all contracts
- **User**: Can create contracts from available templates and view their own contracts

### Field Type Detection

Fields are automatically typed based on their highlighted text:

| Keyword | Type |
|---------|------|
| `date`, `datum`, `határidő` | Date picker |
| `amount`, `összeg`, `price`, `ár`, `fee`, `total` | Number |
| `email` | Email input |
| `phone`, `telefon` | Phone input |
| `address`, `cím`, `description`, `scope` | Textarea |
| Everything else | Text input |

---

## Project Structure

```
/
├── backend/               ← Express API (TypeScript)
│   └── src/
│       ├── db/            ← Knex migrations & seeds
│       ├── middleware/    ← Auth & rate limiting
│       ├── routes/        ← API route handlers
│       └── services/      ← DOCX parser, PDF generator
├── frontend/              ← React + Vite + TailwindCSS
│   └── src/
│       ├── context/       ← Auth context
│       ├── layouts/       ← App layout (sidebar)
│       ├── lib/           ← API service layer
│       └── pages/         ← All route pages
├── storage/               ← Uploaded files (auto-created)
│   ├── templates/         ← DOCX template files (versioned)
│   ├── contracts/         ← Generated PDFs and DOCXs
│   └── logos/             ← Company logo uploads
├── database/              ← SQLite database file (auto-created)
└── docker-compose.yml
```

---

## PDF Generation

**Method 1 (Best quality):** LibreOffice headless conversion
```bash
# Install on macOS:
brew install --cask libreoffice

# Install on Ubuntu/Debian:
apt-get install libreoffice
```

**Method 2 (Fallback):** Puppeteer-based HTML rendering — used automatically if LibreOffice is not found. Quality may differ from the original layout.

---

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login and get JWT |
| GET | `/api/templates` | List all templates |
| POST | `/api/templates/upload` | Upload DOCX template |
| GET | `/api/templates/:id` | Get template with fields |
| PUT | `/api/templates/:id/fields` | Update field config |
| GET | `/api/contracts` | List contracts |
| POST | `/api/contracts` | Create/save draft |
| POST | `/api/contracts/:id/generate/pdf` | Generate PDF |
| POST | `/api/contracts/:id/generate/docx` | Generate DOCX |
| GET | `/api/contracts/:id/download/:fileId` | Download file |
| GET | `/api/settings` | Get company settings |
| PUT | `/api/settings` | Update settings |

---

## Environment Variables

The backend reads these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend port |
| `JWT_SECRET` | `dev-secret-...` | JWT signing key (change in production!) |
| `DB_PATH` | `./database/database.sqlite` | SQLite file path |
| `STORAGE_PATH` | `./storage` | File storage directory |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin |

Create a `backend/.env` file for local development:
```env
PORT=3001
JWT_SECRET=your-super-secret-key-here
DB_PATH=../database/database.sqlite
STORAGE_PATH=../storage
FRONTEND_URL=http://localhost:5173
```
