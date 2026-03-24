const axios = require('axios');
const { apiLogger } = require('../middleware/logger');

class ClaudeService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.baseURL = 'https://api.anthropic.com/v1/messages';
    this.model = 'claude-3-5-sonnet-20241022'; // Latest Claude 3.5 Sonnet
  }

  // Enhanced AI Chat with Claude 3.5 Sonnet
  async chatWithClaude(userQuery, marketContext = '') {
    try {
      if (!this.apiKey) {
        throw new Error('Anthropic API key not configured');
      }

      const systemPrompt = `You are an expert Indian stock market analyst with deep knowledge of:
- NSE and BSE markets
- Technical and fundamental analysis
- Indian economic indicators
- Sector-specific insights
- Risk management strategies

Current market context: ${marketContext}

Provide accurate, actionable insights based on real-time data and current market conditions.`;

      const response = await axios.post(this.baseURL, {
        model: this.model,
        max_tokens: 2000,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userQuery
          }
        ]
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        timeout: 30000
      });

      const aiResponse = response.data.content[0].text;
      
      apiLogger.info('ClaudeService', 'chatWithClaude', {
        queryLength: userQuery.length,
        responseLength: aiResponse.length,
        model: this.model
      });

      return {
        response: aiResponse,
        model: this.model,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      apiLogger.error('ClaudeService', 'chatWithClaude', error);
      throw error;
    }
  }

  // Get service status
  getStatus() {
    return {
      model: this.model,
      apiKeyConfigured: !!this.apiKey,
      provider: 'Anthropic Claude',
      version: '3.5 Sonnet (Latest)'
    };
  }
}

module.exports = new ClaudeService();