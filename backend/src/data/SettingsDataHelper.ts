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

  private getDefaultSettings(): Settings {
    return {
      navbar: {
        home: true,
        sponsors: true,
        events: true,
        noticeBoard: true,
        galleries: true,
        magazines: true,
        contactUs: true,
        committee: true,
      },
      updated_at: new Date().toISOString(),
    };
  }
}


