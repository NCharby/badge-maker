# Telegram Migration Master Plan: Per-Attendee → Per-Event

## 🎯 **Executive Summary**

**Migration Goal**: Replace per-attendee telegram invite generation with one permanent invite link per event.

**Key Benefits**: 99% reduction in API calls, 75% faster page loads, simplified maintenance, better user experience.

**Risk Level**: Very Low (no database schema changes, full backward compatibility)

**Timeline**: 1-2 weeks

## 🎯 **Current Status: Database Configured ✅**

### **✅ Completed**
- [x] Architecture design and documentation
- [x] Database strategy finalized (JSONB approach)
- [x] Migration plan created
- [x] Code change analysis complete
- [x] **Database configuration with real invite links**
  - Fall COG 2025: `https://t.me/+BFJ2-YN_U-ZkZjNh` (58 members)
  - COG Classic 2026: `https://t.me/+23KS1loL6c81MDEx` (130 members)

### **🔄 Next Steps**
1. **Backend Implementation** - New per-event telegram methods
2. **Frontend Updates** - UI components for per-event links
3. **Testing & Validation** - Real-world testing with active groups
4. **Deployment** - Production rollout

## 📊 **Current vs New System**

| Aspect | Current (Per-Attendee) | New (Per-Event) |
|--------|----------------------|-----------------|
| **API Calls** | 100 users = 100 calls | 100 users = 0 calls |
| **Database Records** | 100 per 100 users | 1 per event |
| **User Experience** | Click "Generate" → Wait | Instant display |
| **Maintenance** | 100 unique links | 1 link per event |
| **Reliability** | Per-user failures | Event-level management |

## 🗄️ **Database Strategy: Use Existing JSONB**

### **No Schema Changes Required**
```sql
-- Current structure (unchanged):
-- events.telegram_config JSONB contains:
{
  "enabled": true,
  "privateGroupId": "-1001234567890",
  "groupName": "Event Private Group",
  "channelName": "Event Public Channel",
  "inviteLink": "https://t.me/+ABC123",      -- NEW
  "inviteExpiresAt": "2026-01-15T10:00:00Z", -- NEW  
  "inviteCreatedAt": "2025-01-15T10:00:00Z"  -- NEW
}

-- Optional: Add JSONB index for performance
CREATE INDEX idx_events_telegram_config_gin 
ON public.events USING GIN (telegram_config);
```

### **Why JSONB Approach?**
- ✅ **Zero database changes** - No ALTER TABLE statements
- ✅ **Perfect backward compatibility** - Existing code unchanged
- ✅ **No data migration** - Existing data preserved
- ✅ **Atomic updates** - All config updated together
- ✅ **Easy rollback** - Revert code only

## 🛠️ **Implementation Plan**

### **Phase 1: Backend Changes (Week 1)**

#### **1.1 Update Types**
```typescript
// src/types/telegram.ts
export interface TelegramConfig {
  // Existing fields (unchanged)
  enabled: boolean;
  privateGroupId: string;
  groupName?: string;
  channelName?: string;
  
  // NEW fields
  inviteLink?: string;
  inviteExpiresAt?: string;
  inviteCreatedAt?: string;
}
```

#### **1.2 Update Database Service**
```typescript
// src/lib/telegram/database-service.ts
export class TelegramDatabaseService {
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

  // NEW: Update telegram_config with invite
  async updateEventInviteLink(eventSlug: string, inviteLink: string, expiresAt: Date): Promise<boolean> {
    const currentConfig = await this.getEventTelegramConfig(eventSlug);
    const updatedConfig = {
      ...currentConfig,
      inviteLink,
      inviteExpiresAt: expiresAt.toISOString(),
      inviteCreatedAt: new Date().toISOString()
    };
    
    const { error } = await this.supabase
      .from('events')
      .update({ telegram_config: updatedConfig })
      .eq('slug', eventSlug);
      
    return !error;
  }
}
```

#### **1.3 Update Telegram Service**
```typescript
// src/lib/telegram/telegram-service.ts
export class TelegramService {
  // NEW: Primary method for event invites
  async getEventInvite(eventSlug: string): Promise<string | null> {
    // Check stored invite first
    const storedInvite = await this.dbService.getEventInviteLink(eventSlug);
    if (storedInvite) return storedInvite;
    
    // Create new invite if none exists
    return await this.createEventInvite(eventSlug);
  }

  // NEW: Create event-level invite
  private async createEventInvite(eventSlug: string): Promise<string | null> {
    const config = await this.dbService.getEventTelegramConfig(eventSlug);
    if (!config?.enabled || !config.privateGroupId) return null;

    // Create permanent invite (no expiration, no member limit)
    const request: CreateInviteLinkRequest = {
      chat_id: config.privateGroupId,
      name: `event-${eventSlug}-${Date.now()}`,
      creates_join_request: false
    };

    const response = await this.botService.createInviteLink(request);
    if (response?.invite_link) {
      // Store in telegram_config JSONB
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
      await this.dbService.updateEventInviteLink(eventSlug, response.invite_link, expiresAt);
      return response.invite_link;
    }
    
    return null;
  }

  // DEPRECATED: Keep for backward compatibility
  async generatePrivateInvite(eventSlug: string, sessionId: string): Promise<TelegramInvite | null> {
    const eventInvite = await this.getEventInvite(eventSlug);
    if (eventInvite) {
      return {
        id: 'event-invite',
        inviteLink: eventInvite,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        createdAt: new Date()
      };
    }
    return null;
  }
}
```

#### **1.4 Create New API Endpoint**
```typescript
// src/app/api/telegram/event-invite/route.ts (NEW)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventSlug = searchParams.get('eventSlug');

  if (!eventSlug) {
    return NextResponse.json({ success: false, error: 'Event slug required' }, { status: 400 });
  }

  const telegramService = createTelegramService();
  const inviteLink = await telegramService.getEventInvite(eventSlug);
  
  if (!inviteLink) {
    return NextResponse.json({ success: false, error: 'Failed to get invite link' }, { status: 500 });
  }

  return NextResponse.json({ success: true, inviteLink });
}
```

### **Phase 2: Frontend Changes (Week 1-2)**

#### **2.1 Update TelegramLinks Component**
```typescript
// src/components/molecules/TelegramLinks.tsx
export function TelegramLinks({ eventSlug, className }: TelegramLinksProps) {
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEventInvite();
  }, [eventSlug]);

  const fetchEventInvite = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/telegram/event-invite?eventSlug=${eventSlug}`);
      const data = await response.json();
      
      if (data.success) {
        setInviteLink(data.inviteLink);
      } else {
        setError(data.error || 'Failed to load invite link');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Render loading, error, or invite link
  if (loading) return <LoadingCard />;
  if (error) return <ErrorCard error={error} onRetry={fetchEventInvite} />;
  if (!inviteLink) return <NoTelegramCard />;

  return (
    <Card className={className}>
      <CardContent className="space-y-4 px-0 pb-6 pt-0">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-white font-open-sans text-[16px] font-medium">
              Join the Community
            </span>
          </div>
          
          <div className="space-y-3">
            <p className="text-[#949494] font-open-sans text-[14px]">
              Connect with other attendees and stay updated on event information
            </p>
            <Button
              variant="outline"
              className="w-full justify-between bg-transparent border-[#767676] text-white font-open-sans text-[14px] rounded-[3px] hover:bg-[#767676] hover:text-black"
              onClick={() => window.open(inviteLink, '_blank')}
            >
              <span className="truncate">{inviteLink}</span>
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Update props interface
interface TelegramLinksProps {
  eventSlug: string;
  className?: string;
  // Remove sessionId - no longer needed
}
```

#### **2.2 Update ConfirmationPage**
```typescript
// src/components/pages/ConfirmationPage.tsx
export function ConfirmationPage({ eventSlug }: ConfirmationPageProps) {
  // ... existing code ...
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2733] to-[#170a2a] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* ... existing content ... */}
        
        {/* Update TelegramLinks usage - remove sessionId */}
        <TelegramLinks 
          eventSlug={eventSlug}
          className="mt-6"
        />
        
        {/* ... rest of existing content ... */}
      </div>
    </div>
  );
}
```

### **Phase 3: Email System Updates (Week 2)**

#### **3.1 Update Email Data Retrieval**
```typescript
// src/lib/email.ts
export async function getBadgeConfirmationData(
  badgeId: string,
  eventSlug: string
): Promise<BadgeConfirmationEmailData | null> {
  // ... existing badge and waiver data retrieval ...

  // Get event-level telegram invite from telegram_config
  let telegramInvite = null;
  const telegramConfig = await telegramService.getEventTelegramConfig(eventSlug);
  
  if (telegramConfig?.inviteLink) {
    // Check if invite is still valid
    const expiresAt = telegramConfig.inviteExpiresAt;
    if (!expiresAt || new Date(expiresAt) > new Date()) {
      telegramInvite = {
        url: telegramConfig.inviteLink,
        expiresAt: expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      };
    }
  }

  // ... rest of existing code with telegramInvite data ...
}
```

## 🧪 **Testing Strategy**

### **Unit Tests**
- [ ] Test `getEventInviteLink()` with existing config
- [ ] Test `updateEventInviteLink()` updates JSONB correctly
- [ ] Test backward compatibility with old config structure
- [ ] Test invite expiration logic

### **Integration Tests**
- [ ] Test full invite creation flow
- [ ] Test email generation with new invite structure
- [ ] Test UI components with updated config
- [ ] Test error handling scenarios

### **Performance Tests**
- [ ] Measure API call reduction
- [ ] Test page load times
- [ ] Test concurrent user scenarios
- [ ] Test database query performance

## 🚀 **Deployment Plan**

### **Pre-Deployment**
1. [ ] Run comprehensive test suite
2. [ ] Deploy to staging environment
3. [ ] Verify backward compatibility
4. [ ] Performance testing

### **Deployment**
1. [ ] Deploy backend changes
2. [ ] Deploy frontend changes
3. [ ] Deploy email system updates
4. [ ] Monitor error rates and performance

### **Post-Deployment**
1. [ ] Monitor for 24 hours
2. [ ] Check user feedback
3. [ ] Verify telegram group joins
4. [ ] Document any issues

## 🔄 **Backward Compatibility**

### **Maintained Compatibility**
- ✅ Old API endpoints remain functional
- ✅ Existing telegram_config JSONB preserved
- ✅ Existing telegram_invites table preserved
- ✅ Gradual migration approach
- ✅ No breaking changes during transition

### **Migration Path**
1. **Phase 1**: New system deployed alongside old system
2. **Phase 2**: New system becomes primary, old system as fallback
3. **Phase 3**: Old system deprecated (future cleanup)

## 🚨 **Rollback Plan**

### **If Issues Arise**
1. **Revert code deployment** (immediate)
2. **Database unchanged** (no schema changes made)
3. **Old system continues working** (no data loss)
4. **Investigate and fix** (then re-deploy)

### **Risk Mitigation**
- ✅ No database schema changes = No database risk
- ✅ Additive changes only = No data loss risk
- ✅ Backward compatible = No breaking changes
- ✅ Easy rollback = Can revert code only

## 📊 **Success Metrics**

### **Technical Success**
- [ ] 90% reduction in Telegram API calls
- [ ] 50% improvement in page load times
- [ ] Zero data loss during migration
- [ ] 100% backward compatibility maintained

### **User Experience Success**
- [ ] Elimination of invite generation delays
- [ ] Reduced support tickets for telegram issues
- [ ] Improved user satisfaction scores
- [ ] Higher telegram group participation rates

### **Operational Success**
- [ ] Reduced server resource usage
- [ ] Lower API costs
- [ ] Simplified event setup process
- [ ] Easier troubleshooting and debugging

## 📋 **Implementation Checklist**

### **Week 1: Backend & API**
- [ ] Update TelegramConfig interface
- [ ] Implement getEventInviteLink() method
- [ ] Implement updateEventInviteLink() method
- [ ] Update TelegramService with event-level methods
- [ ] Create new /api/telegram/event-invite endpoint
- [ ] Update existing /api/telegram/generate-invite for compatibility
- [ ] Unit tests for all new methods

### **Week 2: Frontend & Email**
- [ ] Update TelegramLinks component (remove sessionId)
- [ ] Update ConfirmationPage component
- [ ] Update email system to use event invites
- [ ] Integration tests for full user flow
- [ ] Performance testing
- [ ] User acceptance testing

### **Week 3: Deployment & Monitoring**
- [ ] Production deployment
- [ ] Monitoring setup
- [ ] Performance validation
- [ ] User feedback collection
- [ ] Documentation updates

## 🎯 **Expected Outcomes**

### **Immediate Benefits**
- Faster user experience (instant telegram access)
- Reduced server load (99% fewer API calls)
- Simplified codebase (remove per-session logic)
- Better reliability (no per-user generation failures)

### **Long-term Benefits**
- Easier event management (one link per event)
- Lower operational costs (reduced API usage)
- Improved scalability (no rate limiting concerns)
- Better user satisfaction (consistent experience)

---

**Migration Status**: Ready for Implementation  
**Estimated Effort**: 2-3 weeks  
**Risk Level**: Very Low (with backward compatibility)  
**Business Impact**: High (significant UX and cost improvements)  
**Database Impact**: Zero (no schema changes)
