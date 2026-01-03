# Sanhoti - Bengali Community Website

A modern, multi-tier architecture website for the Bengali community in the USA. Built with React, TypeScript, Express, and following strict multi-tier architecture principles.

## Features

### Public Features
- View upcoming events (Poila Boishakh, Durga Puja, Diwali, Annual Picnic, etc.)
- RSVP for events
- View notice board
- View past event details
- View public photo galleries
- Become a member

### Member Features (Login Required)
- View event-wise photo galleries
- View magazines
- Access with special codes (without login)

### Admin Features
- Create and manage events
- Post notice boards
- Upload pictures and magazines
- Trigger emails to members and organizations
- Create, modify, and delete expense reports
- Manage special access codes

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Framer Motion (animations)
- React Router
- Zustand (state management)

### Backend
- Node.js + Express + TypeScript
- JWT Authentication
- RBAC (Role-Based Access Control)
- Audit Trail System
- Multi-tier Architecture (Controllers → Services → Data Helpers)

## Project Structure

```
sanhoti/
├── frontend/          # React frontend application
├── backend/           # Express backend API
│   ├── src/
│   │   ├── controllers/  # Request handlers (no direct DB access)
│   │   ├── services/     # Business logic layer
│   │   ├── data/         # Data access layer (JSON file helpers)
│   │   ├── models/       # Data models and types
│   │   ├── middleware/   # Auth, RBAC, audit trail
│   │   └── utils/        # Utilities
│   └── data/          # JSON data files
└── package.json       # Root package.json for concurrent scripts
```

## Architecture Principles

- **Multi-tier Architecture**: Strict separation between controllers, services, and data access
- **RBAC**: Role-based access control (Admin, Member, Public)
- **Audit Trail**: All admin actions and data changes are logged
- **Type Safety**: Full TypeScript coverage
- **Test Coverage**: Comprehensive test cases

## Getting Started

### Quick Start

See **[QUICK_START.md](./QUICK_START.md)** for the fastest way to get up and running!

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### Development

```bash
# Run both frontend and backend concurrently (from root directory)
npm run dev

# Or run separately:
npm run dev:backend  # Backend on http://localhost:5000
npm run dev:frontend # Frontend on http://localhost:3000
```

**Then open your browser to:** http://localhost:3000

### Build

```bash
npm run build
```

### Testing

```bash
npm test
```

## Environment Variables

Create `.env` file in backend directory:

```
PORT=5000
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
NODE_ENV=development
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
UPLOAD_DIR=./uploads
```

## License

ISC

