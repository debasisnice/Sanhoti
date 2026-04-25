import { SettingsDataHelper } from '../data/SettingsDataHelper.js';
import { HomePageStatements, HomeStatementTabsVisibility, Settings } from '../models/types.js';

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

  async updateZellePhoneNumber(phoneNumber: string): Promise<Settings> {
    return this.settingsDataHelper.updateZellePhoneNumber(phoneNumber);
  }

  async updateSocialLinks(facebookLink?: string, whatsappLink?: string, instagramLink?: string): Promise<Settings> {
    return this.settingsDataHelper.updateSocialLinks(facebookLink, whatsappLink, instagramLink);
  }

  async updateYoutubeChannelUrl(youtubeChannelUrl: string): Promise<Settings> {
    return this.settingsDataHelper.updateYoutubeChannelUrl(youtubeChannelUrl);
  }

  async updateEmailSettings(emailAddress?: string, emailPassword?: string): Promise<Settings> {
    return this.settingsDataHelper.updateEmailSettings(emailAddress, emailPassword);
  }

  async getEmailSettings(): Promise<{ emailAddress?: string; emailPassword?: string }> {
    const settings = await this.settingsDataHelper.get();
    return {
      emailAddress: settings?.emailAddress,
      emailPassword: settings?.emailPassword,
    };
  }

  async updateCommitteeYear(committeeYear: string): Promise<Settings> {
    return this.settingsDataHelper.updateCommitteeYear(committeeYear);
  }

  async updateHomeStatements(
    textUpdates: Partial<HomePageStatements>,
    tabVisibilityPatch?: Partial<HomeStatementTabsVisibility>
  ): Promise<Settings> {
    return this.settingsDataHelper.updateHomeStatements(textUpdates, tabVisibilityPatch);
  }

  async updateHomeHeroBanner(message: string): Promise<Settings> {
    return this.settingsDataHelper.updateHomeHeroBanner(message);
  }
}


