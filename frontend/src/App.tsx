import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import AuthActivityMonitor from './components/AuthActivityMonitor';
import Home from './pages/Home';
import DurgaPuja from './pages/DurgaPuja';
import About from './pages/About';
import Sponsors from './pages/Sponsors';
import Donate from './pages/Donate';
import Contact from './pages/Contact';
import Committee from './pages/Committee';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import RSVP from './pages/RSVP';
import Notices from './pages/Notices';
import Galleries from './pages/Galleries';
import GalleryDetail from './pages/GalleryDetail';
import NewsPage from './pages/News';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';

// Code-split heavy chunks out of the public bundle:
// - Magazines/Documents pull in pdfjs-dist (~1MB)
// - AdminDashboard pulls in all 14 admin pages
const Magazines = lazy(() => import('./pages/Magazines'));
const Documents = lazy(() => import('./pages/Documents'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );
}

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ScrollToTop />
      <AuthActivityMonitor />
      <Toaster position="top-right" />
      <Layout>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/durga-puja" element={<DurgaPuja />} />
          <Route path="/about" element={<About />} />
          <Route path="/sponsors" element={<Sponsors />} />
          <Route path="/donate" element={<Donate />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/committee" element={<Committee />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/events/:id/rsvp" element={<RSVP />} />
          <Route path="/sub-events/:id/rsvp" element={<RSVP />} />
          <Route path="/notices" element={<Notices />} />
          <Route path="/galleries" element={<Galleries />} />
          <Route path="/galleries/:id" element={<GalleryDetail />} />
          <Route path="/magazines" element={<Magazines />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute requireAdmin>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}

export default App;

