# Setup and Run Guide

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Git (optional, for version control)

## Step-by-Step Setup

### 1. Install Dependencies

From the root directory, install dependencies for both frontend and backend:

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

### 2. Backend Setup

#### Create Environment File

Create a `.env` file in the `backend` directory:

```bash
cd backend
cp .env.example .env
```

Or manually create `backend/.env` with the following content:

```env
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
NODE_ENV=development
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
UPLOAD_DIR=./uploads
```

**Note**: For Gmail, you'll need to generate an "App Password" from your Google Account settings (not your regular password).

#### Create Data Directory

The data directory should already exist, but ensure it's created:

```bash
mkdir -p backend/data
mkdir -p backend/uploads
```

### 3. Frontend Setup

Create `.env` file in the `frontend` directory (optional):

```bash
cd frontend
echo "VITE_API_URL=http://localhost:5000/api" > .env
```

### 4. Running the Application

#### Option 1: Run Both Together (Recommended)

From the root directory:

```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend development server on `http://localhost:3000`

#### Option 2: Run Separately

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 5. Access the Application

- **Frontend**: Open your browser and go to `http://localhost:3000`
- **Backend API**: The API will be available at `http://localhost:5000/api`
- **Health Check**: Visit `http://localhost:5000/health` to verify backend is running

## Creating Your First Admin User

### Option 1: Register via Frontend (Recommended)

1. Go to `http://localhost:3000/register`
2. Create a new account (it will be created as a "member" by default)
3. Manually edit `backend/data/users.json` to change the role to "admin"

### Option 2: Manual Creation

1. Generate a password hash using Node.js:

```bash
cd backend
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your-password', 10).then(hash => console.log(hash))"
```

2. Create a user entry in `backend/data/users.json`:

```json
[
  {
    "id": "admin-001",
    "email": "admin@example.com",
    "password": "<paste-hashed-password-here>",
    "firstName": "Admin",
    "lastName": "User",
    "phone": "",
    "role": "admin",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

3. Then login at `http://localhost:3000/login`

## Development Commands

### Backend Commands

```bash
cd backend

# Run development server with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Run tests
npm test
```

### Frontend Commands

```bash
cd frontend

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Lint code
npm run lint
```

## Troubleshooting

### Port Already in Use

If port 5000 or 3000 is already in use:

**Backend**: Change `PORT` in `backend/.env`
**Frontend**: Vite will automatically use the next available port (check terminal output)

### Module Not Found Errors

Make sure all dependencies are installed:
```bash
rm -rf node_modules package-lock.json
npm install
```

Do this for both root, backend, and frontend directories.

### Data Files Not Created

The JSON data files will be created automatically when you first use the application. If you want to start with empty files:

```bash
cd backend/data
touch users.json events.json rsvps.json notices.json galleries.json magazines.json expenses.json auditLogs.json specialAccessCodes.json

# Initialize as empty arrays
echo "[]" > users.json
echo "[]" > events.json
echo "[]" > rsvps.json
echo "[]" > notices.json
echo "[]" > galleries.json
echo "[]" > magazines.json
echo "[]" > expenses.json
echo "[]" > auditLogs.json
echo "[]" > specialAccessCodes.json
```

### Email Configuration Issues

If you don't have email configured, the app will still work but email sending features will fail. You can:
- Skip email configuration for development (features will fail gracefully)
- Use a service like Mailtrap for testing
- Configure Gmail with App Password (as mentioned above)

## Production Build

### Build Both Applications

```bash
# From root directory
npm run build
```

### Serve Production Builds

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
The built files will be in `frontend/dist`. Serve them with any static file server:
- nginx
- Apache
- Node.js static server (serve package)
- Vercel, Netlify, etc.

## Quick Start Checklist

- [ ] Node.js 18+ installed
- [ ] Dependencies installed (`npm install` in root, backend, frontend)
- [ ] Backend `.env` file created with configuration
- [ ] Data directories created (`backend/data`, `backend/uploads`)
- [ ] Run `npm run dev` from root directory
- [ ] Access frontend at `http://localhost:3000`
- [ ] Create admin user account
- [ ] Start building your Bengali community website! 🎉

## Need Help?

If you encounter any issues:
1. Check the console for error messages
2. Verify all environment variables are set correctly
3. Ensure all dependencies are installed
4. Check that ports 5000 and 3000 are available

