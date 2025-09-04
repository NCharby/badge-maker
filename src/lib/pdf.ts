import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
}

export interface PDFGenerationResult {
  success: boolean;
  pdfUrl?: string;
  error?: string;
}

/**
 * Generate a waiver PDF with signature and participant information
 */
export async function generateWaiverPDF(data: WaiverPDFData): Promise<PDFGenerationResult> {
  try {
    // Create HTML template for the PDF
    const htmlContent = createWaiverHTMLTemplate(data);
    
    // Generate PDF using Puppeteer
    const pdfBuffer = await generatePDFFromHTML(htmlContent);
    
    // Upload PDF to Supabase Storage
    const pdfUrl = await uploadPDFToStorage(pdfBuffer, data);
    
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
              <div class="info-value">${data.fullName}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Email Address</div>
              <div class="info-value">${data.email}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Date of Birth</div>
              <div class="info-value">${data.dateOfBirth}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Emergency Contact</div>
              <div class="info-value">${data.emergencyContact}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Emergency Phone</div>
              <div class="info-value">${data.emergencyPhone}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Terms of Service & Event Waiver</h2>
        <div class="terms-content">
          <p>Upon attending any event hosted by Shiny Dog Productions INC, you affirm your understanding of and consent to the subsequent conditions, which encompass grounds for potential removal or prohibition:</p>
          
          <ol>
            <li><strong>Excessive Drunkenness</strong>: Acknowledgment that excessive alcohol consumption leading to disruptive or unsafe behavior jeopardizes the safety and enjoyment of other attendees and staff.</li>
            <li><strong>Unwanted Sexual Advances</strong>: Understanding that engaging in unwelcome sexual advances, comments, or behavior that makes other participants uncomfortable or violated is strictly prohibited.</li>
            <li><strong>Failure to Respect Consent</strong>: Recognition that personal boundaries, consent, and the right to revoke consent at any time must be upheld at all times.</li>
            <li><strong>Destructive Behavior to Venue</strong>: Agreement that actions resulting in damage, defacement, or destruction of the event venue's property are not tolerated.</li>
            <li><strong>Destructive Behavior to Self</strong>: Acknowledgment of the prohibition against actions that pose harm to oneself or others, including behaviors leading to injury or self-endangerment.</li>
            <li><strong>Destructive Behavior to Other Attendees or Their Belongings</strong>: Understanding that causing harm to other participants, their personal property, or belongings is strictly prohibited.</li>
            <li><strong>Excessive Noise</strong>: Acknowledgment of the responsibility to avoid creating excessive noise that disrupts the event environment or neighboring areas.</li>
            <li><strong>Disrespecting Staff</strong>: Understanding that displaying disrespectful behavior or language towards event staff, volunteers, or organizers is not acceptable.</li>
            <li><strong>Not Respecting Play Space Etiquette</strong>: Agreement to adhere to established guidelines and rules for respectful behavior within designated play spaces.</li>
            <li><strong>Illegal Drug Use</strong>: Acknowledgment that possession, use, or distribution of illegal substances during the event is strictly prohibited.</li>
          </ol>

          <h3>MPX/MONKEY POX & COVID RELEASE</h3>
          <p>I release and hold harmless Shiny Dog Productions INC including but not limited to any of their agents, owners and/or employees for any MPX and/or COVID-19/(Novel) Corona Virus claims as they relate to my time on the property.</p>
          <p>Monkeypox and COVID-19 can be a serious disease. By entering the event, you are at your own risk and fully aware of all risks associated with Monkeypox and COVID-19.</p>

          <h3>EQUIPMENT & PLAY AREA USAGE</h3>
          <p>I understand that various pieces of equipment, benches, etc. have been made available for my use during this event. I agree that I will not use any piece of equipment that I am not familiar with unless and until I have sought and obtained proper instruction in its safe use.</p>

          <h3>ASSUMPTION OF RISK</h3>
          <p>I understand and acknowledge that all activities at this event have inherent dangers that no amount of care, caution, preparation, or expertise can eliminate, and I expressly and voluntarily assume all risk of harm of any kind, including but not limited to emotional harm, personal injury, infection, disease, or death sustained as a result of participating in this event, whether or not caused by the negligence of the organizers or host venues.</p>
          <p><strong>I VOLUNTARILY ASSUME ALL RISK, KNOWN AND UNKNOWN, OF INJURIES HOWEVER CAUSED, WHILE ON THE PREMISES, WHETHER USING THE FACILITIES OR NOT, EVEN IF CAUSED IN WHOLE OR IN PART BY THE ACTION, INACTION, OR NEGLIGENCE OF THE ORGANIZERS TO THE FULLEST EXTENT ALLOWED BY LAW.</strong></p>
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
          <p><strong>Signed by:</strong> ${data.fullName}</p>
          <p><strong>Date:</strong> ${data.signedAt}</p>
          <p><strong>IP Address:</strong> ${data.ipAddress || 'Not recorded'}</p>
          <p><strong>Waiver Version:</strong> ${data.waiverVersion}</p>
        </div>
      </div>

      <div class="footer">
        <p>This document was electronically generated and signed on ${data.signedAt}</p>
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
async function generatePDFFromHTML(htmlContent: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Wait for images to load
    await page.waitForFunction(() => {
      const images = document.querySelectorAll('img');
      return Array.from(images).every(img => img.complete);
    }, { timeout: 5000 });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Upload PDF to Supabase Storage
 */
async function uploadPDFToStorage(pdfBuffer: Buffer, data: WaiverPDFData): Promise<string> {
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


  // Try to get a public URL first, then fall back to signed URL
  
  try {
    // Get the public URL (this should work immediately after upload)
    const { data: publicUrlData } = supabase.storage
      .from('waiver-documents')
      .getPublicUrl(uploadData.path);
    
    if (publicUrlData?.publicUrl) {
      return publicUrlData.publicUrl;
    }
  } catch (publicUrlError) {
    console.warn('Public URL generation failed, trying signed URL:', publicUrlError);
  }

  // Fall back to signed URL if public URL fails
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('waiver-documents')
    .createSignedUrl(uploadData.path, 24 * 60 * 60); // 24 hours expiry

  if (signedUrlError) {
    console.error('Signed URL generation error:', signedUrlError);
    throw new Error(`Failed to generate signed URL for PDF: ${signedUrlError.message}`);
  }

  if (!signedUrlData?.signedUrl) {
    console.error('No signed URL data returned:', signedUrlData);
    throw new Error('Failed to generate signed URL for PDF: No data returned');
  }

  return signedUrlData.signedUrl;
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
export async function getPDFSignedUrl(filePath: string, expiryHours: number = 24): Promise<string | null> {
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
