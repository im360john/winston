/**
 * Website Analysis Service
 *
 * Scrapes tenant website and extracts business information using Claude Sonnet
 * Target: <10 seconds for analysis
 */

const axios = require('axios');

/**
 * Analyze a tenant's website
 *
 * @param {string} websiteUrl - URL to analyze
 * @returns {Object} Extracted business information
 */
async function analyzeWebsite(websiteUrl) {
  const startTime = Date.now();

  try {
    console.log(`[Website Analyzer] Analyzing ${websiteUrl}...`);

    // Step 1: Fetch website content (with timeout)
    const html = await fetchWebsite(websiteUrl);

    // Step 2: Extract text content (remove HTML tags, scripts, etc.)
    const textContent = extractTextContent(html);

    // Step 3: Use Claude Sonnet to analyze content
    const analysis = await analyzeWithClaude(textContent, websiteUrl);

    const duration = Date.now() - startTime;
    console.log(`[Website Analyzer] Analysis completed in ${duration}ms`);

    return {
      ...analysis,
      sourceUrl: websiteUrl,
      analysisTime: duration
    };

  } catch (error) {
    console.error('[Website Analyzer] Error:', error.message);
    throw new Error(`Website analysis failed: ${error.message}`);
  }
}

/**
 * Fetch website HTML content
 */
async function fetchWebsite(url) {
  try {
    const response = await axios.get(url, {
      timeout: 5000, // 5 second timeout
      headers: {
        'User-Agent': 'Winston-Bot/1.0 (Website Analyzer)'
      },
      maxRedirects: 5
    });

    return response.data;

  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Website took too long to respond (timeout)');
    }
    throw new Error(`Failed to fetch website: ${error.message}`);
  }
}

/**
 * Extract clean text content from HTML
 */
function extractTextContent(html) {
  // Simple text extraction - remove HTML tags and scripts
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Limit to first 5000 characters for Claude analysis
  if (text.length > 5000) {
    text = text.substring(0, 5000) + '...';
  }

  return text;
}

/**
 * Analyze website content using Claude Sonnet
 */
async function analyzeWithClaude(textContent, url) {
  const prompt = `Analyze this website content and extract business information.

Website URL: ${url}

Content:
${textContent}

Extract and return the following information in JSON format:
{
  "businessName": "The business name",
  "industry": "Industry category (e.g., cannabis, retail, healthcare)",
  "subIndustry": "More specific category (e.g., dispensary, cafe, clinic)",
  "location": "City, State or address",
  "hours": "Business hours if available",
  "description": "Brief 1-2 sentence description of the business",
  "brandColors": {
    "primary": "#hexcolor or null",
    "secondary": "#hexcolor or null"
  },
  "suggestedCapabilities": [
    "List 3-5 things an AI assistant could help with for this business"
  ],
  "suggestedAgentName": "A friendly name for their AI assistant",
  "tone": "casual, professional, or formal - based on the website's vibe"
}

If information is not available, use null. Be concise and accurate.`;

  try {
    // Call LLM proxy with Claude Sonnet (using Winston's proxy for metering)
    const proxyUrl = process.env.LLM_PROXY_URL || 'http://localhost:3002';
    const response = await axios.post(
      `${proxyUrl}/v1/messages`,
      {
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': 'Bearer winston-00000000-0000-0000-0000-000000000000', // Special system tenant for internal operations
          'Content-Type': 'application/json'
        },
        timeout: 8000 // 8 second timeout (leaving 2s for other operations)
      }
    );

    // Extract JSON from Claude's response
    const responseText = response.data.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Claude response');
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return analysis;

  } catch (error) {
    if (error.response?.status === 402) {
      throw new Error('System credits exhausted - cannot analyze website');
    }
    throw new Error(`Claude analysis failed: ${error.message}`);
  }
}

module.exports = {
  analyzeWebsite
};
