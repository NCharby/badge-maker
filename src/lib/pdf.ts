// eslint-disable-next-line @typescript-eslint/no-require-imports
const puppeteer = require('puppeteer');
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/** Escape user-supplied text before interpolating into HTML templates. */
function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
  return text.replace(/[&<>"']/g, (c) => map[c])
}

export interface WaiverPDFData {
  // Participant Information
  fullName: string;
  email: string;
  dateOfBirth: string;
  emergencyContact: string;
  emergencyPhone: string;
  
  // Signature data
  signatureImage: string; // Base64 signature image
  
  // Legal data
  waiverVersion: string;
  signedAt: string;
  ipAddress?: string;
  userAgent?: string;

  // EP-configured waiver template text; when provided, replaces the hardcoded terms
  waiverContent?: string;
}

export interface PDFGenerationResult {
  success: boolean;
  pdfUrl?: string;
  error?: string;
}

/**
 * Generate a waiver PDF with signature and participant information
 */
export async function generateWaiverPDF(data: WaiverPDFData, supabase: SupabaseClient): Promise<PDFGenerationResult> {
  try {
    // Create HTML template for the PDF
    const htmlContent = createWaiverHTMLTemplate(data);
    
    // Generate PDF using Puppeteer
    const pdfBuffer = await generatePDFFromHTML(htmlContent);
    
    // Upload PDF to Supabase Storage
    const pdfUrl = await uploadPDFToStorage(pdfBuffer, data, supabase);
    
    return {
      success: true,
      pdfUrl
    };
  } catch (error) {
    console.error('PDF generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Create HTML template for the waiver PDF
 */
function createWaiverHTMLTemplate(data: WaiverPDFData): string {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Process signature image for PDF compatibility
  let signatureSrc = '';
  if (data.signatureImage) {
    if (data.signatureImage.startsWith('data:')) {
      // Already a data URL, use as-is
      signatureSrc = data.signatureImage;
    } else {
      // Assume it's base64, create data URL
      signatureSrc = `data:image/png;base64,${data.signatureImage}`;
    }
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Event Waiver & Terms of Service</title>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          margin: 0 0 10px 0;
          color: #2d2d2d;
          font-size: 24px;
          font-weight: bold;
        }
        .header .date {
          color: #666;
          font-size: 14px;
          margin: 0 0 15px 0;
        }
        .header .company-info {
          margin-bottom: 10px;
        }
        .header .company-name {
          font-size: 16px;
          font-weight: bold;
          color: #2d2d2d;
          margin: 0 0 5px 0;
        }
        .header .company-website {
          font-size: 12px;
          color: #666;
          margin: 0 0 8px 0;
        }
        .header .company-address {
          font-size: 12px;
          color: #666;
          line-height: 1.4;
          margin: 0 0 5px 0;
        }
        .header .company-email {
          font-size: 12px;
          color: #666;
          margin: 0;
        }
        .section {
          margin-bottom: 30px;
        }
        .section h2 {
          color: #2d2d2d;
          border-bottom: 1px solid #ccc;
          padding-bottom: 5px;
          margin-bottom: 15px;
        }
        .participant-info {
          background: #f9f9f9;
          padding: 20px;
          border-radius: 5px;
          margin-bottom: 30px;
        }
        .participant-info h3 {
          margin-top: 0;
          color: #2d2d2d;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        .info-item {
          margin-bottom: 10px;
        }
        .info-label {
          font-weight: bold;
          color: #555;
          font-size: 12px;
          text-transform: uppercase;
        }
        .info-value {
          font-size: 14px;
          margin-top: 2px;
        }
        .terms-content {
          font-size: 12px;
          line-height: 1.5;
        }
        .signature-section {
          margin-top: 40px;
          border-top: 1px solid #ccc;
          padding-top: 20px;
        }
        .signature-image {
          max-width: 300px;
          max-height: 150px;
          border: 1px solid #ccc;
          margin: 10px 0;
          display: block;
          background: white;
        }
        .signature-details {
          font-size: 11px;
          color: #666;
          margin-top: 10px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 10px;
          color: #666;
          border-top: 1px solid #ccc;
          padding-top: 20px;
        }
        .page-break {
          page-break-before: always;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Event Waiver & Terms of Service</h1>
        <div class="date">Generated on ${currentDate}</div>
        <div class="company-info">
          <div class="company-name">Shiny Dog Productions Inc.</div>
          <div class="company-website">shinydogproductions.com</div>
          <div class="company-address">10503 Creek Street SE<br>Unit 2958<br>Yelm, WA 98597</div>
          <div class="company-email">hello@shinydogproductions.com</div>
        </div>
      </div>

      <div class="section">
        <h2>Participant Information</h2>
        <div class="participant-info">
          <h3>Personal Details</h3>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Full Legal Name</div>
              <div class="info-value">${escapeHtml(data.fullName)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Email Address</div>
              <div class="info-value">${escapeHtml(data.email)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Date of Birth</div>
              <div class="info-value">${escapeHtml(data.dateOfBirth)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Emergency Contact</div>
              <div class="info-value">${escapeHtml(data.emergencyContact)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Emergency Phone</div>
              <div class="info-value">${escapeHtml(data.emergencyPhone)}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Event Waiver & Release of Liability</h2>
        <div class="terms-content">
          ${data.waiverContent
            ? `<div style="white-space: pre-wrap;">${escapeHtml(data.waiverContent)}</div>`
            : `<p>I am or will be over 21 years of age as of the first day of the start of the event. A government-issued photo id is required for verification at registration.</p>

          <p><strong>Email hello@shinydogproductions.com for anything</strong><br/>
          All refund requests and absentee notifications must be sent to hello@shinydogproductions.com to be honored. No other forms of communication will be accepted. (i.e. Telegram, Text or Verbal)</p>

          <hr style="border: 1px solid #ccc; margin: 20px 0;"/>

          <p>I am freely and voluntarily choosing to attend and participate in this event and to view and/or participate in activities that I know are adult-oriented and sexually explicit.</p>

          <p>I am aware that such activities involve acts of domination, submission, bondage, discipline, sadism and masochism, and other explicit and extreme sexual fetishes including, but not limited to, spanking, paddling, whipping, suspension, fisting, and other oral and anal penetration.</p>

          <p>I understand that these activities involve certain risks and dangers, including the risk of serious injury or death. I voluntarily accept full responsibility for and agree to assume all risks involved.</p>

          <p>I am aware that the use of the premises, facilities, and equipment at this event may be dangerous and hazardous and I hereby assume all risks of the use of such premises, facilities, and equipment. I agree to personally inspect all the premises, facilities, and equipment and make my own independent judgment as to the use thereof.</p>

          <p>I agree not to rely upon the representations of anyone else in making such judgments. I further agree to treat respectfully and avoid damage to any equipment or facilities provided to me for use. I will clean any equipment or facilities and the surrounding area after the use of any fluids, refuse, or my own private property. I understand that I will be invoiced for any damage or excessive cleaning that I have caused.</p>

          <p>As consideration for my being permitted to participate in and/or attend this event, I agree to release hold harmless and indemnify the event organizers, venue, and other participants from any and all claims, including claims based upon negligence, arising out of my participation, in and/or attendance at this event or any activities associated with this event. This agreement is also binding upon my family members, heirs, and executors.</p>

          <p>In the event of any litigation, dispute, or arbitration arising out of this agreement or my participation in and/or attendance at this event, I agree that the sole venue shall be litigation in King County, Washington. Should any portion of this agreement be invalidated all remaining portions of this agreement shall remain in full force and effect.</p>

          <h3>Code of Conduct</h3>
          <p>Upon attending any event hosted by Shiny Dog Productions INC, you affirm your understanding of and consent to the subsequent conditions, which encompass grounds for potential removal or prohibition:</p>

          <ul>
            <li>Excessive drunkenness or disruptive behaviour</li>
            <li>Unwanted sexual advances</li>
            <li>Failure to respect consent</li>
            <li>Do not interrupt a scene in progress</li>
            <li>Mandatory dress code in private play spaces</li>
            <li>Clean up after your scene</li>
            <li>Photos and videos for personal, non-commercial use only; ask consent first</li>
            <li>Destructive behaviour to venue, self, or other attendees</li>
            <li>Excessive noise</li>
            <li>Disrespecting staff or volunteers</li>
            <li>Not respecting play space etiquette</li>
            <li>Possession, use, or distribution of illegal substances</li>
          </ul>

          <h3>I, the undersigned, have:</h3>
          <ul>
            <li>Carefully read this document, fully understand its content, and agree to be bound by the terms.</li>
            <li>My signature below is my true legal name.</li>
            <li>Understand that upon check-in I must present a government-issued photo ID that matches the waiver and registration information or be denied entrance.</li>
          </ul>

          <p>Questions - hello@shinydogproductions.com</p>`}
        </div>
      </div>

      <div class="signature-section">
        <h2>Digital Signature</h2>
        <p>By signing below, I acknowledge that I have read, understood, and agree to all terms and conditions outlined in this waiver.</p>
        
        <div>
          <strong>Signature:</strong><br>
          ${signatureSrc ? `<img src="${signatureSrc}" alt="Digital Signature" class="signature-image">` : '<p style="color: red; font-style: italic;">No signature provided</p>'}
        </div>
        
        <div class="signature-details">
          <p><strong>Signed by:</strong> ${escapeHtml(data.fullName)}</p>
          <p><strong>Date:</strong> ${escapeHtml(data.signedAt)}</p>
          <p><strong>IP Address:</strong> ${escapeHtml(data.ipAddress || 'Not recorded')}</p>
          <p><strong>Waiver Version:</strong> ${escapeHtml(data.waiverVersion)}</p>
        </div>
      </div>

      <div class="footer">
        <p>This document was electronically generated and signed on ${escapeHtml(data.signedAt)}</p>
        <p>Shiny Dog Productions INC - Event Waiver System</p>
        <p>Document ID: ${generateDocumentId()}</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate PDF from HTML using Puppeteer
 */
export async function generatePDFFromHTML(htmlContent: string): Promise<Buffer> {
  // Detect if we're in a Docker environment
  const isDocker = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.NODE_ENV === 'production'
  
  const launchOptions: any = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ],
    protocolTimeout: 60000, // 60 second timeout
  }
  
  // Only set executablePath in Docker/production environments
  if (isDocker) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser'
  }
  
  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    
    // Set page timeout
    page.setDefaultTimeout(30000); // 30 second timeout
    page.setDefaultNavigationTimeout(30000);
    
    // Set content with longer timeout
    await page.setContent(htmlContent, { 
      waitUntil: 'domcontentloaded', // Use faster loading condition
      timeout: 30000 
    });
    
    // Wait for images to load with increased timeout
    try {
      await page.waitForFunction(() => {
        const images = document.querySelectorAll('img');
        return Array.from(images).every(img => img.complete);
      }, { timeout: 10000 });
    } catch (imageTimeout) {
      console.warn('Image loading timeout, proceeding with PDF generation:', imageTimeout);
      // Continue with PDF generation even if images don't load
    }
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      },
      timeout: 30000 // Add PDF generation timeout
    });

    return Buffer.from(pdfBuffer);
  } finally {
    try {
      await browser.close();
    } catch (closeError) {
      console.warn('Browser close error (non-critical):', closeError);
    }
  }
}

/**
 * Upload PDF to Supabase Storage
 */
async function uploadPDFToStorage(pdfBuffer: Buffer, data: WaiverPDFData, supabase: SupabaseClient): Promise<string> {
  const fileName = `waiver-${Date.now()}-${data.fullName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
  const filePath = `pdfs/${fileName}`;

  const { data: uploadData, error } = await supabase.storage
    .from('waiver-documents')
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      cacheControl: '3600'
    });

  if (error) {
    console.error('PDF upload error:', error);
    throw new Error(`Failed to upload PDF: ${error.message}`);
  }


  // Store the storage path — signed URLs are generated at display time
  return uploadData.path;
}

/**
 * Generate a unique document ID
 */
function generateDocumentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `WAIVER-${timestamp}-${random}`.toUpperCase();
}

/**
 * Get signed URL for a PDF (for accessing existing PDFs)
 */
export async function getPDFSignedUrl(filePath: string, supabase: SupabaseClient, expiryHours: number = 24): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('waiver-documents')
      .createSignedUrl(filePath, expiryHours * 60 * 60);

    if (error) {
      console.error('Error generating signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    return null;
  }
}
