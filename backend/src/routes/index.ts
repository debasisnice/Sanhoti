import express, { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireAdmin, requireMember } from '../middleware/rbac.js';
import { auditLog } from '../middleware/audit.js';

// Controllers
import { AuthController } from '../controllers/AuthController.js';
import { EventController } from '../controllers/EventController.js';
import { RSVPController } from '../controllers/RSVPController.js';
import { NoticeController } from '../controllers/NoticeController.js';
import { GalleryController } from '../controllers/GalleryController.js';
import { MagazineController } from '../controllers/MagazineController.js';
import { ExpenseController } from '../controllers/ExpenseController.js';
import { EmailController } from '../controllers/EmailController.js';
import { AuditController } from '../controllers/AuditController.js';
import { SpecialAccessController } from '../controllers/SpecialAccessController.js';
import { MessageController } from '../controllers/MessageController.js';
import { SettingsController } from '../controllers/SettingsController.js';
import { SponsorController } from '../controllers/SponsorController.js';
import { HomePageController } from '../controllers/HomePageController.js';

const router = Router();

// Initialize controllers
const authController = new AuthController();
const eventController = new EventController();
const rsvpController = new RSVPController();
const noticeController = new NoticeController();
const galleryController = new GalleryController();
const magazineController = new MagazineController();
const expenseController = new ExpenseController();
const emailController = new EmailController();
const auditController = new AuditController();
const specialAccessController = new SpecialAccessController();
const messageController = new MessageController();
const settingsController = new SettingsController();
const sponsorController = new SponsorController();
const homePageController = new HomePageController();

// Helper to bind controller methods
function bindController(controller: any, methodName: string) {
  return (req: AuthRequest, res: express.Response) => {
    return controller[methodName](req, res);
  };
}

// Public routes
router.post('/auth/register', bindController(authController, 'register'));
router.post('/auth/login', bindController(authController, 'login'));

// Events - Public routes
router.get('/events', bindController(eventController, 'getActiveEvents'));
router.get('/events/upcoming', bindController(eventController, 'getUpcomingEvents'));
router.get('/events/past', bindController(eventController, 'getPastEvents'));
// Admin route for all events (must be before /events/:id to avoid route conflicts)
router.get('/events/all', authenticate, requireAdmin, bindController(eventController, 'getAllEvents'));
router.get('/events/:id', bindController(eventController, 'getEventById'));

// Events - Public image routes (before protected routes)
router.get('/events/:eventId/image/:filename',
  bindController(eventController, 'getEventImage')
);
router.get('/events/:eventId/image-public',
  bindController(eventController, 'getEventImagePublic')
);

// Notices - Public routes
router.get('/notices/public', bindController(noticeController, 'getPublishedNotices'));
router.get('/notices/:noticeId/images',
  bindController(noticeController, 'getNoticeImages')
);
router.get('/notices/:noticeId/images/:filename',
  bindController(noticeController, 'getNoticeImage')
);

// Galleries - Public routes (specific routes first)
router.get('/galleries/public', bindController(galleryController, 'getPublicGalleries'));
router.get('/galleries/public/:id', bindController(galleryController, 'getPublicGalleryById'));
router.get('/galleries/access-code/:code', bindController(galleryController, 'getGalleryByAccessCode'));
// Serve individual photo files - public access (optional auth handled in controller)
router.get('/galleries/:eventId/photos/:filename', bindController(galleryController, 'servePhoto'));

// Magazines - Public routes
router.get('/magazines/public', bindController(magazineController, 'getPublicMagazines'));
router.get('/magazines/access-code/:code', bindController(magazineController, 'getMagazineByAccessCode'));
// Serve PDF files (public)
router.get('/magazines/files/:filename', bindController(magazineController, 'serveMagazineFile'));

// RSVP - Public (guest RSVP)
router.post('/rsvps', bindController(rsvpController, 'createRSVP'));

// Special Access - Public validation
router.post('/special-access/validate', bindController(specialAccessController, 'validateCode'));

// Messages - Public (contact form)
router.post('/messages', bindController(messageController, 'createMessage'));

// Committee - Public (get committee members)
router.get('/committee', bindController(authController, 'getCommitteeMembers'));

// Settings - Public (for navbar visibility, accessible to all users)
router.get('/settings', bindController(settingsController, 'getSettings'));

// Sponsors - Public routes
router.get('/sponsors/images', bindController(sponsorController, 'getImages'));
router.get('/sponsors/images/:filename', bindController(sponsorController, 'getImage'));

// Homepage Images - Public routes
router.get('/homepage/images', bindController(homePageController, 'getImages'));
router.get('/homepage/images/:filename', bindController(homePageController, 'getImage'));

// Protected routes (require authentication)
router.use(authenticate);

router.get('/auth/profile', bindController(authController, 'getProfile'));

// Users - Admin routes
router.get('/users', requireAdmin, bindController(authController, 'getAllUsers'));
router.put('/users/:userId',
  requireAdmin,
  auditLog('UPDATE', 'user'),
  bindController(authController, 'updateUser')
);

// Events - Protected routes
router.post('/events', 
  requireAdmin,
  auditLog('CREATE', 'event'),
  bindController(eventController, 'createEvent')
);
router.put('/events/:id',
  requireAdmin,
  auditLog('UPDATE', 'event'),
  bindController(eventController, 'updateEvent')
);
router.post('/events/:id/deactivate',
  requireAdmin,
  auditLog('DEACTIVATE', 'event'),
  bindController(eventController, 'deactivateEvent')
);
router.post('/events/:id/activate',
  requireAdmin,
  auditLog('ACTIVATE', 'event'),
  bindController(eventController, 'activateEvent')
);
router.delete('/events/:id',
  requireAdmin,
  auditLog('DELETE', 'event'),
  bindController(eventController, 'deleteEvent')
);
router.post('/events/:eventId/upload-image',
  requireAdmin,
  auditLog('UPLOAD_IMAGE', 'event'),
  eventController.uploadEventImage(),
  bindController(eventController, 'handleEventImageUpload')
);
router.get('/events/:eventId/images',
  requireAdmin,
  bindController(eventController, 'getEventImages')
);

// RSVP - Member routes
router.get('/rsvps', requireMember, bindController(rsvpController, 'getAllRSVPs'));
router.get('/rsvps/my', bindController(rsvpController, 'getMyRSVPs'));
router.get('/rsvps/:id', requireMember, bindController(rsvpController, 'getRSVPById'));
router.get('/rsvps/event/:eventId', requireMember, bindController(rsvpController, 'getRSVPsByEvent'));
router.put('/rsvps/:id', bindController(rsvpController, 'updateRSVP'));
router.post('/rsvps/:id/cancel', bindController(rsvpController, 'cancelRSVP'));
router.delete('/rsvps/:id', requireAdmin, auditLog('DELETE', 'rsvp'), bindController(rsvpController, 'deleteRSVP'));

// Notices - Admin routes
router.get('/notices', requireAdmin, bindController(noticeController, 'getAllNotices'));
router.get('/notices/:id', requireAdmin, bindController(noticeController, 'getNoticeById'));
router.post('/notices',
  requireAdmin,
  auditLog('CREATE', 'notice'),
  bindController(noticeController, 'createNotice')
);
router.put('/notices/:id',
  requireAdmin,
  auditLog('UPDATE', 'notice'),
  bindController(noticeController, 'updateNotice')
);
router.delete('/notices/:id',
  requireAdmin,
  auditLog('DELETE', 'notice'),
  bindController(noticeController, 'deleteNotice')
);
router.post('/notices/:id/publish',
  requireAdmin,
  auditLog('PUBLISH', 'notice'),
  bindController(noticeController, 'publishNotice')
);
router.post('/notices/:id/unpublish',
  requireAdmin,
  auditLog('UNPUBLISH', 'notice'),
  bindController(noticeController, 'unpublishNotice')
);
router.post('/notices/:noticeId/upload-image',
  requireAdmin,
  auditLog('UPLOAD_IMAGE', 'notice'),
  noticeController.uploadImages(),
  bindController(noticeController, 'handleImageUpload')
);
router.delete('/notices/:noticeId/images/:filename',
  requireAdmin,
  auditLog('DELETE_IMAGE', 'notice'),
  bindController(noticeController, 'deleteNoticeImage')
);

// Galleries - Member routes (specific routes first)
router.get('/galleries', requireMember, bindController(galleryController, 'getAllGalleries'));

// Gallery Folders - Admin routes (must come before /galleries/:id to avoid route conflicts)
router.get('/galleries/folders',
  requireAdmin,
  bindController(eventController, 'getGalleryFolders')
);

// Get list of photos for a gallery (requires filename param to not match)
router.get('/galleries/:eventId/photos',
  requireAdmin,
  bindController(galleryController, 'getGalleryPhotos')
);

// Galleries - Member routes (parameterized routes come after specific routes)
router.get('/galleries/:id', requireMember, bindController(galleryController, 'getGalleryById'));
router.get('/galleries/event/:eventId', requireMember, bindController(galleryController, 'getGalleriesByEvent'));
router.post('/galleries/:eventId/upload',
  requireAdmin,
  auditLog('UPLOAD_PHOTO', 'gallery'),
  (req, res, next) => {
    // Handle multer errors
    galleryController.uploadPhotos()(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message || 'File upload error' });
      }
      next();
    });
  },
  bindController(galleryController, 'handlePhotoUpload')
);
router.delete('/galleries/:eventId/photos/:filename',
  requireAdmin,
  auditLog('DELETE_PHOTO', 'gallery'),
  bindController(galleryController, 'deleteGalleryPhoto')
);
router.post('/events/:eventId/gallery/publish',
  requireAdmin,
  auditLog('UPDATE', 'event_gallery'),
  bindController(eventController, 'toggleGalleryPublish')
);

// Galleries - Admin routes
router.post('/galleries',
  requireAdmin,
  auditLog('CREATE', 'gallery'),
  bindController(galleryController, 'createGallery')
);
router.put('/galleries/:id',
  requireAdmin,
  auditLog('UPDATE', 'gallery'),
  bindController(galleryController, 'updateGallery')
);
router.post('/galleries/:id/photos',
  requireAdmin,
  auditLog('ADD_PHOTO', 'gallery'),
  bindController(galleryController, 'addPhoto')
);
router.delete('/galleries/:id/photos/:photoId',
  requireAdmin,
  auditLog('REMOVE_PHOTO', 'gallery'),
  bindController(galleryController, 'removePhoto')
);
router.delete('/galleries/:id',
  requireAdmin,
  auditLog('DELETE', 'gallery'),
  bindController(galleryController, 'deleteGallery')
);

// Magazines - Member routes
router.get('/magazines', requireMember, bindController(magazineController, 'getAllMagazines'));
router.get('/magazines/:id', requireMember, bindController(magazineController, 'getMagazineById'));

// Magazines - Admin routes
router.get('/magazines/files',
  requireAdmin,
  bindController(magazineController, 'getMagazineFiles')
);
router.post('/magazines/upload',
  requireAdmin,
  auditLog('UPLOAD', 'magazine'),
  magazineController.uploadMagazine(),
  bindController(magazineController, 'handleMagazineUpload')
);
router.post('/magazines',
  requireAdmin,
  auditLog('CREATE', 'magazine'),
  bindController(magazineController, 'createMagazine')
);
router.put('/magazines/:id',
  requireAdmin,
  auditLog('UPDATE', 'magazine'),
  bindController(magazineController, 'updateMagazine')
);
router.delete('/magazines/:id',
  requireAdmin,
  auditLog('DELETE', 'magazine'),
  bindController(magazineController, 'deleteMagazineWithFile')
);

// Expenses - Admin routes
router.get('/expenses', requireAdmin, bindController(expenseController, 'getAllExpenses'));
router.get('/expenses/:id', requireAdmin, bindController(expenseController, 'getExpenseById'));
router.get('/expenses/event/:eventId', requireAdmin, bindController(expenseController, 'getExpensesByEvent'));
router.get('/expenses/event/:eventId/total', requireAdmin, bindController(expenseController, 'getEventTotal'));
router.get('/expenses/category/:category/total', requireAdmin, bindController(expenseController, 'getCategoryTotal'));
router.post('/expenses',
  requireAdmin,
  auditLog('CREATE', 'expense'),
  bindController(expenseController, 'createExpense')
);
router.put('/expenses/:id',
  requireAdmin,
  auditLog('UPDATE', 'expense'),
  bindController(expenseController, 'updateExpense')
);
router.delete('/expenses/:id',
  requireAdmin,
  auditLog('DELETE', 'expense'),
  bindController(expenseController, 'deleteExpense')
);

// Email - Admin routes
router.post('/email/members',
  requireAdmin,
  auditLog('SEND_EMAIL', 'members'),
  bindController(emailController, 'sendToMembers')
);
router.post('/email/admins',
  requireAdmin,
  auditLog('SEND_EMAIL', 'admins'),
  bindController(emailController, 'sendToAdmins')
);
router.post('/email/organizations',
  requireAdmin,
  auditLog('SEND_EMAIL', 'organizations'),
  bindController(emailController, 'sendToOrganizations')
);
router.post('/email/events/:eventId/notify',
  requireAdmin,
  auditLog('SEND_EVENT_NOTIFICATION', 'event'),
  bindController(emailController, 'sendEventNotification')
);

// Messages - Admin routes
router.get('/messages', requireAdmin, bindController(messageController, 'getAllMessages'));
router.get('/messages/my', bindController(messageController, 'getMyMessages'));
router.get('/messages/:id', requireAdmin, bindController(messageController, 'getMessageById'));
router.delete('/messages/:id',
  requireAdmin,
  auditLog('DELETE', 'message'),
  bindController(messageController, 'deleteMessage')
);

// Audit - Admin routes
router.get('/audit', requireAdmin, bindController(auditController, 'getAuditLogs'));
router.get('/audit/recent', requireAdmin, bindController(auditController, 'getRecentLogs'));
router.get('/audit/user/:userId', requireAdmin, bindController(auditController, 'getLogsByUser'));
router.get('/audit/resource/:resource/:resourceId?', requireAdmin, bindController(auditController, 'getLogsByResource'));

// Special Access - Admin routes
router.get('/special-access', requireAdmin, bindController(specialAccessController, 'getAllCodes'));
router.get('/special-access/:id', requireAdmin, bindController(specialAccessController, 'getCodeById'));
router.post('/special-access',
  requireAdmin,
  auditLog('CREATE', 'special-access-code'),
  bindController(specialAccessController, 'createCode')
);
router.put('/special-access/:id',
  requireAdmin,
  auditLog('UPDATE', 'special-access-code'),
  bindController(specialAccessController, 'updateCode')
);
router.delete('/special-access/:id',
  requireAdmin,
  auditLog('DELETE', 'special-access-code'),
  bindController(specialAccessController, 'deleteCode')
);

// Settings - Admin routes (GET is public, defined above)
router.put('/settings/navbar',
  requireAdmin,
  auditLog('UPDATE', 'settings'),
  bindController(settingsController, 'updateNavbarSettings')
);

// Sponsors - Admin routes (upload, delete)
router.post('/sponsors/upload',
  requireAdmin,
  auditLog('UPLOAD', 'sponsor_image'),
  sponsorController.uploadImages(),
  bindController(sponsorController, 'handleImageUpload')
);
router.delete('/sponsors/images/:filename',
  requireAdmin,
  auditLog('DELETE', 'sponsor_image'),
  bindController(sponsorController, 'deleteImage')
);
router.delete('/sponsors/images',
  requireAdmin,
  auditLog('DELETE_ALL', 'sponsor_image'),
  bindController(sponsorController, 'deleteAllImages')
);

// Homepage Images - Admin routes
router.post('/homepage/upload',
  requireAdmin,
  auditLog('UPLOAD', 'homepage_image'),
  homePageController.uploadImages(),
  bindController(homePageController, 'handleImageUpload')
);
router.delete('/homepage/images/:filename',
  requireAdmin,
  auditLog('DELETE', 'homepage_image'),
  bindController(homePageController, 'deleteImage')
);
router.delete('/homepage/images',
  requireAdmin,
  auditLog('DELETE_ALL', 'homepage_image'),
  bindController(homePageController, 'deleteAllImages')
);

export default router;

