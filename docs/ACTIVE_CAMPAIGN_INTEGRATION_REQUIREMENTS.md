# Active Campaign CRM Integration - Requirements Document

## 🎯 **Project Overview**

Integrate Badge Maker with Active Campaign CRM to automatically sync user data and badge information when users reach the confirmation screen. This integration will use email as the primary key to either create new contacts or update existing ones with the latest event participation data.

## 🔑 **Key Requirements**

### **Data Synchronization**
- **Primary Key**: Email address (unique identifier)
- **Contact Fields**: First Name, Last Name, Date of Birth
- **Event Data**: Dietary Restrictions, Badge Name (as "Preferred Name")
- **Media**: Badge Image (profile photo)
- **Social Media**: All social media handles and platforms
- **Event Context**: Event name and participation date

### **Integration Points**
- **Trigger**: User reaches confirmation screen (after successful badge creation)
- **Timing**: After all data validation and storage is complete
- **Fallback**: Graceful handling if CRM sync fails
- **Audit**: Logging of all CRM operations

### **Data Quality**
- **Validation**: Only sync after successful badge creation
- **Completeness**: Ensure all required fields are populated
- **Formatting**: Proper data formatting for CRM consumption
- **Error Handling**: Don't block user experience if sync fails

## 📊 **Data Mapping**

| Badge Maker Field | Active Campaign Field | Data Type | Required | Notes |
|------------------|----------------------|-----------|----------|-------|
| `email` | Email | String | ✅ | Primary key for contact lookup |
| `firstName` | First Name | String | ✅ | Standard contact field |
| `lastName` | Last Name | String | ✅ | Standard contact field |
| `dateOfBirth` | Date of Birth | Date | ✅ | Standard contact field |
| `badgeName` | Preferred Name | String | ❌ | Badge display name |
| `badgeImage` | Badge Image URL | String | ❌ | Supabase storage URL |
| `dietaryRestrictions` | Dietary Restrictions | Checkbox | ❌ | Array to checkbox selection |
| `dietaryRestrictionsOther` | Dietary Restrictions Other | String | ❌ | Custom dietary restrictions text |
| `volunteeringInterests` | Volunteer Interest | Checkbox | ❌ | Array to checkbox selection |
| `phone` | Phone | String | ❌ | Phone number if provided |
| `socialMediaHandles` | Social Media | Standard Fields | ❌ | Existing Active Campaign fields (Twitter, Discord, etc.) |
| `emergencyContact` | Emergency Contact Name | String | ❌ | Emergency contact name |
| `emergencyPhone` | Emergency Contact Phone | String | ❌ | Emergency contact phone number |

### **Event Tracking**
- **Event Tagging**: Contact will be tagged with the event slug (e.g., "default", "furcon-2025")
- **No Event Fields**: Event slug and participation date are not stored as contact fields

### **Social Media Field Mapping**
Active Campaign already has all required social media fields:
- **Twitter** → `%TWITTER%` (existing field)
- **Blue Sky** → `%BLUE_SKY%` (existing field)
- **Telegram** → `%TELEGRAM%` (existing field)
- **Recon** → `%RECON%` (existing field)
- **Mastodon** → `%MASTODON%` (existing field)
- **FetLife** → `%FETLIFE%` (existing field)
- **Fur Affinity** → `%FUR_AFFINITY%` (existing field)
- **Discord** → `%DISCORD%` (existing field)
- **Instagram** → `%INSTAGRAM%` (existing field)
- **Other** → `%OTHER%` (existing field)

*Note: No custom field creation needed - all required fields already exist in Active Campaign, including the newly created Emergency Contact fields.*

## 🔌 **Technical Requirements**

### **Active Campaign API**
- **Authentication**: API key-based authentication
- **Endpoints**: Contact creation/update, custom field management
- **Rate Limiting**: Respect API rate limits (typically 100 requests/minute)
- **Error Handling**: Comprehensive error response handling
- **Webhooks**: Optional webhook support for real-time updates
- **Environment**: Single production instance (no separate test environment)

### **Data Processing**
- **Image URL Handling**: Store Supabase storage bucket URLs as Badge Image URL field
- **Date Formatting**: Standardize date formats for CRM (YYYY-MM-DD)
- **Array Processing**: Handle dietary restrictions and social media arrays
- **Field Mapping**: Dynamic field mapping based on CRM configuration
- **Data Validation**: Validate data before sending to CRM

### **Security & Privacy**
- **Data Encryption**: Secure transmission of personal data (HTTPS)
- **API Security**: Secure storage of API credentials in environment variables
- **Data Retention**: Follow data retention policies
- **Access Control**: Limit API access to necessary endpoints only

## 🎭 **User Experience Requirements**

### **Transparency**
- **No User Notification**: Users have already agreed to tracking outside this app
- **No Opt-out**: Users may not opt-out at this point in the flow
- **No Status Updates**: Sync happens silently in the background

### **Performance**
- **Non-blocking**: CRM sync shouldn't delay confirmation screen display
- **Background Processing**: Handle sync completely on server side
- **Timeout Handling**: Don't wait indefinitely for CRM response (5-second timeout)
- **Fallback UI**: Show confirmation even if sync fails
- **No Progress Indicators**: Sync happens silently without user interface updates

### **Error Handling**
- **Graceful Degradation**: Application continues to work if CRM is unavailable
- **User Feedback**: Clear error messages for sync failures
- **Retry Logic**: Automatic retry for transient failures
- **Fallback Options**: Automatic retry without user intervention

## 📈 **Business Requirements**

### **Contact Management**
- **New Contacts**: Create new CRM contacts for first-time users
- **Existing Contacts**: Update existing contacts with new event data
- **Data Merging**: Intelligent merging of new and existing data
- **Duplicate Prevention**: Avoid creating duplicate contacts
- **Contact History**: Maintain participation history across events

### **Event Tracking**
- **Participation History**: Track user participation across multiple events
- **Preference Learning**: Build user preference profiles over time
- **Engagement Metrics**: Track user engagement and participation rates
- **Marketing Segmentation**: Enable targeted marketing based on preferences
- **Event Analytics**: Track event-specific participation and preferences

### **Data Quality**
- **Data Completeness**: Ensure all available data is captured
- **Data Accuracy**: Validate data before CRM sync
- **Data Consistency**: Maintain consistent data format across events
- **Data Updates**: Update existing data when new information is available

## 🔧 **Operational Requirements**

### **Monitoring & Alerting**
- **Sync Success Rate**: Monitor successful vs. failed syncs
- **API Performance**: Track API response times and errors
- **Error Alerting**: Alert on sync failures or API issues
- **Usage Metrics**: Track API usage and rate limit consumption
- **Test Data Management**: Monitor and manage test data in production environment

### **Logging & Auditing**
- **Sync Logs**: Log all CRM sync attempts and results
- **Error Logs**: Detailed logging of sync failures
- **User Consent Logs**: Track user opt-in/opt-out decisions
- **Data Change Logs**: Log all data changes sent to CRM

### **Maintenance & Support**
- **API Key Rotation**: Support for API key updates
- **Field Mapping Updates**: Easy updates to field mappings
- **Error Resolution**: Clear procedures for resolving sync issues
- **User Support**: Support procedures for CRM-related issues

## 📋 **Acceptance Criteria**

### **Functional Requirements**
- ✅ CRM sync triggers when user reaches confirmation screen
- ✅ New contacts are created for first-time users
- ✅ Existing contacts are updated with new event data
- ✅ All specified data fields are properly mapped and synced
- ✅ Social media handles are stored in appropriate custom fields
- ✅ Badge image URLs are stored as Badge Image URL field in CRM
- ✅ Emergency contact and phone are stored in CRM
- ✅ Contact is tagged with event slug for event tracking

### **Non-Functional Requirements**
- ✅ Sync completes within 5 seconds
- ✅ 99%+ sync success rate
- ✅ No impact on user experience or confirmation flow
- ✅ Proper error handling and user feedback
- ✅ Comprehensive logging and monitoring
- ✅ Secure handling of API credentials

### **User Experience Requirements**
- ✅ No user notification about CRM integration needed
- ✅ No sync status display needed
- ✅ No opt-out mechanism required
- ✅ Confirmation screen displays regardless of sync status
- ✅ No error messages for sync failures (handled silently)
- ✅ No blocking or delays in user flow

## 🚫 **Out of Scope**

- **Real-time Sync**: This is a one-time sync at confirmation
- **Bulk Data Import**: Only individual user syncs are supported
- **Two-way Sync**: Data flows from Badge Maker to CRM only
- **Advanced CRM Features**: Only basic contact management is included
- **Historical Data Sync**: Only new event participation data is synced

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Status**: For Review  
**Next Step**: Implementation Plan Creation
