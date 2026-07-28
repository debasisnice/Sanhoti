import express, { Response } from 'express';
import { MenuService } from '../services/MenuService.js';

/**
 * Public menus for the /bengali-food page. Reads the same MenuService the
 * `/seo` prerender uses, so the two surfaces cannot show different food.
 */
export class MenuController {
  private menuService: MenuService;

  constructor() {
    this.menuService = new MenuService();
  }

  async getPublicMenus(req: express.Request, res: Response): Promise<void> {
    try {
      // Capped by default so the food page cannot grow unbounded as events
      // accumulate. `?limit=0` returns everything for any caller that needs it.
      const raw = req.query.limit;
      const limit =
        raw === undefined ? MenuService.FOOD_PAGE_LIMIT : Math.max(0, parseInt(String(raw), 10) || 0);

      const [menus, total] = await Promise.all([
        this.menuService.getPublicMenus(limit || undefined),
        this.menuService.countPublicMenus(),
      ]);
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json({ menus, total });
    } catch (error) {
      console.error('Error building public menus:', error);
      res.status(500).json({ error: 'Failed to load menus' });
    }
  }
}
