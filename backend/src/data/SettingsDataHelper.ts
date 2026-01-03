import { DatabaseHelper } from './DatabaseHelper.js';
import { Settings } from '../models/types.js';

export class SettingsDataHelper extends DatabaseHelper {
  private readonly filename = 'settings.json';

  async get(): Promise<Settings | null> {
    const settings = this.readFile<Settings>(this.filename);
    if (settings.length === 0) {
      // Return default settings if none exist
      return this.getDefaultSettings();
    }
    return settings[0];
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
        about: true,
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

