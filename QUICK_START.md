# Quick Start Guide 🚀

## Fastest Way to Run the Application

### 1. Install Dependencies (One Time Setup)

```bash
# Install root dependencies
npm install

# Install backend dependencies  
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Setup Backend Environment

Create `backend/.env` file with this content:

```env
PORT=5000
JWT_SECRET=change-this-secret-key-in-production
JWT_EXPIRES_IN=7d
NODE_ENV=development
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
UPLOAD_DIR=./uploads
```

**Note**: Email configuration is optional for development. Leave `EMAIL_USER` and `EMAIL_PASS` empty if you don't need email features.

### 3. Create Required Directories

```bash
mkdir -p backend/data backend/uploads
```

### 4. Run the Application

From the root directory:

```bash
npm run dev
```

This starts both:
- **Backend**: http://localhost:5000
- **Frontend**: http://localhost:3000

Open your browser to **http://localhost:3000** 🎉

---

## First Time Setup Checklist

- [ ] Node.js 18+ installed? Check with: `node --version`
- [ ] Run `npm install` in root directory
- [ ] Run `npm install` in `backend` directory
- [ ] Run `npm install` in `frontend` directory
- [ ] Created `backend/.env` file with configuration
- [ ] Created `backend/data` and `backend/uploads` directories
- [ ] Run `npm run dev` from root directory
- [ ] Frontend accessible at http://localhost:3000

---

## Create Your First Admin User

After the application is running:

1. Go to http://localhost:3000/register
2. Create an account (will be a "member" by default)
3. Open `backend/data/users.json`
4. Find your user and change `"role": "member"` to `"role": "admin"`
5. Logout and login again - you'll now have admin access!

---

## Common Issues & Solutions

### "Cannot find module" errors
```bash
# Delete node_modules and reinstall
rm -rf node_modules
rm -rf backend/node_modules
rm -rf frontend/node_modules
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### Port 5000 or 3000 already in use
- Change `PORT=5000` to `PORT=5001` in `backend/.env`
- Frontend will automatically find next available port

### Data files don't exist
They'll be created automatically when you first use the app. You can also create them manually:
```bash
cd backend/data
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

---

## What's Next?

1. **Explore the Frontend**: Visit http://localhost:3000
2. **Register**: Create your first account
3. **Make it Admin**: Edit `backend/data/users.json` as described above
4. **Login**: Access admin panel at http://localhost:3000/admin
5. **Create Events**: Start adding your Bengali community events!

For detailed documentation, see [SETUP.md](./SETUP.md) and [README.md](./README.md)

