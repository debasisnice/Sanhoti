import { DatabaseHelper } from './DatabaseHelper.js';
import { Settings } from '../models/types.js';

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

  private getDefaultSettings(): Settings {
    return {
      navbar: {
        home: true,
        sponsors: true,
        events: true,
        noticeBoard: true,
        galleries: true,
        magazines: true,
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


