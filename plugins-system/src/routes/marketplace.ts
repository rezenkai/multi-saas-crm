import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// Get marketplace plugins
router.get('/', async (req: Request, res: Response) => {
  try {
    // Mock marketplace data
    const plugins = [
      {
        id: 'sample-crm-extension',
        name: 'Sample CRM Extension',
        description: 'A sample plugin demonstrating CRM integration capabilities',
        version: '1.0.0',
        author: 'Multi-SaaS Team',
        category: 'productivity',
        price: 0,
        currency: 'USD',
        rating: 4.5,
        reviews: 12,
        downloads: 150,
        icon: 'icon.png',
        screenshots: ['screenshot1.png', 'screenshot2.png'],
        publishedAt: new Date('2024-01-01'),
        updatedAt: new Date(),
        compatibility: ['1.0.0'],
        tags: ['crm', 'analytics', 'sync', 'dashboard'],
      },
    ];

    res.json({
      plugins,
      total: plugins.length,
      page: 1,
      perPage: 10,
    });
  } catch (error) {
    logger.error('Failed to get marketplace plugins:', error);
    res.status(500).json({ error: 'Failed to get marketplace plugins' });
  }
});

// Get plugin details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const pluginId = req.params.id;
    
    // Mock plugin details
    if (pluginId === 'sample-crm-extension') {
      const plugin = {
        id: 'sample-crm-extension',
        name: 'Sample CRM Extension',
        description: 'A sample plugin demonstrating CRM integration capabilities',
        version: '1.0.0',
        author: 'Multi-SaaS Team',
        category: 'productivity',
        price: 0,
        currency: 'USD',
        rating: 4.5,
        reviews: 12,
        downloads: 150,
        icon: 'icon.png',
        screenshots: ['screenshot1.png', 'screenshot2.png'],
        publishedAt: new Date('2024-01-01'),
        updatedAt: new Date(),
        compatibility: ['1.0.0'],
        tags: ['crm', 'analytics', 'sync', 'dashboard'],
        readme: 'This is a sample plugin for demonstration purposes.',
        changelog: 'Initial release',
      };

      res.json(plugin);
    } else {
      res.status(404).json({ error: 'Plugin not found' });
    }
  } catch (error) {
    logger.error('Failed to get plugin details:', error);
    res.status(500).json({ error: 'Failed to get plugin details' });
  }
});

export const marketplaceRoutes = router;