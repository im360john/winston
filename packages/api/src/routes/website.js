/**
 * Website analysis endpoint
 */

const express = require('express');
const router = express.Router();
const { analyzeWebsite } = require('../services/website-analyzer');

/**
 * POST /api/website/analyze
 * Analyze a website and extract business information
 */
router.post('/analyze', async (req, res, next) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Missing required field: url' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    console.log(`[API] Analyzing website: ${url}`);

    const analysis = await analyzeWebsite(url);

    res.json({
      success: true,
      analysis
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
