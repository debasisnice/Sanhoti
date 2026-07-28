import { DatabaseHelper } from './DatabaseHelper.js';
import {
  HeroSlots,
  HomeHeroButtonsVisibility,
  HomeHighlightsMode,
  HomePageStatements,
  HomePageVideo,
  HomeStatementTabsVisibility,
  Settings,
} from '../models/types.js';

export class SettingsDataHelper extends DatabaseHelper {
  private readonly filename = 'settings.json';

  async get(): Promise<Settings | null> {
    const settings = this.readFile<any>(this.filename);
    if (settings.length === 0) {
      // Return default settings if none exist
      return this.getDefaultSettings();
    }
    
    let currentSettings = settings[0];
    
    // Migrate old "about" to "sponsors" if needed
    if (currentSettings.navbar && 'about' in currentSettings.navbar && !('sponsors' in currentSettings.navbar)) {
      currentSettings = {
        ...currentSettings,
        navbar: {
          ...currentSettings.navbar,
          sponsors: currentSettings.navbar.about,
        },
      };
      // Remove old "about" key
      delete currentSettings.navbar.about;
      // Save migrated settings
      this.writeFile(this.filename, [currentSettings]);
    }

    // Backfill navbar keys added after this settings file was created
    // (e.g. "durgaPuja") so new menu items default to visible.
    if (currentSettings.navbar) {
      const defaultNavbar = this.getDefaultSettings().navbar;
      const nav = { ...currentSettings.navbar } as Record<string, unknown>;
      let migrated = false;
      if (nav.resources !== undefined && nav.media === undefined) {
        nav.media = nav.resources;
        migrated = true;
      }
      if ('resources' in nav) {
        delete nav.resources;
        migrated = true;
      }
      const hasMissingKey = Object.keys(defaultNavbar).some(key => !(key in nav));
      if (hasMissingKey || migrated) {
        currentSettings = {
          ...currentSettings,
          navbar: { ...defaultNavbar, ...nav },
        };
        this.writeFile(this.filename, [currentSettings]);
      }
    }

    return currentSettings as Settings;
  }

  async update(updates: Partial<Settings['navbar']>): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const updated: Settings = {
      ...current,
      navbar: {
        ...current.navbar,
        ...updates,
      },
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateCorporatePartnerships(content: Settings['corporatePartnerships']): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }
    const updated: Settings = {
      ...current,
      corporatePartnerships: content,
      updated_at: new Date().toISOString(),
    };
    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateStripeDonation(config: {
    showStripeDonateButton: boolean;
    stripeBuyButtonId: string;
    stripePublishableKey: string;
  }): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const buyButtonId = config.stripeBuyButtonId.trim();
    const publishableKey = config.stripePublishableKey.trim();

    const updated: Settings = {
      ...current,
      showStripeDonateButton: config.showStripeDonateButton,
      stripeBuyButtonId: buyButtonId === '' ? undefined : buyButtonId,
      stripePublishableKey: publishableKey === '' ? undefined : publishableKey,
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateZellePhoneNumber(phoneNumber: string): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const updated: Settings = {
      ...current,
      zellePhoneNumber: phoneNumber,
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateSocialLinks(facebookLink?: string, whatsappLink?: string, instagramLink?: string): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const updated: Settings = {
      ...current,
      facebookLink: facebookLink !== undefined ? facebookLink : current.facebookLink,
      whatsappLink: whatsappLink !== undefined ? whatsappLink : current.whatsappLink,
      instagramLink: instagramLink !== undefined ? instagramLink : current.instagramLink,
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateYoutubeChannelUrl(youtubeChannelUrl: string): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const updated: Settings = {
      ...current,
      youtubeChannelUrl: youtubeChannelUrl.trim() === '' ? undefined : youtubeChannelUrl.trim(),
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateEmailSettings(emailAddress?: string, emailPassword?: string): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const updated: Settings = {
      ...current,
      emailAddress: emailAddress !== undefined ? emailAddress : current.emailAddress,
      emailPassword: emailPassword !== undefined ? emailPassword : current.emailPassword,
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateCommitteeYear(committeeYear: string): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const updated: Settings = {
      ...current,
      committeeYear: committeeYear,
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateHomeStatements(
    textUpdates: Partial<HomePageStatements>,
    tabVisibilityPatch?: Partial<HomeStatementTabsVisibility>
  ): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const prevSt = current.statements ?? {};
    const nextSt =
      Object.keys(textUpdates).length > 0 ? { ...prevSt, ...textUpdates } : prevSt;

    const prevVis = current.statementTabsVisibility ?? {};
    const nextVis =
      tabVisibilityPatch !== undefined
        ? { ...prevVis, ...tabVisibilityPatch }
        : prevVis;

    const updated: Settings = {
      ...current,
      statements: nextSt,
      statementTabsVisibility: nextVis,
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateHomeHeroBanner(message: string): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const updated: Settings = {
      ...current,
      homeHeroBannerMessage: message,
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateHomePageVideos(videos: HomePageVideo[]): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const updated: Settings = {
      ...current,
      homePageVideos: videos,
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateHomeHighlightsMode(mode: HomeHighlightsMode): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const updated: Settings = {
      ...current,
      homeHighlightsMode: mode,
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateHomeSectionOrder(order: string[]): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const updated: Settings = {
      ...current,
      homeSectionOrder: order,
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateNavbarMenuOrder(order: string[]): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const updated: Settings = {
      ...current,
      navbarMenuOrder: order,
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateHeroSlots(heroSlots: HeroSlots): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const updated: Settings = {
      ...current,
      heroSlots,
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateDurgaPujaMode(enabled: boolean): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const updated: Settings = {
      ...current,
      durgaPujaMode: enabled,
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateDurgaPujaLogo(url: string): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const updated: Settings = {
      ...current,
      durgaPujaLogoUrl: url || undefined,
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  async updateHomeHeroButtons(patch: Partial<HomeHeroButtonsVisibility>): Promise<Settings> {
    let current = await this.get();
    if (!current) {
      current = this.getDefaultSettings();
    }

    const updated: Settings = {
      ...current,
      homeHeroButtons: { ...(current.homeHeroButtons ?? {}), ...patch },
      updated_at: new Date().toISOString(),
    };

    this.writeFile(this.filename, [updated]);
    return updated;
  }

  private getDefaultSettings(): Settings {
    return {
      navbar: {
        home: true,
        durgaPuja: true,
        sponsors: true,
        corporatePartnerships: true,
        events: true,
      noticeBoard: true,
      media: true,
      galleries: true,
      magazines: true,
      blogs: true,
      news: true,
        contactUs: true,
        committee: true,
        documents: true,
        donate: true,
        joinUs: true,
      },
      facebookLink: 'https://m.facebook.com/groups/1379146276699787/?ref=share&mibextid=wwXIfr',
      whatsappLink: 'https://chat.whatsapp.com/HzI914nVyvGIZwarXzWzlH',
      updated_at: new Date().toISOString(),
    };
  }
}


