import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { safeServedFilename } from '../utils/safeFile.js';
import {
  HeroSlotConfig,
  HeroSlots,
  HomeHeroButtonsVisibility,
  HomePageStatements,
  HomeStatementTabsVisibility,
} from '../models/types.js';
import { SettingsService } from '../services/SettingsService.js';

const __heroDirname = dirname(fileURLToPath(import.meta.url));
const heroSlotsDir = join(__heroDirname, '../../data/Hero_Slots');
if (!existsSync(heroSlotsDir)) {
  mkdirSync(heroSlotsDir, { recursive: true });
}
const heroImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, heroSlotsDir),
  filename: (_req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${sanitized}`);
  },
});
const heroImageUpload = multer({
  storage: heroImageStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(file.originalname.toLowerCase()) && allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  },
});

const HERO_BUTTON_KEYS: (keyof HomeHeroButtonsVisibility)[] = [
  'facebook',
  'whatsapp',
  'viewEvents',
  'durgaPuja',
  'viewCharityEvents',
];

export class SettingsController {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
  }

  async getSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const settings = await this.settingsService.getSettings();
      res.json(settings);
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings', details: error.message });
    }
  }

  async updateNavbarSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const updates = req.body.navbar;
      if (!updates || typeof updates !== 'object') {
        res.status(400).json({ error: 'Invalid navbar settings' });
        return;
      }

      const settings = await this.settingsService.updateNavbarSettings(updates);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating navbar settings:', error);
      res.status(500).json({ error: 'Failed to update navbar settings', details: error.message });
    }
  }

  async updateStripeDonation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { showStripeDonateButton, stripeBuyButtonId, stripePublishableKey } = req.body ?? {};

      if (typeof showStripeDonateButton !== 'boolean') {
        res.status(400).json({ error: 'showStripeDonateButton must be a boolean' });
        return;
      }
      if (stripeBuyButtonId !== undefined && typeof stripeBuyButtonId !== 'string') {
        res.status(400).json({ error: 'stripeBuyButtonId must be a string' });
        return;
      }
      if (stripePublishableKey !== undefined && typeof stripePublishableKey !== 'string') {
        res.status(400).json({ error: 'stripePublishableKey must be a string' });
        return;
      }

      const settings = await this.settingsService.updateStripeDonation({
        showStripeDonateButton,
        stripeBuyButtonId: stripeBuyButtonId ?? '',
        stripePublishableKey: stripePublishableKey ?? '',
      });
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating Stripe donation settings:', error);
      const message = error?.message ?? 'Failed to update Stripe donation settings';
      const status = message.includes('required') || message.includes('must start') ? 400 : 500;
      res.status(status).json({ error: message, details: error.message });
    }
  }

  async updateZellePhoneNumber(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { phoneNumber } = req.body;
      if (typeof phoneNumber !== 'string') {
        res.status(400).json({ error: 'Invalid phone number' });
        return;
      }

      const settings = await this.settingsService.updateZellePhoneNumber(phoneNumber);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating Zelle phone number:', error);
      res.status(500).json({ error: 'Failed to update Zelle phone number', details: error.message });
    }
  }

  async updateSocialLinks(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { facebookLink, whatsappLink, instagramLink } = req.body;
      
      if (facebookLink !== undefined && typeof facebookLink !== 'string') {
        res.status(400).json({ error: 'Invalid Facebook link' });
        return;
      }
      
      if (whatsappLink !== undefined && typeof whatsappLink !== 'string') {
        res.status(400).json({ error: 'Invalid WhatsApp link' });
        return;
      }
      
      if (instagramLink !== undefined && typeof instagramLink !== 'string') {
        res.status(400).json({ error: 'Invalid Instagram link' });
        return;
      }

      const settings = await this.settingsService.updateSocialLinks(facebookLink, whatsappLink, instagramLink);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating social links:', error);
      res.status(500).json({ error: 'Failed to update social links', details: error.message });
    }
  }

  async updateCorporatePartnerships(req: AuthRequest, res: Response): Promise<void> {
    try {
      const content = req.body?.corporatePartnerships ?? req.body;
      if (!content || typeof content !== 'object' || Array.isArray(content)) {
        res.status(400).json({ error: 'Invalid corporate partnerships content' });
        return;
      }
      const settings = await this.settingsService.updateCorporatePartnerships(content);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating corporate partnerships:', error);
      res.status(500).json({ error: 'Failed to update corporate partnerships', details: error.message });
    }
  }

  async updateYoutubeChannelUrl(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { youtubeChannelUrl } = req.body ?? {};
      if (youtubeChannelUrl !== undefined && typeof youtubeChannelUrl !== 'string') {
        res.status(400).json({ error: 'youtubeChannelUrl must be a string' });
        return;
      }
      const trimmed = (youtubeChannelUrl ?? '').trim();
      if (trimmed && !/^https?:\/\//i.test(trimmed)) {
        res.status(400).json({ error: 'URL must start with http:// or https://' });
        return;
      }

      const settings = await this.settingsService.updateYoutubeChannelUrl(trimmed);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating YouTube channel URL:', error);
      res.status(500).json({ error: 'Failed to update YouTube channel URL', details: error.message });
    }
  }

  async updateEmailSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { emailAddress, emailPassword } = req.body;
      
      if (emailAddress !== undefined && typeof emailAddress !== 'string') {
        res.status(400).json({ error: 'Invalid email address' });
        return;
      }
      
      if (emailPassword !== undefined && typeof emailPassword !== 'string') {
        res.status(400).json({ error: 'Invalid email password' });
        return;
      }

      const settings = await this.settingsService.updateEmailSettings(emailAddress, emailPassword);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating email settings:', error);
      res.status(500).json({ error: 'Failed to update email settings', details: error.message });
    }
  }

  async getEmailSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const emailSettings = await this.settingsService.getEmailSettings();
      res.json(emailSettings);
    } catch (error: any) {
      console.error('Error fetching email settings:', error);
      res.status(500).json({ error: 'Failed to fetch email settings', details: error.message });
    }
  }

  async updateCommitteeYear(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { committeeYear } = req.body;
      if (typeof committeeYear !== 'string') {
        res.status(400).json({ error: 'Invalid committee year' });
        return;
      }

      const settings = await this.settingsService.updateCommitteeYear(committeeYear);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating committee year:', error);
      res.status(500).json({ error: 'Failed to update committee year', details: error.message });
    }
  }

  async updateHomeStatements(req: AuthRequest, res: Response): Promise<void> {
    try {
      const body = req.body ?? {};
      const keys = ['about', 'vision', 'mission', 'purpose'] as const;
      const textUpdates: Partial<HomePageStatements> = {};
      for (const k of keys) {
        if (body[k] !== undefined) {
          if (typeof body[k] !== 'string') {
            res.status(400).json({ error: `Invalid ${k}: must be a string` });
            return;
          }
          textUpdates[k] = body[k];
        }
      }

      let tabVisibilityPatch: Partial<HomeStatementTabsVisibility> | undefined;
      if (body.tabVisibility !== undefined) {
        if (typeof body.tabVisibility !== 'object' || body.tabVisibility === null) {
          res.status(400).json({ error: 'Invalid tabVisibility' });
          return;
        }
        const patch: Partial<HomeStatementTabsVisibility> = {};
        for (const k of keys) {
          if (body.tabVisibility[k] !== undefined) {
            if (typeof body.tabVisibility[k] !== 'boolean') {
              res.status(400).json({ error: `Invalid tabVisibility.${k}: must be a boolean` });
              return;
            }
            patch[k] = body.tabVisibility[k];
          }
        }
        if (Object.keys(patch).length > 0) {
          tabVisibilityPatch = patch;
        }
      }

      if (Object.keys(textUpdates).length === 0 && tabVisibilityPatch === undefined) {
        res.status(400).json({
          error: 'Provide statement text (about, vision, mission, purpose) and/or tabVisibility updates',
        });
        return;
      }

      const existing = await this.settingsService.getSettings();
      const prevVis = existing.statementTabsVisibility ?? {};
      const mergedVis =
        tabVisibilityPatch !== undefined ? { ...prevVis, ...tabVisibilityPatch } : prevVis;
      const anyVisible = keys.some((k) => mergedVis[k] !== false);
      if (!anyVisible) {
        res.status(400).json({ error: 'At least one statement tab must remain visible on the home page' });
        return;
      }

      const settings = await this.settingsService.updateHomeStatements(textUpdates, tabVisibilityPatch);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating home statements:', error);
      res.status(500).json({ error: 'Failed to update home statements', details: error.message });
    }
  }

  async updateHomeHeroBanner(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { message } = req.body ?? {};
      if (typeof message !== 'string') {
        res.status(400).json({ error: 'message must be a string (use empty string to hide the banner)' });
        return;
      }

      const settings = await this.settingsService.updateHomeHeroBanner(message);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating home hero banner:', error);
      res.status(500).json({ error: 'Failed to update home hero banner', details: error.message });
    }
  }

  async updateHomePageVideos(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { videos } = req.body ?? {};
      if (!Array.isArray(videos)) {
        res.status(400).json({ error: 'videos must be an array' });
        return;
      }

      const asString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

      // Normalize each entry to { url, buttonLabel?, buttonUrl? }. Legacy entries
      // may be plain strings (URL only). Drop entries without a URL; a button is
      // only kept when it has both a label and a link. Cap the count.
      const clean = videos
        .map((v: unknown) => {
          if (typeof v === 'string') return { url: v.trim() };
          if (v && typeof v === 'object') {
            const o = v as {
              url?: unknown;
              caption?: unknown;
              author?: unknown;
              buttonLabel?: unknown;
              buttonUrl?: unknown;
            };
            return {
              url: asString(o.url),
              caption: asString(o.caption),
              author: asString(o.author),
              buttonLabel: asString(o.buttonLabel),
              buttonUrl: asString(o.buttonUrl),
            };
          }
          return { url: '', caption: '', author: '' };
        })
        .filter((v) => v.url.length > 0)
        .map((v) => ({
          url: v.url,
          ...('caption' in v && v.caption ? { caption: (v.caption as string).slice(0, 400) } : {}),
          ...('author' in v && v.author ? { author: (v.author as string).slice(0, 120) } : {}),
          ...('buttonLabel' in v && v.buttonLabel && 'buttonUrl' in v && v.buttonUrl
            ? { buttonLabel: v.buttonLabel, buttonUrl: v.buttonUrl }
            : {}),
        }))
        .slice(0, 12);

      const settings = await this.settingsService.updateHomePageVideos(clean);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating home page videos:', error);
      res.status(500).json({ error: 'Failed to update home page videos', details: error.message });
    }
  }

  async updateHomeHighlightsMode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { mode } = req.body ?? {};
      if (mode !== 'videos' && mode !== 'charity_gallery' && mode !== 'durga_puja_gallery') {
        res.status(400).json({
          error: 'mode must be "videos", "charity_gallery", or "durga_puja_gallery"',
        });
        return;
      }

      const settings = await this.settingsService.updateHomeHighlightsMode(mode);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating home highlights mode:', error);
      res.status(500).json({ error: 'Failed to update home highlights mode', details: error.message });
    }
  }

  async updateHomeSectionOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { order } = req.body ?? {};
      if (!Array.isArray(order) || order.some((k) => typeof k !== 'string')) {
        res.status(400).json({ error: 'order must be an array of strings' });
        return;
      }

      // Trim, drop empties/dupes, cap length.
      const seen = new Set<string>();
      const clean = order
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0 && !seen.has(k) && (seen.add(k), true))
        .slice(0, 20);

      const settings = await this.settingsService.updateHomeSectionOrder(clean);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating home section order:', error);
      res.status(500).json({ error: 'Failed to update home section order', details: error.message });
    }
  }

  async updateNavbarMenuOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { order } = req.body ?? {};
      if (!Array.isArray(order) || order.some((k) => typeof k !== 'string')) {
        res.status(400).json({ error: 'order must be an array of strings' });
        return;
      }

      const seen = new Set<string>();
      const clean = order
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0 && !seen.has(k) && (seen.add(k), true))
        .slice(0, 20);

      const settings = await this.settingsService.updateNavbarMenuOrder(clean);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating navbar menu order:', error);
      res.status(500).json({ error: 'Failed to update navbar menu order', details: error.message });
    }
  }

  async updateHeroSlots(req: AuthRequest, res: Response): Promise<void> {
    try {
      const body = (req.body?.heroSlots ?? req.body ?? {}) as Record<string, unknown>;
      const modes = new Set(['default', 'video', 'image', 'off']);

      const parseSlot = (raw: unknown): HeroSlotConfig | undefined => {
        if (!raw || typeof raw !== 'object') return undefined;
        const o = raw as { mode?: unknown; videoUrl?: unknown; imageUrl?: unknown };
        const mode = typeof o.mode === 'string' && modes.has(o.mode) ? (o.mode as HeroSlotConfig['mode']) : 'default';
        const videoUrl = typeof o.videoUrl === 'string' ? o.videoUrl.trim() : '';
        const imageUrl = typeof o.imageUrl === 'string' ? o.imageUrl.trim() : '';
        return {
          mode,
          ...(mode === 'video' && videoUrl ? { videoUrl } : {}),
          ...(mode === 'image' && imageUrl ? { imageUrl } : {}),
        };
      };

      const heroSlots: HeroSlots = {};
      const left = parseSlot((body as { left?: unknown }).left);
      const right = parseSlot((body as { right?: unknown }).right);
      const rightExtra = parseSlot((body as { rightExtra?: unknown }).rightExtra);
      if (left) heroSlots.left = left;
      if (right) heroSlots.right = right;
      if (rightExtra) heroSlots.rightExtra = rightExtra;

      const settings = await this.settingsService.updateHeroSlots(heroSlots);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating hero slots:', error);
      res.status(500).json({ error: 'Failed to update hero slots', details: error.message });
    }
  }

  async updateDurgaPujaMode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { enabled } = req.body ?? {};
      if (typeof enabled !== 'boolean') {
        res.status(400).json({ error: 'enabled must be a boolean' });
        return;
      }
      const settings = await this.settingsService.updateDurgaPujaMode(enabled);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating Durga Puja mode:', error);
      res.status(500).json({ error: 'Failed to update Durga Puja mode', details: error.message });
    }
  }

  async updateDurgaPujaLogo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { url } = req.body ?? {};
      if (typeof url !== 'string') {
        res.status(400).json({ error: 'url must be a string (empty to clear)' });
        return;
      }
      const settings = await this.settingsService.updateDurgaPujaLogo(url.trim());
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating Durga Puja logo:', error);
      res.status(500).json({ error: 'Failed to update Durga Puja logo', details: error.message });
    }
  }

  /** Multer middleware for a single hero-slot image upload. */
  heroSlotImageUpload() {
    return heroImageUpload.single('image');
  }

  async uploadHeroSlotImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const file = (req as unknown as { file?: { filename: string } }).file;
      if (!file) {
        res.status(400).json({ error: 'No image uploaded' });
        return;
      }
      res.json({
        filename: file.filename,
        url: `/api/settings/hero-slot-image/${encodeURIComponent(file.filename)}`,
      });
    } catch (error: any) {
      console.error('Error uploading hero slot image:', error);
      res.status(500).json({ error: 'Failed to upload image', details: error.message });
    }
  }

  async getHeroSlotImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const filename = safeServedFilename(req.params.filename);
      if (!filename) {
        res.status(400).json({ error: 'Invalid filename' });
        return;
      }
      const absolutePath = resolve(join(heroSlotsDir, filename));
      if (!absolutePath.startsWith(resolve(heroSlotsDir)) || !existsSync(absolutePath)) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }
      res.sendFile(absolutePath);
    } catch (error: any) {
      console.error('Error serving hero slot image:', error);
      res.status(500).json({ error: 'Failed to serve image' });
    }
  }

  async updateHomeHeroButtons(req: AuthRequest, res: Response): Promise<void> {
    try {
      const body = req.body?.buttons ?? req.body ?? {};
      if (typeof body !== 'object' || body === null) {
        res.status(400).json({ error: 'Invalid hero buttons payload' });
        return;
      }

      const patch: Partial<HomeHeroButtonsVisibility> = {};
      for (const key of HERO_BUTTON_KEYS) {
        if (body[key] !== undefined) {
          if (typeof body[key] !== 'boolean') {
            res.status(400).json({ error: `Invalid ${key}: must be a boolean` });
            return;
          }
          patch[key] = body[key];
        }
      }

      if (Object.keys(patch).length === 0) {
        res.status(400).json({
          error: `Provide at least one of: ${HERO_BUTTON_KEYS.join(', ')}`,
        });
        return;
      }

      const settings = await this.settingsService.updateHomeHeroButtons(patch);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating home hero buttons:', error);
      res.status(500).json({ error: 'Failed to update home hero buttons', details: error.message });
    }
  }
}


