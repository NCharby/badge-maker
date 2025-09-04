import { NextRequest, NextResponse } from 'next/server';
import { sendWaiverConfirmationEmail, sendEmail, verifyEmailConfiguration, sendBadgeConfirmationEmailWithTemplate, getBadgeConfirmationData } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    if (type === 'waiver-confirmation') {
      // Send waiver confirmation email
      const { firstName, lastName, email, waiverId, pdfUrl, signedAt } = data;
      
      if (!firstName || !lastName || !email || !waiverId || !pdfUrl || !signedAt) {
        return NextResponse.json(
          { error: 'Missing required fields for waiver confirmation email' },
          { status: 400 }
        );
      }

      const result = await sendWaiverConfirmationEmail({
        fullName: `${firstName} ${lastName}`,
        email,
        waiverId,
        pdfUrl,
        signedAt
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to send waiver confirmation email' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: 'Waiver confirmation email sent successfully'
      });

    } else if (type === 'generic') {
      // Send generic email
      const { to, from, subject, htmlBody, textBody, attachments } = data;
      
      if (!to || !from || !subject || !htmlBody || !textBody) {
        return NextResponse.json(
          { error: 'Missing required fields for generic email' },
          { status: 400 }
        );
      }

      const result = await sendEmail({
        To: to,
        From: from,
        Subject: subject,
        HtmlBody: htmlBody,
        TextBody: textBody,
        Attachments: attachments
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to send email' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: 'Email sent successfully'
      });

    } else if (type === 'badge-confirmation') {
      // Send badge confirmation email
      
      const { badgeId, eventSlug } = data;
      
      if (!badgeId || !eventSlug) {
        console.error('Missing required fields:', { badgeId, eventSlug });
        return NextResponse.json(
          { error: 'Missing required fields: badgeId and eventSlug are required' },
          { status: 400 }
        );
      }

      
      // Get all confirmation data
      const confirmationData = await getBadgeConfirmationData(badgeId, eventSlug);
      
      if (!confirmationData) {
        console.error('Failed to retrieve badge confirmation data');
        return NextResponse.json(
          { error: 'Failed to retrieve badge confirmation data' },
          { status: 404 }
        );
      }


      // Send the confirmation email using Postmark template
      const result = await sendBadgeConfirmationEmailWithTemplate(confirmationData);


      if (!result.success) {
        console.error('Email sending failed:', result.error);
        return NextResponse.json(
          { error: result.error || 'Failed to send badge confirmation email' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: 'Badge confirmation email sent successfully'
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid email type. Supported types: waiver-confirmation, generic, badge-confirmation' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify email configuration
    const isConfigured = await verifyEmailConfiguration();
    
    return NextResponse.json({
      success: true,
      configured: isConfigured,
      message: isConfigured ? 'Email service is properly configured' : 'Email service is not configured'
    });

  } catch (error) {
    console.error('Email configuration check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
