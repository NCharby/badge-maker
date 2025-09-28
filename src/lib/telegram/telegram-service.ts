import { TelegramBotService, createTelegramBotService } from './bot-service';
import { TelegramDatabaseService } from './database-service';
import { 
  TelegramConfig, 
  TelegramInvite, 
  TelegramGroupInfo,
  CreateInviteLinkRequest 
} from '@/types/telegram';

export class TelegramService {
  private botService: TelegramBotService | null;
  private dbService: TelegramDatabaseService;

  constructor() {
    this.botService = createTelegramBotService();
    this.dbService = new TelegramDatabaseService();
  }

  /**
   * Check if Telegram integration is available
   * NEW: Also returns true if per-event invite is configured
   */
  async isAvailable(eventSlug: string): Promise<boolean> {
    try {
      const config = await this.dbService.getEventTelegramConfig(eventSlug);
      
      if (!config || !config.enabled) {
        return false;
      }
      
      // NEW: Check if per-event invite is configured
      if (config.inviteLink) {
        return true;
      }
      
      // Check if bot token is available in environment for per-attendee generation
      const envBotToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!envBotToken) {
        return false;
      }
      
      // Merge environment bot token with database config
      const fullConfig = { ...config, botToken: envBotToken };
      
      const isAvailable = !!fullConfig.botToken && !!fullConfig.privateGroupId;
      
      return isAvailable;
    } catch (error) {
      console.error('Error checking Telegram availability:', error);
      return false;
    }
  }

  /**
   * Get Telegram group information for an event
   */
  async getGroupInfo(eventSlug: string, sessionId: string): Promise<TelegramGroupInfo | null> {
    try {
      // Get event configuration
      const config = await this.dbService.getEventTelegramConfig(eventSlug);
      if (!config || !config.enabled) {
        return null;
      }

      // Check for existing invite
      const existingInvite = await this.dbService.getExistingInvite(sessionId);
      
      // Get event ID for potential invite generation
      const eventId = await this.dbService.getEventId(eventSlug);
      if (!eventId) {
        console.error('Event not found:', eventSlug);
        return null;
      }

      const groupInfo: TelegramGroupInfo = {
        eventSlug,
        config,
        publicChannel: config.publicChannel ? {
          url: config.publicChannel,
          name: config.channelName || 'Public Channel'
        } : undefined
      };

      // Add private invite if available
      if (existingInvite) {
        groupInfo.privateInvite = existingInvite;
      }

      return groupInfo;
    } catch (error) {
      console.error('Error getting group info:', error);
      return null;
    }
  }

  /**
   * Generate a unique invite link for a private group
   * NEW: Checks for per-event invite link first, falls back to per-attendee generation
   */
  async generatePrivateInvite(eventSlug: string, sessionId: string): Promise<TelegramInvite | null> {
    try {
      // NEW: Check for per-event invite link first
      const eventInvite = await this.dbService.getEventInviteLink(eventSlug);
      if (eventInvite) {
        console.log(`Using per-event invite link for ${eventSlug}: ${eventInvite}`);
        
        // Get event ID for the invite record
        const eventId = await this.dbService.getEventId(eventSlug);
        if (!eventId) {
          throw new Error('Event not found');
        }

        // Create a TelegramInvite object from the event invite
        const eventInviteData = await this.dbService.getEventInviteWithMetadata(eventSlug);
        if (eventInviteData) {
          return {
            id: `event-${eventSlug}`, // Use event slug as ID for per-event invites
            inviteLink: eventInviteData.inviteLink,
            expiresAt: eventInviteData.expiresAt ? new Date(eventInviteData.expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year default
            createdAt: eventInviteData.createdAt ? new Date(eventInviteData.createdAt) : new Date()
          };
        }
      }

      // Fallback to per-attendee generation (existing logic)
      if (!this.botService) {
        throw new Error('Telegram bot service not available');
      }

      // Get event configuration
      const config = await this.dbService.getEventTelegramConfig(eventSlug);
      console.log('Retrieved Telegram config:', config);
      
      if (!config?.enabled || !config.privateGroupId) {
        throw new Error('Telegram private group not configured for this event');
      }

      // Check if bot token is available in environment
      const envBotToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!envBotToken) {
        throw new Error('TELEGRAM_BOT_TOKEN not configured in environment');
      }

      // Merge environment bot token with database config
      const fullConfig = { ...config, botToken: envBotToken };

      // Check for existing valid invite
      const existingInvite = await this.dbService.getExistingInvite(sessionId);
      if (existingInvite) {
        return existingInvite;
      }

       // Get event ID
       const eventId = await this.dbService.getEventId(eventSlug);
       if (!eventId) {
         throw new Error('Event not found');
       }

       // Ensure session exists (create test session if needed)
       await this.dbService.getOrCreateTestSession(eventSlug, sessionId);

       // Generate unique invite name
       const inviteName = TelegramBotService.generateInviteName(sessionId, eventSlug);
      
      // Calculate expiration
      const expireDate = TelegramBotService.calculateExpiration();
      
      // Create invite link via Telegram Bot API
      const request: CreateInviteLinkRequest = {
        chat_id: fullConfig.privateGroupId,
        name: inviteName,
        expire_date: expireDate,
        member_limit: 1, // One-time use
        creates_join_request: false
      };

      console.log('Creating Telegram invite with request:', {
        chat_id: request.chat_id,
        name: request.name,
        expire_date: request.expire_date,
        member_limit: request.member_limit,
        creates_join_request: request.creates_join_request
      });

      const botResponse = await this.botService.createChatInviteLink(request);
      
      // Store in database
      const expiresAt = new Date(expireDate * 1000);
      const storedInvite = await this.dbService.storeInviteLink(
        eventId,
        sessionId,
        botResponse.invite_link,
        expiresAt
      );

      if (!storedInvite) {
        throw new Error('Failed to store invite link in database');
      }

      return storedInvite;
    } catch (error) {
      console.error('Error generating private invite:', error);
      console.error('Error details:', {
        eventSlug,
        sessionId,
        hasBotService: !!this.botService,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }

  /**
   * Test bot connection
   */
  async testBotConnection(eventSlug: string): Promise<boolean> {
    try {
      // Check if Telegram is available for this event
      const isAvailable = await this.isAvailable(eventSlug);
      if (!isAvailable) {
        return false;
      }

      if (!this.botService) {
        return false;
      }

      return await this.botService.testConnection();
    } catch (error) {
      console.error('Bot connection test failed:', error);
      return false;
    }
  }

  /**
   * Clean up expired invites
   */
  async cleanupExpiredInvites(): Promise<number> {
    try {
      return await this.dbService.cleanupExpiredInvites();
    } catch (error) {
      console.error('Error cleaning up expired invites:', error);
      return 0;
    }
  }

  /**
   * NEW: Get per-event invite link directly
   * Returns the permanent invite link for an event without generating a new one
   */
  async getEventInviteLink(eventSlug: string): Promise<TelegramInvite | null> {
    try {
      const eventInvite = await this.dbService.getEventInviteLink(eventSlug);
      if (!eventInvite) {
        return null;
      }

      const eventInviteData = await this.dbService.getEventInviteWithMetadata(eventSlug);
      if (!eventInviteData) {
        return null;
      }

      return {
        id: `event-${eventSlug}`,
        inviteLink: eventInviteData.inviteLink,
        expiresAt: eventInviteData.expiresAt ? new Date(eventInviteData.expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        createdAt: eventInviteData.createdAt ? new Date(eventInviteData.createdAt) : new Date()
      };
    } catch (error) {
      console.error('Error getting event invite link:', error);
      return null;
    }
  }

  /**
   * NEW: Check if event has per-event invite configured
   */
  async hasEventInvite(eventSlug: string): Promise<boolean> {
    try {
      const eventInvite = await this.dbService.getEventInviteLink(eventSlug);
      return !!eventInvite;
    } catch (error) {
      console.error('Error checking event invite:', error);
      return false;
    }
  }
}

/**
 * Factory function to create TelegramService instance
 */
export function createTelegramService(): TelegramService {
  return new TelegramService();
}
