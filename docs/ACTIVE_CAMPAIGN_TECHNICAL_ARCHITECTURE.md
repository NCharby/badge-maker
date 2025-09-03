# Active Campaign CRM Integration - Technical Architecture

## 🏗️ **System Architecture Overview**

This document outlines the technical architecture for integrating Active Campaign CRM with Badge Maker. The integration follows a service-oriented architecture pattern with clear separation of concerns, comprehensive error handling, and robust monitoring.

## 🔄 **High-Level Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Badge Maker   │───▶│  CRM Sync      │───▶│ Active Campaign │
│  Confirmation  │    │  Service       │    │     API         │
│     Screen     │    │                │    │                │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Flow    │    │   Data         │    │   CRM          │
│   State        │    │   Processing    │    │   Response     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🏛️ **Component Architecture**

### **1. CRM Integration Service Layer**

```
src/
├── lib/
│   └── crm/
│       ├── active-campaign/
│       │   ├── client.ts              # API client
│       │   ├── types.ts               # Type definitions
│       │   ├── endpoints.ts           # API endpoint definitions
│       │   └── errors.ts              # Error handling
│       ├── services/
│       │   ├── contact-service.ts     # Contact management
│       │   ├── field-service.ts       # Custom field management
│       │   └── sync-service.ts        # Main sync orchestrator
│       ├── transformers/
│       │   ├── data-transformer.ts    # Data transformation
│       │   ├── url-transformer.ts     # URL processing and validation
│       │   └── field-mapper.ts        # Field mapping logic
│       └── utils/
│           ├── validation.ts          # Data validation
│           ├── retry.ts               # Retry logic
│           └── logging.ts             # Logging utilities
```

### **2. Service Dependencies**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Badge Maker   │    │   CRM Sync     │    │   External      │
│   Services     │    │   Services     │    │   Services      │
│                │    │                │    │                │
│ • Badge Store  │───▶│ • Contact      │───▶│ • Active       │
│ • User Flow    │    │   Service      │    │   Campaign     │
│ • Image Store  │    │ • Field        │    │ • Supabase     │
│                │    │   Service      │    │ • Logging      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔌 **API Integration Design**

### **1. Active Campaign API Client**

```typescript
interface ActiveCampaignClient {
  // Authentication
  authenticate(): Promise<void>;
  
  // Contact Management
  findContact(email: string): Promise<Contact | null>;
  createContact(contactData: ContactData): Promise<Contact>;
  updateContact(contactId: string, updates: Partial<ContactData>): Promise<Contact>;
  
  // Custom Fields
  getCustomFields(): Promise<CustomField[]>;
  createCustomField(field: CustomFieldData): Promise<CustomField>;
  
  // Tagging
  addTagToContact(contactId: string, tagName: string): Promise<void>;
  removeTagFromContact(contactId: string, tagName: string): Promise<void>;
  
  // Utilities
  isRateLimited(): boolean;
  getRemainingRequests(): number;
}
```

### **2. API Endpoint Structure**

```typescript
// Base API configuration
const API_CONFIG = {
  baseUrl: process.env.ACTIVE_CAMPAIGN_API_URL,
  apiKey: process.env.ACTIVE_CAMPAIGN_API_KEY,
  rateLimit: {
    requestsPerMinute: 100,
    burstLimit: 10
  },
  timeout: 5000, // 5 seconds
  retryAttempts: 3,
  retryDelay: 1000 // 1 second
};

// API endpoints
const ENDPOINTS = {
  contacts: '/api/3/contacts',
  customFields: '/api/3/fields',
  contactCustomFields: '/api/3/contactCustomFieldData'
};

// Note: All required fields now exist in Active Campaign
// No need to create custom fields for: First Name, Last Name, Email, Phone, Date of Birth,
// Preferred Name, Badge Image URL, Dietary Restrictions, Dietary Restrictions Other, 
// Volunteer Interest, Emergency Contact Name, Emergency Contact Phone, and all social media fields
```

### **3. Rate Limiting & Retry Logic**

```typescript
class RateLimitManager {
  private requestCount = 0;
  private resetTime = Date.now() + 60000; // 1 minute
  
  async executeRequest<T>(request: () => Promise<T>): Promise<T> {
    if (this.isRateLimited()) {
      await this.waitForReset();
    }
    
    try {
      this.requestCount++;
      return await request();
    } catch (error) {
      if (this.shouldRetry(error)) {
        return await this.retryWithBackoff(request);
      }
      throw error;
    }
  }
  
  private async retryWithBackoff<T>(
    request: () => Promise<T>, 
    attempt: number = 1
  ): Promise<T> {
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      return await request();
    } catch (error) {
      if (attempt < 3 && this.shouldRetry(error)) {
        return await this.retryWithBackoff(request, attempt + 1);
      }
      throw error;
    }
  }
}
```

## 📊 **Data Flow Architecture**

### **1. Sync Trigger Flow**

```
1. User reaches confirmation screen
   ↓
2. Badge creation validation passes
   ↓
3. CRM sync service automatically triggered (server-side)
   ↓
4. Data collection and validation
   ↓
5. Contact lookup by email
   ↓
6. Contact creation or update
   ↓
7. Custom field population
   ↓
8. Event tagging applied
   ↓
9. Sync completion (no user notification)
```

### **2. Data Transformation Pipeline**

```
Raw Badge Maker Data
         ↓
   Data Validation
         ↓
   Type Conversion
         ↓
   Field Mapping
         ↓
   Format Standardization
         ↓
   CRM API Payload
```

### **3. Error Handling Flow**

```
API Request
    ↓
Request Validation
    ↓
API Call
    ↓
Response Processing
    ↓
Success / Error
    ↓
Error Classification
    ↓
Retry / Fallback / Log
```

## 🔒 **Security Architecture**

### **1. Authentication & Authorization**

```typescript
class SecurityManager {
  private apiKey: string;
  private baseUrl: string;
  
  constructor() {
    this.apiKey = this.validateApiKey();
    this.baseUrl = this.validateBaseUrl();
  }
  
  private validateApiKey(): string {
    const key = process.env.ACTIVE_CAMPAIGN_API_KEY;
    if (!key || key.length < 32) {
      throw new Error('Invalid API key configuration');
    }
    return key;
  }
  
  getAuthHeaders(): Record<string, string> {
    return {
      'Api-Token': this.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'BadgeMaker-CRM-Integration/1.0'
    };
  }
}
```

### **2. Data Encryption & Privacy**

- **In Transit**: HTTPS/TLS 1.3 encryption
- **At Rest**: Environment variable encryption
- **API Keys**: Secure storage in environment variables
- **User Data**: Secure data handling with audit trail
- **Audit Trail**: Complete logging of all operations

### **3. Access Control**

```typescript
interface AccessControl {
  // API endpoint restrictions
  allowedEndpoints: string[];
  
  // Rate limiting per user
  userRateLimit: number;
  
  // Data access permissions
  canAccessContactData: boolean;
  canModifyContacts: boolean;
  canCreateCustomFields: boolean;
}
```

## 📈 **Performance Architecture**

### **1. Server-Side Background Processing**

```typescript
class CRMSyncService {
  async syncUserData(userData: UserData): Promise<void> {
    // Start sync process completely on server side
    // No user interface updates or status returns
    this.performSyncInBackground(userData);
  }
  
  private async performSyncInBackground(userData: UserData): Promise<void> {
    try {
      // Perform actual sync
      await this.contactService.syncContact(userData);
      
      // Log success (no user notification)
      this.logger.info('CRM sync completed successfully', { email: userData.email });
    } catch (error) {
      // Log error (no user notification)
      this.logger.error('CRM sync failed', { email: userData.email, error: error.message });
    }
  }
}
```

### **2. Caching Strategy**

```typescript
class CacheManager {
  private cache = new Map<string, CacheEntry>();
  private ttl = 5 * 60 * 1000; // 5 minutes
  
  async getCachedData(key: string): Promise<any> {
    const entry = this.cache.get(key);
    if (entry && !this.isExpired(entry)) {
      return entry.data;
    }
    return null;
  }
  
  setCachedData(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}
```

### **3. Performance Monitoring**

```typescript
class PerformanceMonitor {
  private metrics = {
    syncDuration: [] as number[],
    apiResponseTime: [] as number[],
    errorRate: 0,
    successRate: 0
  };
  
  recordSyncDuration(duration: number): void {
    this.metrics.syncDuration.push(duration);
    if (this.metrics.syncDuration.length > 100) {
      this.metrics.syncDuration.shift();
    }
  }
  
  getAverageSyncDuration(): number {
    if (this.metrics.syncDuration.length === 0) return 0;
    const sum = this.metrics.syncDuration.reduce((a, b) => a + b, 0);
    return sum / this.metrics.syncDuration.length;
  }
}
```

## 🧪 **Testing Architecture**

### **1. Testing Strategy**

```typescript
// Unit Tests
describe('CRM Integration Service', () => {
  it('should create new contact for first-time user', async () => {
    const mockApiClient = createMockApiClient();
    const service = new CRMIntegrationService(mockApiClient);
    
    const result = await service.syncUserData(mockUserData);
    expect(result.status).toBe('created');
  });
});

// Integration Tests
describe('CRM API Integration', () => {
  it('should handle rate limiting gracefully', async () => {
    const service = new CRMIntegrationService(realApiClient);
    
    // Make multiple rapid requests
    const promises = Array(10).fill(null).map(() => 
      service.syncUserData(mockUserData)
    );
    
    const results = await Promise.allSettled(promises);
    expect(results.some(r => r.status === 'rejected')).toBe(true);
  });
});
```

### **2. Mock Data & Test Environment**

```typescript
const MOCK_USER_DATA = {
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  dateOfBirth: new Date('1990-01-01'),
  dietaryRestrictions: ['Vegetarian', 'Gluten-Free'],
  badgeName: 'Test Badge',
  badgeImage: 'https://supabase-storage.example.com/badge-images/test-badge.jpg',
  emergencyContact: 'Jane Doe',
  emergencyPhone: '+1-555-0123',
  socialMediaHandles: [
    { platform: 'twitter', handle: '@testuser' },
    { platform: 'instagram', handle: '@testuser' },
    { platform: 'discord', handle: 'testuser#1234' }
  ],
  eventSlug: 'default' // Used for tagging, not stored as field
};
```

## 📊 **Monitoring & Observability**

### **1. Logging Strategy**

```typescript
class Logger {
  private logLevel: LogLevel;
  
  logSyncAttempt(userData: UserData, syncId: string): void {
    this.info('CRM sync initiated', {
      syncId,
      email: userData.email,
      event: userData.eventSlug,
      timestamp: new Date().toISOString()
    });
  }
  
  logSyncSuccess(syncId: string, contactId: string): void {
    this.info('CRM sync completed successfully', {
      syncId,
      contactId,
      timestamp: new Date().toISOString()
    });
  }
  
  logSyncError(syncId: string, error: Error, context: any): void {
    this.error('CRM sync failed', {
      syncId,
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  }
}
```

### **2. Metrics Collection**

```typescript
interface CRMMetrics {
  // Performance metrics
  syncDuration: Histogram;
  apiResponseTime: Histogram;
  
  // Success/failure metrics
  syncSuccessCount: Counter;
  syncFailureCount: Counter;
  
  // Business metrics
  newContactCount: Counter;
  updatedContactCount: Counter;
  
  // Error metrics
  errorRate: Gauge;
  rateLimitHits: Counter;
}
```

### **3. Health Checks**

```typescript
class HealthChecker {
  async checkCRMHealth(): Promise<HealthStatus> {
    try {
      const startTime = Date.now();
      await this.apiClient.getCustomFields();
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}
```

## 🔧 **Configuration Management**

### **1. Environment Configuration**

```typescript
interface CRMConfig {
  // API Configuration
  apiUrl: string;
  apiKey: string;
  
  // Rate Limiting
  rateLimit: {
    requestsPerMinute: number;
    burstLimit: number;
  };
  
  // Timeouts
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  
  // Feature Flags
  features: {
    enableSync: boolean;
    enableRetry: boolean;
    enableCaching: boolean;
  };
  
  // Logging
  logging: {
    level: LogLevel;
    enableMetrics: boolean;
    enableTracing: boolean;
  };
}
```

### **2. Feature Flags**

```typescript
class FeatureManager {
  private features: Map<string, boolean> = new Map();
  
  isFeatureEnabled(feature: string): boolean {
    return this.features.get(feature) ?? false;
  }
  
  enableFeature(feature: string): void {
    this.features.set(feature, true);
  }
  
  disableFeature(feature: string): void {
    this.features.set(feature, false);
  }
}
```

## 🚀 **Deployment Architecture**

### **1. Environment Strategy**

- **Development**: Production Active Campaign instance (with test data)
- **Staging**: Production Active Campaign instance (with test data)
- **Production**: Production Active Campaign instance (with real data)

**Note**: Active Campaign does not provide separate test environments. Development and testing will use the production instance with carefully managed test data provided through the Badge Maker UI.

### **2. Deployment Pipeline**

```
Code Commit → Tests → Build → Staging Deploy → 
Staging Tests → Production Deploy → Health Checks
```

### **3. Rollback Strategy**

- **Feature Flags**: Enable/disable CRM sync without redeployment
- **Database Rollback**: Revert any data changes if needed
- **Service Rollback**: Rollback to previous service version

---

## 🎯 **Next Steps**

1. **Review Architecture**: Validate technical approach
2. **Environment Setup**: Configure development environments
3. **API Testing**: Validate Active Campaign API connectivity
4. **Development Start**: Begin Phase 1 implementation

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Status**: For Review  
**Next Step**: Architecture Approval
