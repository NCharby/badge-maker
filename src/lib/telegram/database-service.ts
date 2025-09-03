import { supabase } from '@/lib/supabase';
import { TelegramConfig, TelegramInvite } from '@/types/telegram';

export class TelegramDatabaseService {
  private supabase = supabase;

  /**
   * Get Telegram configuration for an event
   */
  async getEventTelegramConfig(eventSlug: string): Promise<TelegramConfig | null> {
    try {
      const { data, error } = await this.supabase
        .from('events')
        .select('telegram_config')
        .eq('slug', eventSlug)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error fetching Telegram config:', error);
        return null;
      }

      return data?.telegram_config || null;
    } catch (error) {
      console.error('Error in getEventTelegramConfig:', error);
      return null;
    }
  }

  /**
   * Store a new Telegram invite link
   */
  async storeInviteLink(
    eventId: string,
    sessionId: string,
    inviteLink: string,
    expiresAt: Date
  ): Promise<TelegramInvite | null> {
    try {
      const { data, error } = await this.supabase
        .from('telegram_invites')
        .insert({
          event_id: eventId,
          session_id: sessionId,
          invite_link: inviteLink,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error storing invite link:', error);
        return null;
      }

      return {
        id: data.id,
        inviteLink: data.invite_link,
        expiresAt: new Date(data.expires_at),
        usedAt: data.used_at ? new Date(data.used_at) : undefined,
        createdAt: new Date(data.created_at),
      };
    } catch (error) {
      console.error('Error in storeInviteLink:', error);
      return null;
    }
  }

  /**
   * Get existing invite link for a session
   */
  async getExistingInvite(sessionId: string): Promise<TelegramInvite | null> {
    try {
      const { data, error } = await this.supabase
        .from('telegram_invites')
        .select('*')
        .eq('session_id', sessionId)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        inviteLink: data.invite_link,
        expiresAt: new Date(data.expires_at),
        usedAt: data.used_at ? new Date(data.used_at) : undefined,
        createdAt: new Date(data.created_at),
      };
    } catch (error) {
      console.error('Error in getExistingInvite:', error);
      return null;
    }
  }

  /**
   * Mark an invite link as used
   */
  async markInviteAsUsed(inviteId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('telegram_invites')
        .update({ used_at: new Date().toISOString() })
        .eq('id', inviteId);

      if (error) {
        console.error('Error marking invite as used:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markInviteAsUsed:', error);
      return false;
    }
  }

  /**
   * Get event ID by slug
   */
  async getEventId(eventSlug: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('events')
        .select('id')
        .eq('slug', eventSlug)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Error in getEventId:', error);
      return null;
    }
  }

  /**
   * Clean up expired invite links
   */
  async cleanupExpiredInvites(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('telegram_invites')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        console.error('Error cleaning up expired invites:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in cleanupExpiredInvites:', error);
      return 0;
    }
  }

  /**
   * Get or create a test session for testing purposes
   */
  async getOrCreateTestSession(eventSlug: string, sessionId: string): Promise<string> {
    try {
      // First try to get the existing session
      const { data: existingSession, error: sessionError } = await this.supabase
        .from('sessions')
        .select('id')
        .eq('id', sessionId)
        .single();

      if (existingSession) {
        console.log(`Using existing session: ${sessionId}`);
        return existingSession.id;
      }

      // If session doesn't exist, create a test session
      console.log(`Creating test session: ${sessionId}`);
      const eventId = await this.getEventId(eventSlug);
      if (!eventId) {
        throw new Error('Event not found');
      }

      const { data: newSession, error: createError } = await this.supabase
        .from('sessions')
        .insert({
          id: sessionId,
          event_id: eventId,
          session_data: { test: true, created_for: 'telegram_testing' },
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating test session:', createError);
        throw new Error('Failed to create test session');
      }

      console.log(`Created test session: ${newSession.id}`);
      return newSession.id;
    } catch (error) {
      console.error('Error in getOrCreateTestSession:', error);
      throw error;
    }
  }
}
