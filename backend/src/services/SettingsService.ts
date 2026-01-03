import { SettingsDataHelper } from '../data/SettingsDataHelper.js';
import { Settings } from '../models/types.js';

export class SettingsService {
  private settingsDataHelper: SettingsDataHelper;

  constructor() {
    this.settingsDataHelper = new SettingsDataHelper();
  }

  async getSettings(): Promise<Settings> {
    const settings = await this.settingsDataHelper.get();
    if (!settings) {
      // Create default settings if none exist
      return await this.settingsDataHelper.update({});
    }
    return settings;
  }

  async updateNavbarSettings(updates: Partial<Settings['navbar']>): Promise<Settings> {
    return this.settingsDataHelper.update(updates);
  }
}

