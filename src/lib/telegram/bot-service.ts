import { 
  TelegramBotResponse, 
  TelegramChatInviteLink, 
  CreateInviteLinkRequest,
  TelegramInvite 
} from '@/types/telegram';

export class TelegramBotService {
  private botToken: string;
  private baseUrl: string;
  private rateLimitDelay: number = 1000; // 1 second between requests

  constructor(botToken: string) {
    this.botToken = botToken;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  /**
   * Create a unique invite link for a private group
   */
  async createChatInviteLink(request: CreateInviteLinkRequest): Promise<TelegramChatInviteLink> {
    const response = await this.makeRequest<TelegramChatInviteLink>('/createChatInviteLink', request);
    
    if (!response.ok || !response.result) {
      throw new Error(`Failed to create invite link: ${response.description || 'Unknown error'}`);
    }

    return response.result;
  }

  /**
   * Test the bot connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/getMe');
      return response.ok && !!response.result;
    } catch (error) {
      console.error('Telegram bot connection test failed:', error);
      return false;
    }
  }

  /**
   * Make a request to the Telegram Bot API with rate limiting
   */
  private async makeRequest<T = any>(
    endpoint: string, 
    data?: any
  ): Promise<TelegramBotResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: data ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: TelegramBotResponse<T> = await response.json();
      
      // Rate limiting - wait before next request
      await this.delay(this.rateLimitDelay);
      
      return result;
    } catch (error) {
      console.error(`Telegram API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Delay execution for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate a unique name for the invite link
   */
  static generateInviteName(sessionId: string, eventSlug: string): string {
    const timestamp = Date.now().toString(36);
    const shortSessionId = sessionId.substring(0, 8);
    return `badge-${eventSlug}-${shortSessionId}-${timestamp}`;
  }

  /**
   * Calculate expiration timestamp (24 hours from now)
   */
  static calculateExpiration(): number {
    const now = Math.floor(Date.now() / 1000);
    const hours24 = 24 * 60 * 60;
    return now + hours24;
  }
}

/**
 * Factory function to create TelegramBotService instance
 */
export function createTelegramBotService(): TelegramBotService | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.warn('TELEGRAM_BOT_TOKEN not configured, Telegram integration disabled');
    return null;
  }

  return new TelegramBotService(botToken);
}
