# Telegram Migration Quick Reference

> **📋 Complete Documentation**: See `docs/TELEGRAM_MIGRATION_MASTER_PLAN.md` for full implementation details.

## 🎯 **What's Changing**

| **Before (Per-Attendee)** | **After (Per-Event)** |
|---------------------------|----------------------|
| 100 attendees = 100 API calls | 100 attendees = 0 API calls |
| Unique invite per session | One invite per event |
| "Generate Invite" button | Instant display |
| 24-hour expiration | Event-level expiration |
| Per-session database records | Event-level storage |

## 🗄️ **Database Changes**

```sql
-- NO SCHEMA CHANGES REQUIRED!
-- Use existing telegram_config JSONB field

-- Optional: Add JSONB index for performance
CREATE INDEX idx_events_telegram_config_gin 
ON public.events USING GIN (telegram_config);
```

## 🔧 **Key Code Changes**

### **New API Endpoint**
```
GET /api/telegram/event-invite?eventSlug=fall-cog-2025
```

### **Updated Component Props**
```typescript
// Before
<TelegramLinks eventSlug="fall-cog-2025" sessionId="abc123" />

// After  
<TelegramLinks eventSlug="fall-cog-2025" />
```

### **New Service Method**
```typescript
// New primary method (uses telegram_config JSONB)
const inviteLink = await telegramService.getEventInvite(eventSlug);

// Deprecated (kept for compatibility)
const invite = await telegramService.generatePrivateInvite(eventSlug, sessionId);
```

## 📧 **Email Changes**

### **Before**
```typescript
// Per-session invite in email
telegramInvite: {
  url: "https://t.me/+unique-session-link",
  expiresAt: "2025-01-15T10:00:00Z"
}
```

### **After**
```typescript
// Event-level invite in email
telegramInvite: {
  url: "https://t.me/+event-permanent-link", 
  expiresAt: "2026-01-15T10:00:00Z"
}
```

## 🚀 **Migration Steps**

1. **Database**: No changes needed (use existing telegram_config JSONB)
2. **Backend**: Update TelegramService with event-level methods
3. **API**: Create new `/api/telegram/event-invite` endpoint
4. **Frontend**: Update TelegramLinks component (remove sessionId)
5. **Email**: Update email system to use event invites
6. **Test**: Verify functionality and performance
7. **Deploy**: Roll out with backward compatibility

## ⚡ **Performance Impact**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| API Calls | 100 per 100 users | 1 per event | 99% reduction |
| Page Load | ~2-3 seconds | ~0.5 seconds | 75% faster |
| Database Queries | 100 per 100 users | 1 per event | 99% reduction |
| User Experience | Generate → Wait | Instant | 100% better |

## 🔄 **Backward Compatibility**

- ✅ Old API endpoints remain functional
- ✅ Existing telegram_config JSONB preserved
- ✅ Existing telegram_invites table preserved
- ✅ Gradual migration approach
- ✅ No breaking changes during transition

## 🎯 **Success Metrics**

- [ ] 90% reduction in Telegram API calls
- [ ] 50% improvement in page load times  
- [ ] Zero data loss during migration
- [ ] 100% backward compatibility maintained
- [ ] Improved user satisfaction

## 🚨 **Rollback Plan**

If issues arise:
1. **Revert code deployment** (immediate)
2. **Database unchanged** (no schema changes made)
3. **Old system continues working** (no data loss)
4. **Investigate and fix** (then re-deploy)

## 📞 **Support Contacts**

- **Technical Issues**: Development Team
- **Database Issues**: Database Administrator  
- **User Issues**: Support Team
- **Performance Issues**: DevOps Team

---

**Migration Status**: Ready for Implementation  
**Timeline**: 2-3 weeks  
**Risk**: Low (with compatibility)  
**Impact**: High (significant improvements)
