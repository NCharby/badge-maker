import puppeteer from 'puppeteer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
        <h2>Shiny Dog Productions Release of Liability</h2>
        <div class="terms-content">
          <p>I am or will be over 21 years of age as of the first day of the start of the event. A government-issued photo id is required for verification at registration.</p>

          <p><strong>Email hello@shinydogproductions.com for anything</strong><br/>
          All refund requests and absentee notifications must be sent to hello@shinydogproductions.com to be honored. No other forms of communication will be accepted. (i.e. Telegram, Text or Verbal)</p>

          <hr style="border: 1px solid #ccc; margin: 20px 0;"/>

          <p>I am freely and voluntarily choosing to attend and participate in this event and to view and/or participate in activities that I know are adult-oriented and sexually explicit.</p>

          <p>I am aware that such activities involve acts of domination, submission, bondage, discipline, sadism and masochism, and other explicit and extreme sexual fetishes including, but not limited to, spanking, paddling, whipping, suspension, fisting, and other oral and anal penetration.</p>

          <p>I understand that these activities involve certain risks and dangers, including the risk of serious injury or death. I voluntarily accept full responsibility for and agree to assume all risks involved.</p>

          <p>I am aware that the use of the premises, facilities, and equipment at this event may be dangerous and hazardous and I hereby assume all risks of the use of such premises, facilities, and equipment. I agree to personally inspect all the premises, facilities, and equipment and make my own independent judgment as to the use thereof.</p>

          <p>I agree not to rely upon the representations of anyone else in making such judgments. I further agree to treat respectfully and avoid damage to any equipment or facilities provided to me for use. I will clean any equipment or facilities and the surrounding area after the use of any fluids, refuse, or my own private property. I understand that I will be invoiced for any damage or excessive cleaning that I have caused.</p>

          <p>I understand that COG Weekend is a private event open only to those who have been approved by Shiny Dog Productions. I understand only COG Weekend attendees and staff, CCBC staff, and contracted security may enter the area from the gate at 14 to the north exit of the Nature Walk. I agree to abide by and follow all the posted safety and use instructions. I further understand that Shiny Dog Productions and the premises owner are not responsible for any lost, damaged or stolen personal property.</p>

          <p>As consideration for my being permitted to participate in and/or attend this event, I agree to release hold harmless and indemnify Shiny Dog Productions, CCBC, and other participants from any and all claims, including claims based upon negligence, arising out of my participation, in and/or attendance at this event or any activities associated with this event. This agreement is also binding upon my family members, heirs, and executors.</p>

          <p>In the event of any litigation, dispute, or arbitration arising out of this agreement or my participation in and/or attendance at this event, I agree that the sole venue shall be litigation in King County, Washington. Should any portion of this agreement be invalidated all remaining portions of this agreement shall remain in full force and effect.</p>

          <h3>Code of Conduct</h3>
          <p>Upon attending any event hosted by Shiny Dog Productions INC, you affirm your understanding of and consent to the subsequent conditions, which encompass grounds for potential removal or prohibition:</p>

          <ol>
            <li><strong>Excessive Drunkenness</strong>: Acknowledgment that excessive alcohol consumption leading to disruptive or unsafe behavior jeopardizes the safety and enjoyment of other attendees and staff.</li>
            <li><strong>Unwanted Sexual Advances</strong>: Understanding that engaging in unwelcome sexual advances, comments, or behavior that makes other participants uncomfortable or violated is strictly prohibited.</li>
            <li><strong>Failure to Respect Consent</strong>: Recognition that personal boundaries, consent, and the right to revoke consent at any time must be upheld at all times.</li>
            <li><strong>Do not interrupt a scene in progress</strong> - do not engage the players in the scene, physically or verbally intrude, or watch from within 3 feet of the act. If a scene concerns you, SAY SOMETHING TO STAFF, do not intervene personally</li>
            <li><strong>COG Weekend Private Play Spaces have a mandatory Dress Code</strong>. You will be asked to leave and return in more complete gear if arriving with too much skin showing or a lack of scene appropriate attire. Street clothes will not be admitted</li>
            <li><strong>You are expected to clean up after your scene</strong>. You must sanitize any equipment you use. Any fluids (biological or otherwise) cleaned. Your gear and toys returned to your room</li>
            <li><strong>All photos or videos you will take will be for non-commercial personal use</strong>. I will ask prior to taking photos or videos of others. Those with a Blue Wristband do not wish to have photos taken of themselves.</li>
            <li><strong>Destructive Behavior to Venue</strong>: Agreement that actions resulting in damage, defacement, or destruction of the event venue's property are not tolerated.</li>
            <li><strong>Destructive Behavior to Self</strong>: Acknowledgment of the prohibition against actions that pose harm to oneself or others, including behaviors leading to injury or self-endangerment.</li>
            <li><strong>Destructive Behavior to Other Attendees or Their Belongings</strong>: Understanding that causing harm to other participants, their personal property, or belongings is strictly prohibited.</li>
            <li><strong>Excessive Noise</strong>: Acknowledgment of the responsibility to avoid creating excessive noise that disrupts the event environment or neighboring areas.</li>
            <li><strong>Disrespecting Staff</strong>: Understanding that displaying disrespectful behavior or language towards event staff, volunteers, or organizers is not acceptable.</li>
            <li><strong>Not Respecting Play Space Etiquette</strong>: Agreement to adhere to established guidelines and rules for respectful behavior within designated play spaces.</li>
            <li><strong>Substances</strong>: Acknowledgment that possession, use, or distribution of illegal substances during the event is strictly prohibited.</li>
          </ol>

          <h3>Cancellation & Refund Policy</h3>
          <ul>
            <li><strong>Refund Deadlines</strong>
              <ul>
                <li>Refund requests after purchase will be honored at 75% & less processing fees.</li>
                <li>Refunds after October 31st, 2025 (Midnight PST) will not be available.</li>
                <li>Any refunds will be less processing fees.</li>
                <li>Merchandise sales are final.</li>
              </ul>
            </li>
            <li><strong>Event Cancellation/Rescheduling</strong>: Shiny Dog Productions INC. hereon "COG Weekend" reserves the right to cancel or reschedule an event due to Act of God, domestic or international security concern, epidemic or pandemic (Defined by local government, CDC and/or WHO), venue and/or sub-supplier Force Majeure, low attendance and/or other circumstances which would make the event non-viable defined by COG Weekend.</li>
            <li><strong>If we have to move COG, we'll try to move your room too</strong>: COG Weekend reserves the right to reschedule an event to any later date deemed viable and safe. In the event of a rescheduling, COG Weekend will act in good faith to schedule new dates with our venue that meets the needs of both COG Weekend and all ticket holders; hereon "You". COG Weekend will not attempt to collect any additional charges from You for admission. COG Weekend will attempt to work with our venue to move existing room reservations to the new date. No guarantee is given that a room reservation rescheduling will incur no additional cost to You nor that the same room will be assigned to You.</li>
            <li><strong>Please don't ghost us</strong>: Should You decide not to attend COG Weekend for any reason after January 2nd (pending a rescheduling or cancellation), you will not be considered for attendance the following iteration of the event. If You notify COG Weekend between September 2nd and 10 days of the event of your absence, we will wave this clause.</li>
            <li><strong>Refunds will be performed via our payment processor</strong></li>
            <li><strong>We'll refund as much as possible if we cancel</strong>: In the event that COG Weekend is canceled, COG Weekend will offer You a refund of the purchased ticket price less processing fees. COG Weekend will attempt to negotiate with our venue to avoid cancellation fees for You, but no guarantee is ensured.</li>
            <li><strong>Travel is on you</strong>: COG Weekend is not responsible for any travel-related charges you may incur. This includes circumstances where rescheduling or cancellation has occurred. COG Weekend reserves the right to change its Cancellation Policy at any time without notice. COG Weekend also reserves the right to supersede its Cancellation Policy in response to unseen circumstances in a good faith effort to protect both the ticket holders and the continued existence of COG Weekend.</li>
          </ul>

          <h3>Rooms</h3>
          <ul>
            <li>If you selected a room the hotel will reach out after registration is complete.</li>
            <li>Please DO NOT call the resort. They will call you. Please sit tight.</li>
            <li>If you have a ticket for a room, it is blocked for you.</li>
            <li>If the resort has not called you after two weeks of ticket booking, please email hello@shinydogproductions.com</li>
          </ul>

          <p><strong>Minimum Level Hotel Per Room for Weekend Period (Th-Sat Nights)</strong></p>
          <ul>
            <li>King Rooms - Minimum Two (2) Attendees / Maximum Three (3) Attendees</li>
            <li>2x Queen Rooms - Minimum Four (4) Attendees / Maximum Four (4) Attendees</li>
            <li>RV+ - Minimum One (1) Attendees / Maximum Two (2) Attendees</li>
          </ul>

          <p>If I'm a room lead/holder, I understand that will do my best to fill the room to the minimum level on the weekends. This does not apply Monday-Wens.</p>

          <h3>Communication</h3>
          <p>Our primary form of communication is email (formally) & our Telegram group (informally).</p>
          <p>All attendees must join the 2025 Telegram group via the link in the Waiver approval email.</p>

          <h3>I, the undersigned, have;</h3>
          <ul>
            <li>Carefully read this document, fully understand its content, and agree to be bound by the terms.</li>
            <li>My signature below is my true legal name.</li>
            <li>Understand that upon check-in I must present a government-issued photo ID that matches the waiver and registration information or be denied entrance.</li>
            <li>Understand that COG is an event for men in gear and will be expected to participate in wearing gear during the event weekend.</li>
            <li>The COG playspace and scheduled events require a majority coverage of fetish gear and admittance to events and playspace will be denied if I am not in gear. (no only jockstraps, etc.) Basically, if you plan to wear just a jock and harness, COG Weekend is not for you.</li>
          </ul>

          <p>Questions - hello@shinydogproductions.com</p>
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
