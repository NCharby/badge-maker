# Postmark Email Template: Badge Confirmation Complete

## Template Configuration

**Template Name**: `badge-confirmation-complete`  
**Template Type**: Transactional  
**Subject Line**: `Your {{eventName}} Badge is Ready!`

## Template Variables

The following variables will be passed to the template:

```typescript
{
  // User Information
  fullName: string;
  email: string;
  
  // Badge Information
  badgeName: string;
  socialMediaHandles: Array<{
    platform: string;
    handle: string;
  }>;
  badgeCreatedAt: string;
  
  // Waiver Information
  waiverId: string;
  waiverSignedAt: string;
  waiverPdfUrl: string;
  
  // Telegram Information
  telegramInvite?: {
    url: string;
    expiresAt: string;
  };
  telegramPublicChannel?: {
    name: string;
    url: string;
  };
  
  // Event Information
  eventName: string;
  eventSlug: string;
}
```

## HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Badge Creation Complete</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      background: #2d2d2d;
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
      font-weight: bold;
    }
    .header p {
      margin: 0;
      font-size: 16px;
      opacity: 0.9;
    }
    .content {
      padding: 30px;
    }
    .content h2 {
      color: #2d2d2d;
      margin: 0 0 20px 0;
      font-size: 24px;
    }
    .content p {
      margin: 0 0 15px 0;
      font-size: 16px;
    }
    .section {
      margin: 25px 0;
      padding: 20px;
      background: #f9f9f9;
      border-radius: 5px;
      border-left: 4px solid #007bff;
    }
    .section h3 {
      margin: 0 0 15px 0;
      color: #2d2d2d;
      font-size: 18px;
    }
    .section p {
      margin: 0 0 10px 0;
    }
    .button {
      display: inline-block;
      background: #007bff;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 5px;
      margin: 10px 0;
      font-weight: bold;
    }
    .button:hover {
      background: #0056b3;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 14px;
      background: #f9f9f9;
    }
    .highlight {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      padding: 20px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .highlight h3 {
      margin: 0 0 15px 0;
      color: #856404;
    }
    .highlight ul {
      margin: 0;
      padding-left: 20px;
    }
    .highlight li {
      margin: 5px 0;
    }
    .telegram-section {
      background: #e3f2fd;
      border-left-color: #2196f3;
    }
    .waiver-section {
      background: #f3e5f5;
      border-left-color: #9c27b0;
    }
    .badge-details {
      background: #e8f5e8;
      border-left-color: #4caf50;
    }
    .social-media-list {
      margin: 10px 0;
    }
    .social-media-item {
      margin: 5px 0;
      padding: 5px 0;
    }
    .expiry-notice {
      font-style: italic;
      color: #666;
      font-size: 14px;
    }
    .support-notice {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .support-notice strong {
      color: #495057;
    }
    
    /* Mobile Responsive */
    @media (max-width: 600px) {
      body {
        padding: 10px;
      }
      .header {
        padding: 20px;
      }
      .header h1 {
        font-size: 24px;
      }
      .content {
        padding: 20px;
      }
      .section {
        padding: 15px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>🎉 Your Badge is Ready!</h1>
      <p>Thank you for completing your {{eventName}} registration</p>
    </div>
    
    <div class="content">
      <h2>Hello {{fullName}},</h2>
      
      <p>Congratulations! Your event badge has been successfully created and your registration is complete. Here's a summary of everything you've accomplished:</p>
      
      <div class="section badge-details">
        <h3>📋 Badge Details</h3>
        <p><strong>Badge Name:</strong> {{badgeName}}</p>
        <p><strong>Email:</strong> {{email}}</p>
        <p><strong>Created:</strong> {{badgeCreatedAt}}</p>
        {{#if socialMediaHandles}}
        <p><strong>Social Media Handles:</strong></p>
        <div class="social-media-list">
          {{#each socialMediaHandles}}
          <div class="social-media-item">• {{platform}}: @{{handle}}</div>
          {{/each}}
        </div>
        {{/if}}
      </div>
      
      <div class="section waiver-section">
        <h3>📄 Waiver Confirmation</h3>
        <p>Your waiver has been successfully signed and processed:</p>
        <p><strong>Waiver ID:</strong> {{waiverId}}</p>
        <p><strong>Signed:</strong> {{waiverSignedAt}}</p>
        <p><strong>PDF Attachment:</strong> Your signed waiver is attached to this email for your records.</p>
      </div>
      
      {{#if telegramInvite}}
      <div class="section telegram-section">
        <h3>💬 Join the Community</h3>
        <p>Connect with other attendees and stay updated on event information:</p>
        <p><strong>Private Group Invite:</strong></p>
        <a href="{{telegramInvite.url}}" class="button">Join Private Group</a>
        <p class="expiry-notice">This invite expires on {{telegramInvite.expiresAt}}</p>
        {{#if telegramPublicChannel}}
        <p><strong>Public Channel:</strong> <a href="{{telegramPublicChannel.url}}">{{telegramPublicChannel.name}}</a></p>
        {{/if}}
      </div>
      {{/if}}
      
      <div class="highlight">
        <h3>🎯 What's Next?</h3>
        <p>You're all set for {{eventName}}! Make sure to:</p>
        <ul>
          <li>Save this email for your records</li>
          <li>Download and print your badge if needed</li>
          <li>Join the Telegram group to connect with other attendees</li>
          <li>Check your email for any additional event updates</li>
        </ul>
      </div>
      
      <div class="support-notice">
        <p><strong>Need Help?</strong> If you have any questions or need assistance, please contact the event organizers.</p>
      </div>
    </div>
    
    <div class="footer">
      <p>This email was sent by Shiny Dog Productions INC</p>
      <p>{{eventName}} - Badge Creation System</p>
      <p>If you have any questions, please contact the event organizers</p>
    </div>
  </div>
</body>
</html>
```

## Plain Text Template

```text
🎉 Your Badge is Ready!

Hello {{fullName}},

Congratulations! Your event badge has been successfully created and your registration is complete. Here's a summary of everything you've accomplished:

📋 BADGE DETAILS
- Badge Name: {{badgeName}}
- Email: {{email}}
- Created: {{badgeCreatedAt}}
{{#if socialMediaHandles}}
- Social Media Handles:
{{#each socialMediaHandles}}
  • {{platform}}: @{{handle}}
{{/each}}
{{/if}}

📄 WAIVER CONFIRMATION
Your waiver has been successfully signed and processed:
- Waiver ID: {{waiverId}}
- Signed: {{waiverSignedAt}}
- PDF Attachment: Your signed waiver is attached to this email for your records.

{{#if telegramInvite}}
💬 JOIN THE COMMUNITY
Connect with other attendees and stay updated on event information:
- Private Group Invite: {{telegramInvite.url}}
- This invite expires on {{telegramInvite.expiresAt}}
{{#if telegramPublicChannel}}
- Public Channel: {{telegramPublicChannel.name}} - {{telegramPublicChannel.url}}
{{/if}}
{{/if}}

🎯 WHAT'S NEXT?
You're all set for {{eventName}}! Make sure to:
- Save this email for your records
- Download and print your badge if needed
- Join the Telegram group to connect with other attendees
- Check your email for any additional event updates

Need Help? If you have any questions or need assistance, please contact the event organizers.

---
This email was sent by Shiny Dog Productions INC
{{eventName}} - Badge Creation System
If you have any questions, please contact the event organizers
```

## Template Setup Instructions

### 1. Create Template in Postmark
1. Log into your Postmark account
2. Go to Templates → Create Template
3. Set Template Name: `badge-confirmation-complete`
4. Set Template Type: `Transactional`

### 2. Configure Template
1. **Subject Line**: `Your {{eventName}} Badge is Ready!`
2. **HTML Body**: Copy the HTML template above
3. **Text Body**: Copy the plain text template above
4. **Test Data**: Use the sample data below for testing

### 3. Test Data
```json
{
  "fullName": "John Doe",
  "email": "john.doe@example.com",
  "badgeName": "John Doe",
  "socialMediaHandles": [
    {
      "platform": "twitter",
      "handle": "johndoe"
    },
    {
      "platform": "instagram", 
      "handle": "john_doe"
    }
  ],
  "badgeCreatedAt": "December 15, 2024 at 2:30 PM",
  "waiverId": "WAIVER-12345",
  "waiverSignedAt": "December 15, 2024 at 2:25 PM",
  "waiverPdfUrl": "https://example.com/waiver.pdf",
  "telegramInvite": {
    "url": "https://t.me/+ABC123DEF456",
    "expiresAt": "December 16, 2024 at 2:30 PM"
  },
  "telegramPublicChannel": {
    "name": "Event Updates",
    "url": "https://t.me/eventupdates"
  },
  "eventName": "Tech Conference 2024",
  "eventSlug": "tech-conf-2024"
}
```

### 4. Template Features
- **Responsive Design**: Works on mobile and desktop
- **Professional Styling**: Clean, modern design
- **Conditional Content**: Shows/hides sections based on available data
- **Accessibility**: Proper contrast and readable fonts
- **Brand Consistency**: Matches your existing design system

### 5. Template Variables Mapping
The template uses Handlebars syntax (`{{variable}}`) which Postmark supports. The variables will be automatically populated from the data we send from the application.

### 6. Testing Checklist
- [ ] Template renders correctly in Postmark preview
- [ ] All variables populate correctly
- [ ] Conditional sections show/hide appropriately
- [ ] Mobile responsive design works
- [ ] Links are clickable and functional
- [ ] PDF attachment works
- [ ] Email delivers to test inbox

## Integration Notes

Once you've created this template in Postmark, the application will automatically use it when sending badge confirmation emails. The template ID will be referenced in the email sending code, and all the data will be properly formatted and sent to Postmark for delivery.

The template is designed to be flexible and will gracefully handle cases where some data might be missing (like telegram links) while still providing a complete and professional email experience.
