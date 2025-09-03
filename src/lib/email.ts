import { ServerClient } from 'postmark';

// Initialize Postmark client
const postmarkClient = process.env.POSTMARK_API_KEY 
  ? new ServerClient(process.env.POSTMARK_API_KEY)
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
  ContentID: string | null; // Content ID for attachments (null for regular attachments)
}

export interface WaiverEmailData {
  fullName: string;
  email: string;
  waiverId: string;
  pdfUrl: string;
  signedAt: string;
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
  try {
    // Check if Postmark is configured
    if (!postmarkClient) {
      console.warn('Postmark not configured, skipping email');
      return {
        success: false,
        error: 'Email service not configured'
      };
    }
    let attachments: EmailAttachment[] = [];
    
    // Try to download PDF content for attachment
    try {
      const pdfContent = await downloadPDFContent(data.pdfUrl);
      attachments = [
        {
          Name: `waiver-${data.waiverId}.pdf`,
          Content: pdfContent,
          ContentType: 'application/pdf',
          ContentID: null
        }
      ];
    } catch (pdfError) {
      console.warn('PDF attachment failed, sending email without attachment:', pdfError);
      // Continue without PDF attachment
    }
    
    const emailData: EmailData = {
      To: data.email,
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@yourdomain.com',
      Subject: 'Your Event Waiver Confirmation',
      HtmlBody: createWaiverEmailHTML(data),
      TextBody: createWaiverEmailText(data),
      Attachments: attachments
    };

    const result = await postmarkClient.sendEmail(emailData);
    
    return {
      success: true,
      messageId: result.MessageID
    };
  } catch (error) {
    console.error('Email sending error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Download PDF content from URL for email attachment
 */
async function downloadPDFContent(pdfUrl: string): Promise<string> {
  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  } catch (error) {
    console.error('PDF download error:', error);
    throw new Error('Failed to download PDF for email attachment');
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
    const result = await postmarkClient.sendEmail(emailData);
    
    return {
      success: true,
      messageId: result.MessageID
    };
  } catch (error) {
    console.error('Email sending error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Verify email sending is configured correctly
 */
export async function verifyEmailConfiguration(): Promise<boolean> {
  try {
    // Test the Postmark configuration
    const result = await postmarkClient.getServer();
    return !!result;
  } catch (error) {
    console.error('Email configuration error:', error);
    return false;
  }
}
