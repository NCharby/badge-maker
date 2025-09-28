// Telegram integration types for Badge Maker

export interface TelegramConfig {
  enabled: boolean;
  botToken?: string;            // Bot token from environment variable
  privateGroupId: string;       // Telegram group ID for private groups
  publicChannel?: string;       // https://t.me/channelname
  groupName?: string;           // Display name for the group
  channelName?: string;         // Display name for the channel
  description?: string;         // Optional description
  
  // NEW: Per-event invite link fields
  inviteLink?: string;          // Permanent invite link for the event
  inviteExpiresAt?: string;     // Expiration date of the invite link
  inviteCreatedAt?: string;     // Creation date of the invite link
}

export interface TelegramInvite {
  id: string;
  inviteLink: string;
  expiresAt: Date | string;  // Can be Date object or ISO string from API
  usedAt?: Date | string;    // Can be Date object or ISO string from API
  createdAt: Date | string;  // Can be Date object or ISO string from API
}

export interface TelegramGroupInfo {
  eventSlug: string;
  config: TelegramConfig;
  privateInvite?: TelegramInvite;
  publicChannel?: {
    url: string;
    name: string;
  };
}

// Telegram Bot API response types
export interface TelegramBotResponse<T = any> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}

export interface TelegramChatInviteLink {
  invite_link: string;
  creator: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  creates_join_request: boolean;
  is_primary: boolean;
  is_revoked: boolean;
  name?: string;
  expire_date?: number;
  member_limit?: number;
  pending_join_request_count?: number;
}

export interface CreateInviteLinkRequest {
  chat_id: string;
  name?: string;
  expire_date?: number;
  member_limit?: number;
  creates_join_request?: boolean;
}

// API request/response types
export interface GenerateInviteRequest {
  eventSlug: string;
  sessionId: string;
}

export interface GenerateInviteResponse {
  success: boolean;
  invite?: TelegramInvite;
  error?: string;
}

export interface GroupInfoResponse {
  success: boolean;
  data?: TelegramGroupInfo;
  error?: string;
}
