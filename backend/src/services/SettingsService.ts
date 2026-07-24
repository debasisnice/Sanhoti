import { SettingsDataHelper } from '../data/SettingsDataHelper.js';
import {
  HeroSlots,
  HomeHeroButtonsVisibility,
  HomePageStatements,
  HomePageVideo,
  HomeStatementTabsVisibility,
  Settings,
} from '../models/types.js';

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

  async updateStripeDonation(config: {
    showStripeDonateButton: boolean;
    stripeBuyButtonId: string;
    stripePublishableKey: string;
  }): Promise<Settings> {
    const buyButtonId = config.stripeBuyButtonId.trim();
    const publishableKey = config.stripePublishableKey.trim();

    if (config.showStripeDonateButton) {
      if (!buyButtonId) {
        throw new Error('Stripe buy button ID is required when the donate button is enabled');
      }
      if (!/^buy_btn_/.test(buyButtonId)) {
        throw new Error('Stripe buy button ID must start with buy_btn_');
      }
      if (!publishableKey) {
        throw new Error('Stripe publishable key is required when the donate button is enabled');
      }
      if (!/^pk_(test|live)_/.test(publishableKey)) {
        throw new Error('Stripe publishable key must start with pk_test_ or pk_live_');
      }
    }

    return this.settingsDataHelper.updateStripeDonation({
      showStripeDonateButton: config.showStripeDonateButton,
      stripeBuyButtonId: buyButtonId,
      stripePublishableKey: publishableKey,
    });
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

  async updateHomePageVideos(videos: HomePageVideo[]): Promise<Settings> {
    return this.settingsDataHelper.updateHomePageVideos(videos);
  }

  async updateHomeSectionOrder(order: string[]): Promise<Settings> {
    return this.settingsDataHelper.updateHomeSectionOrder(order);
  }

  async updateHeroSlots(heroSlots: HeroSlots): Promise<Settings> {
    return this.settingsDataHelper.updateHeroSlots(heroSlots);
  }

  async updateHomeHeroButtons(patch: Partial<HomeHeroButtonsVisibility>): Promise<Settings> {
    return this.settingsDataHelper.updateHomeHeroButtons(patch);
  }
}


