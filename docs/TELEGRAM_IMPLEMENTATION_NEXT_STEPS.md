# Telegram Migration: Next Implementation Steps

## 🎯 **Current Status: Database Ready ✅**

The database is now configured with real telegram invite links for both events:
- **Fall COG 2025**: `https://t.me/+BFJ2-YN_U-ZkZjNh` (58 members)
- **COG Classic 2026**: `https://t.me/+23KS1loL6c81MDEx` (130 members)

## 🚀 **Ready to Implement: Backend Changes**

### **Step 1: Update TypeScript Types**

Update `src/types/telegram.ts` to include the new fields:

```typescript
export interface TelegramConfig {
  // Existing fields (unchanged)
  enabled: boolean;
  privateGroupId: string;
  groupName?: string;
  channelName?: string;
  
  // NEW fields for per-event invites
  inviteLink?: string;
  inviteExpiresAt?: string;
  inviteCreatedAt?: string;
}
```

### **Step 2: Create New Database Service Methods**

Add to `src/lib/telegram/database-service.ts`:

```typescript
// NEW: Get event invite from telegram_config
async getEventInviteLink(eventSlug: string): Promise<string | null> {
  const config = await this.getEventTelegramConfig(eventSlug);
  if (!config?.inviteLink) return null;
  
  // Check expiration
  if (config.inviteExpiresAt && new Date(config.inviteExpiresAt) < new Date()) {
    return null;
  }
  
  return config.inviteLink;
}
```

### **Step 3: Update API Routes**

Modify `src/app/api/telegram/invite/route.ts` to use per-event links:

```typescript
// NEW: Check for existing event invite first
const eventInvite = await telegramService.getEventInviteLink(eventSlug);
if (eventInvite) {
  return NextResponse.json({
    inviteLink: eventInvite,
    expiresAt: config.inviteExpiresAt,
    source: 'event'
  });
}

// Fallback to per-attendee generation (for backward compatibility)
```

### **Step 4: Update Frontend Components**

Modify `src/components/molecules/TelegramLinks.tsx`:

```typescript
// NEW: Display event invite immediately
const eventInvite = await getEventInviteLink(eventSlug);
if (eventInvite) {
  // Show invite link instantly - no generation needed
  return <EventInviteDisplay inviteLink={eventInvite} />;
}
```

## 🧪 **Testing Strategy**

### **Test with Real Data**
1. **Fall COG 2025**: Test with 58-member group
2. **COG Classic 2026**: Test with 130-member group
3. **Default Event**: Test fallback behavior

### **Validation Points**
- ✅ Invite links display instantly
- ✅ No API generation delays
- ✅ Email integration works
- ✅ Existing members unaffected
- ✅ Backward compatibility maintained

## 📈 **Expected Performance Gains**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Page Load Time** | 3-5 seconds | <1 second | 75% faster |
| **API Calls** | 100 per 100 users | 0 per 100 users | 99% reduction |
| **User Experience** | Click → Wait → Link | Instant link | Immediate |
| **Server Load** | High during events | Minimal | 95% reduction |

## 🎯 **Implementation Priority**

1. **High Priority**: Backend methods (enables instant links)
2. **Medium Priority**: Frontend updates (improves UX)
3. **Low Priority**: Monitoring and analytics

## 🔄 **Rollback Plan**

If issues arise:
1. **Code Rollback**: Revert to per-attendee generation
2. **Database**: No changes needed (JSONB is additive)
3. **Users**: Seamless fallback to existing system

---

**Ready to proceed with backend implementation!** 🚀
