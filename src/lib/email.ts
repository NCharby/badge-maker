import { Resend } from 'resend';

// Initialize Resend client
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export interface EmailData {
  To: string;
  From: string;
  Subject: string;
  HtmlBody: string;
  TextBody: string;
  Attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  Name: string;
  Content: string; // Base64 encoded content
  ContentType: string;
  ContentID: string | null; // unused by Resend; kept for call-site compatibility
}

export interface WaiverEmailData {
  fullName: string;
  email: string;
  waiverId: string;
  pdfUrl: string;
  signedAt: string;
}

export interface BadgeConfirmationEmailData {
  fullName: string;
  email: string;
  badgeName: string;
  socialMediaHandles: Array<{
    platform: string;
    handle: string;
  }>;
  badgeCreatedAt: string;
  waiverId: string;
  waiverSignedAt: string;
  waiverPdfUrl: string;
  telegramInvite?: {
    url: string;
    expiresAt: string;
  };
  telegramPublicChannel?: {
    name: string;
    url: string;
  };
  eventName: string;
  eventSlug: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a waiver confirmation email with PDF attachment
 */
export async function sendWaiverConfirmationEmail(data: WaiverEmailData): Promise<EmailResult> {
  let attachments: EmailAttachment[] = [];

  try {
    let pdfContent: string;

    if (data.pdfUrl.includes('/storage/v1/object/public/')) {
      try {
        pdfContent = await getPDFFromStorage(data.pdfUrl);
      } catch {
        pdfContent = await downloadPDFContent(data.pdfUrl);
      }
    } else {
      pdfContent = await downloadPDFContent(data.pdfUrl);
    }

    attachments = [{ Name: `waiver-${data.waiverId}.pdf`, Content: pdfContent, ContentType: 'application/pdf', ContentID: null }];
  } catch (pdfError) {
    console.warn('PDF attachment failed, sending email without attachment:', pdfError);
  }

  return sendEmail({
    To: data.email,
    From: process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com',
    Subject: 'Your Event Waiver Confirmation',
    HtmlBody: createWaiverEmailHTML(data),
    TextBody: createWaiverEmailText(data),
    Attachments: attachments,
  });
}

/**
 * Get PDF content directly from Supabase storage
 */
async function getPDFFromStorage(pdfUrl: string): Promise<string> {
  try {
    // Extract the file path from the URL
    const urlParts = pdfUrl.split('/storage/v1/object/public/');
    if (urlParts.length !== 2) {
      throw new Error('Invalid Supabase storage URL format');
    }
    
    const pathParts = urlParts[1].split('/');
    const bucket = pathParts[0];
    const filePath = pathParts.slice(1).join('/');
    
    
    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Download the file directly from storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (error) {
      console.error('Supabase storage download error:', error);
      throw new Error(`Failed to download from storage: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from storage');
    }

    // Convert blob to base64
    const arrayBuffer = await data.arrayBuffer();
    const base64Content = Buffer.from(arrayBuffer).toString('base64');
    
    return base64Content;
  } catch (error) {
    console.error('Storage PDF retrieval error:', error);
    throw new Error(`Failed to retrieve PDF from storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download PDF content from URL for email attachment
 */
async function downloadPDFContent(pdfUrl: string): Promise<string> {
  try {
    
    // Add headers to handle potential CORS issues
    const response = await fetch(pdfUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf',
        'User-Agent': 'BadgeMaker-EmailService/1.0'
      }
    });
    
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('PDF download failed:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
        url: pdfUrl
      });
      throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const base64Content = Buffer.from(buffer).toString('base64');
    
    return base64Content;
  } catch (error) {
    console.error('PDF download error:', error);
    throw new Error(`Failed to download PDF for email attachment: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create HTML email template for waiver confirmation
 */
function createWaiverEmailHTML(data: WaiverEmailData): string {
  const formattedDate = new Date(data.signedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Event Waiver Confirmation</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: #2d2d2d;
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 8px 8px;
        }
        .button {
          display: inline-block;
          background: #007bff;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          color: #666;
          font-size: 14px;
        }
        .highlight {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Event Waiver Confirmation</h1>
        <p>Thank you for completing your waiver!</p>
      </div>
      
      <div class="content">
        <h2>Hello ${data.fullName},</h2>
        
        <p>Thank you for completing your event waiver. Your waiver has been successfully processed and is now on file.</p>
        
        <div class="highlight">
          <strong>Waiver Details:</strong><br>
          • <strong>Name:</strong> ${data.fullName}<br>
          • <strong>Email:</strong> ${data.email}<br>
          • <strong>Signed:</strong> ${formattedDate}<br>
          • <strong>Waiver ID:</strong> ${data.waiverId}
        </div>
        
        <h3>What's Next?</h3>
        <p>You can now proceed to create your event badge. Your waiver information will be automatically linked to your badge.</p>
        
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/badge" class="button">
          Create Your Badge
        </a>
        
        <h3>Important Information</h3>
        <ul>
          <li>Your signed waiver is attached to this email as a PDF</li>
          <li>Please keep this email for your records</li>
          <li>The waiver is valid for the duration of the event</li>
          <li>If you have any questions, please contact event organizers</li>
        </ul>
        
        <p><strong>Note:</strong> This waiver is legally binding and confirms your agreement to the event terms and conditions.</p>
      </div>
      
      <div class="footer">
        <p>This email was sent by Shiny Dog Productions INC</p>
        <p>Event Waiver System</p>
        <p>If you have any questions, please contact the event organizers</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Create plain text email template for waiver confirmation
 */
function createWaiverEmailText(data: WaiverEmailData): string {
  const formattedDate = new Date(data.signedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
Event Waiver Confirmation

Hello ${data.fullName},

Thank you for completing your event waiver. Your waiver has been successfully processed and is now on file.

WAIVER DETAILS:
- Name: ${data.fullName}
- Email: ${data.email}
- Signed: ${formattedDate}
- Waiver ID: ${data.waiverId}

WHAT'S NEXT?
You can now proceed to create your event badge. Your waiver information will be automatically linked to your badge.

Create Your Badge: ${process.env.NEXT_PUBLIC_APP_URL}/badge

IMPORTANT INFORMATION:
- Your signed waiver is attached to this email as a PDF
- Please keep this email for your records
- The waiver is valid for the duration of the event
- If you have any questions, please contact event organizers

Note: This waiver is legally binding and confirms your agreement to the event terms and conditions.

---
This email was sent by Shiny Dog Productions INC
Event Waiver System
If you have any questions, please contact the event organizers
  `;
}

/**
 * Send a generic email (for testing or other purposes)
 */
export async function sendEmail(emailData: EmailData): Promise<EmailResult> {
  try {
    if (!resend) {
      return { success: false, error: 'Email service not configured' };
    }

    const { data, error } = await resend.emails.send({
      from: emailData.From,
      to: emailData.To,
      subject: emailData.Subject,
      html: emailData.HtmlBody,
      text: emailData.TextBody,
      attachments: emailData.Attachments?.map(a => ({
        filename: a.Name,
        content: a.Content,
        contentType: a.ContentType,
      })),
    });

    if (error) throw error;

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Email sending error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Verify email sending is configured correctly
 */
export async function verifyEmailConfiguration(): Promise<boolean> {
  if (!resend) return false;
  try {
    const { error } = await resend.domains.list();
    return !error;
  } catch {
    return false;
  }
}

/**
 * Get all data needed for badge confirmation email
 */
export async function getBadgeConfirmationData(
  badgeId: string,
  eventSlug: string
): Promise<BadgeConfirmationEmailData | null> {
  try {
    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get badge data first
    const { data: badgeData, error: badgeError } = await supabase
      .from('badges')
      .select(`
        id,
        badge_name,
        email,
        social_media_handles,
        created_at,
        waiver_id,
        session_id
      `)
      .eq('id', badgeId)
      .single();

    if (badgeError || !badgeData) {
      console.error('Error fetching badge data:', badgeError);
      return null;
    }


    // Get waiver data
    let waiverData = null;
    if (badgeData.waiver_id) {
      const { data: waiver, error: waiverError } = await supabase
        .from('waivers')
        .select(`
          id,
          first_name,
          last_name,
          signed_at,
          pdf_url
        `)
        .eq('id', badgeData.waiver_id)
        .single();

      if (!waiverError && waiver) {
        waiverData = waiver;
      }
    }

    // Get telegram invite data - check per-event invite first, then per-attendee
    let telegramInvite = null;
    
    // First, try to get per-event invite from telegram_config
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('name, slug, telegram_config')
      .eq('slug', eventSlug)
      .single();

    if (!eventError && eventData?.telegram_config?.inviteLink) {
      // Use per-event invite
      telegramInvite = {
        invite_link: eventData.telegram_config.inviteLink,
        expires_at: eventData.telegram_config.inviteExpiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year default
      };
      console.log(`Using per-event telegram invite for ${eventSlug}: ${telegramInvite.invite_link}`);
    } else if (badgeData.session_id) {
      // Fallback to per-attendee invite
      const { data: telegramData, error: telegramError } = await supabase
        .from('telegram_invites')
        .select(`
          invite_link,
          expires_at
        `)
        .eq('session_id', badgeData.session_id)
        .single();

      if (!telegramError && telegramData) {
        telegramInvite = telegramData;
        console.log(`Using per-attendee telegram invite for session ${badgeData.session_id}: ${telegramInvite.invite_link}`);
      }
    }

    // Get event data (reuse the eventData from telegram config query above)
    if (eventError || !eventData) {
      console.error('Error fetching event data:', eventError);
      return null;
    }

    // Format the data for email template
    const fullName = waiverData ? `${waiverData.first_name} ${waiverData.last_name}` : 'Unknown User';
    
    const result = {
      fullName,
      email: badgeData.email,
      badgeName: badgeData.badge_name,
      socialMediaHandles: badgeData.social_media_handles || [],
      badgeCreatedAt: badgeData.created_at,
      waiverId: waiverData?.id || 'N/A',
      waiverSignedAt: waiverData?.signed_at || badgeData.created_at,
      waiverPdfUrl: waiverData?.pdf_url || '',
      telegramInvite: telegramInvite ? {
        url: telegramInvite.invite_link,
        expiresAt: telegramInvite.expires_at
      } : undefined,
      eventName: eventData.name,
      eventSlug: eventData.slug
    };


    return result;
  } catch (error) {
    console.error('Error in getBadgeConfirmationData:', error);
    return null;
  }
}

/**
 * Send badge confirmation email (delegates to sendBadgeConfirmationEmail).
 * Kept for call-site compatibility; Resend has no server-side template system.
 */
export async function sendBadgeConfirmationEmailWithTemplate(
  data: BadgeConfirmationEmailData
): Promise<EmailResult> {
  return sendBadgeConfirmationEmail(data);
}

/**
 * Send badge confirmation email using inline HTML
 */
export async function sendBadgeConfirmationEmail(
  data: BadgeConfirmationEmailData
): Promise<EmailResult> {
  let attachments: EmailAttachment[] = [];

  try {
    let pdfContent: string;

    if (data.waiverPdfUrl.includes('/storage/v1/object/public/')) {
      try {
        pdfContent = await getPDFFromStorage(data.waiverPdfUrl);
      } catch {
        pdfContent = await downloadPDFContent(data.waiverPdfUrl);
      }
    } else {
      pdfContent = await downloadPDFContent(data.waiverPdfUrl);
    }

    attachments = [{ Name: `waiver-${data.waiverId}.pdf`, Content: pdfContent, ContentType: 'application/pdf', ContentID: null }];
  } catch (pdfError) {
    console.warn('PDF attachment failed, sending email without attachment:', pdfError);
  }

  const socialMediaList = data.socialMediaHandles
    .map(handle => `• ${handle.platform}: @${handle.handle}`)
    .join('<br>');

  const opts = {
    badgeCreatedDate: new Date(data.badgeCreatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    waiverSignedDate: new Date(data.waiverSignedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    telegramExpiryDate: data.telegramInvite
      ? new Date(data.telegramInvite.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '',
  };

  return sendEmail({
    To: data.email,
    From: process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com',
    Subject: `Your ${data.eventName} Badge is Ready!`,
    HtmlBody: createBadgeConfirmationEmailHTML(data, { socialMediaList, ...opts }),
    TextBody: createBadgeConfirmationEmailText(data, {
      socialMediaList: data.socialMediaHandles.map(h => `• ${h.platform}: @${h.handle}`).join('\n'),
      ...opts,
    }),
    Attachments: attachments,
  });
}

/**
 * Create HTML email template for badge confirmation
 */
function createBadgeConfirmationEmailHTML(
  data: BadgeConfirmationEmailData,
  formatted: {
    socialMediaList: string;
    badgeCreatedDate: string;
    waiverSignedDate: string;
    telegramExpiryDate: string;
  }
): string {
  return `
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
        }
        .header {
          background: #2d2d2d;
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 8px 8px;
        }
        .section {
          margin: 25px 0;
          padding: 20px;
          background: white;
          border-radius: 5px;
          border-left: 4px solid #007bff;
        }
        .button {
          display: inline-block;
          background: #007bff;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 5px;
          margin: 10px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          color: #666;
          font-size: 14px;
        }
        .highlight {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .telegram-section {
          background: #e3f2fd;
          border-left-color: #2196f3;
        }
        .waiver-section {
          background: #f3e5f5;
          border-left-color: #9c27b0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎉 Your Badge is Ready!</h1>
        <p>Thank you for completing your ${data.eventName} registration</p>
      </div>
      
      <div class="content">
        <h2>Hello ${data.fullName},</h2>
        
        <p>Congratulations! Your event badge has been successfully created and your registration is complete. Here's a summary of everything you've accomplished:</p>
        
        <div class="section">
          <h3>📋 Badge Details</h3>
          <p><strong>Badge Name:</strong> ${data.badgeName}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Created:</strong> ${formatted.badgeCreatedDate}</p>
          ${data.socialMediaHandles.length > 0 ? `
            <p><strong>Social Media Handles:</strong></p>
            <p>${formatted.socialMediaList}</p>
          ` : ''}
        </div>
        
        <div class="section waiver-section">
          <h3>📄 Waiver Confirmation</h3>
          <p>Your waiver has been successfully signed and processed:</p>
          <p><strong>Waiver ID:</strong> ${data.waiverId}</p>
          <p><strong>Signed:</strong> ${formatted.waiverSignedDate}</p>
          <p><strong>PDF Attachment:</strong> Your signed waiver is attached to this email for your records.</p>
        </div>
        
        ${data.telegramInvite ? `
        <div class="section telegram-section">
          <h3>💬 Join the Community</h3>
          <p>Connect with other attendees and stay updated on event information:</p>
          <p><strong>Private Group Invite:</strong> <a href="${data.telegramInvite.url}" class="button">Join Private Group</a></p>
          <p><em>This invite expires on ${formatted.telegramExpiryDate}</em></p>
          ${data.telegramPublicChannel ? `
            <p><strong>Public Channel:</strong> <a href="${data.telegramPublicChannel.url}">${data.telegramPublicChannel.name}</a></p>
          ` : ''}
        </div>
        ` : ''}
        
        <div class="highlight">
          <h3>🎯 What's Next?</h3>
          <p>You're all set for ${data.eventName}! Make sure to:</p>
          <ul>
            <li>Save this email for your records</li>
            <li>Download and print your badge if needed</li>
            <li>Join the Telegram group to connect with other attendees</li>
            <li>Check your email for any additional event updates</li>
          </ul>
        </div>
        
        <p><strong>Need Help?</strong> If you have any questions or need assistance, please contact the event organizers.</p>
      </div>
      
      <div class="footer">
        <p>This email was sent by Shiny Dog Productions INC</p>
        <p>${data.eventName} - Badge Creation System</p>
        <p>If you have any questions, please contact the event organizers</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Create plain text email template for badge confirmation
 */
function createBadgeConfirmationEmailText(
  data: BadgeConfirmationEmailData,
  formatted: {
    socialMediaList: string;
    badgeCreatedDate: string;
    waiverSignedDate: string;
    telegramExpiryDate: string;
  }
): string {
  return `
🎉 Your Badge is Ready!

Hello ${data.fullName},

Congratulations! Your event badge has been successfully created and your registration is complete. Here's a summary of everything you've accomplished:

📋 BADGE DETAILS
- Badge Name: ${data.badgeName}
- Email: ${data.email}
- Created: ${formatted.badgeCreatedDate}
${data.socialMediaHandles.length > 0 ? `
- Social Media Handles:
${formatted.socialMediaList}
` : ''}

📄 WAIVER CONFIRMATION
Your waiver has been successfully signed and processed:
- Waiver ID: ${data.waiverId}
- Signed: ${formatted.waiverSignedDate}
- PDF Attachment: Your signed waiver is attached to this email for your records.

${data.telegramInvite ? `
💬 JOIN THE COMMUNITY
Connect with other attendees and stay updated on event information:
- Private Group Invite: ${data.telegramInvite.url}
- This invite expires on ${formatted.telegramExpiryDate}
${data.telegramPublicChannel ? `
- Public Channel: ${data.telegramPublicChannel.name} - ${data.telegramPublicChannel.url}
` : ''}
` : ''}

🎯 WHAT'S NEXT?
You're all set for ${data.eventName}! Make sure to:
- Save this email for your records
- Download and print your badge if needed
- Join the Telegram group to connect with other attendees
- Check your email for any additional event updates

Need Help? If you have any questions or need assistance, please contact the event organizers.

---
This email was sent by Shiny Dog Productions INC
${data.eventName} - Badge Creation System
If you have any questions, please contact the event organizers
  `;
}
