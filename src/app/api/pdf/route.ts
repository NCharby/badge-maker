import { NextRequest, NextResponse } from 'next/server';
import { generateWaiverPDF, WaiverPDFData } from '@/lib/pdf';
import { sendWaiverConfirmationEmail, EmailResult } from '@/lib/email';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      dateOfBirth,
      emergencyContact,
      emergencyPhone,
      signatureImage,
      sessionId,
      dietaryRestrictions,
      dietaryRestrictionsOther,
      volunteeringInterests,
      additionalNotes
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !dateOfBirth || !emergencyContact || !emergencyPhone || !signatureImage) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get client IP address
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    // Get user agent
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Prepare PDF data
    const pdfData: WaiverPDFData = {
      fullName: `${firstName} ${lastName}`,
      email,
      dateOfBirth,
      emergencyContact,
      emergencyPhone,
      signatureImage,
      waiverVersion: process.env.WAIVER_VERSION || '1.0.0',
      signedAt: new Date().toISOString(),
      ipAddress,
      userAgent
    };

    // Generate PDF
    const result = await generateWaiverPDF(pdfData);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'PDF generation failed' },
        { status: 500 }
      );
    }

    // Store waiver record in database
    const { data: waiverData, error: dbError } = await supabase
      .from('waivers')
      .insert({
        session_id: sessionId,
        event_id: (await supabase.from('events').select('id').eq('slug', 'default').single()).data?.id,
        first_name: firstName,
        last_name: lastName,
        email: email,
        date_of_birth: dateOfBirth,
        emergency_contact: emergencyContact,
        emergency_phone: emergencyPhone,
        dietary_restrictions: dietaryRestrictions || [],
        dietary_restrictions_other: dietaryRestrictionsOther || null,
        volunteering_interests: volunteeringInterests || [],
        additional_notes: additionalNotes || null,
        signature_data: {
          image: signatureImage,
          timestamp: pdfData.signedAt,
          ipAddress,
          userAgent
        },
        signature_image_url: null, // We'll store the signature in the PDF
        waiver_version: pdfData.waiverVersion,
        signed_at: pdfData.signedAt,
        ip_address: ipAddress,
        user_agent: userAgent,
        pdf_url: result.pdfUrl,
        pdf_generated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to store waiver data' },
        { status: 500 }
      );
    }

    // Update session to mark waiver as completed
    if (sessionId) {
      await supabase
        .from('sessions')
        .update({
          waiver_completed: true,
          waiver_id: waiverData.id
        })
        .eq('id', sessionId);
    }

    // Send waiver confirmation email (only if PDF URL exists)
    let emailResult: EmailResult = { success: false, messageId: undefined };
    if (result.pdfUrl) {
      emailResult = await sendWaiverConfirmationEmail({
        fullName: `${firstName} ${lastName}`,
        email,
        waiverId: waiverData.id,
        pdfUrl: result.pdfUrl,
        signedAt: pdfData.signedAt
      });
    }

    return NextResponse.json({
      success: true,
      pdfUrl: result.pdfUrl,
      waiverId: waiverData.id,
      emailSent: emailResult.success,
      emailMessageId: emailResult.messageId,
      message: 'PDF generated and stored successfully' + (emailResult.success ? ', email sent' : ', email failed')
    });

  } catch (error) {
    console.error('PDF generation API error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    });
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const waiverId = searchParams.get('waiverId');

    if (!waiverId) {
      return NextResponse.json(
        { error: 'Waiver ID is required' },
        { status: 400 }
      );
    }

    // Get waiver data from database
    const { data: waiver, error } = await supabase
      .from('waivers')
      .select('*')
      .eq('id', waiverId)
      .single();

    if (error || !waiver) {
      return NextResponse.json(
        { error: 'Waiver not found' },
        { status: 404 }
      );
    }

    // Return waiver data (without sensitive information)
    return NextResponse.json({
      success: true,
      waiver: {
        id: waiver.id,
        firstName: waiver.first_name,
        lastName: waiver.last_name,
        email: waiver.email,
        dateOfBirth: waiver.date_of_birth,
        emergencyContact: waiver.emergency_contact,
        emergencyPhone: waiver.emergency_phone,
        dietaryRestrictions: waiver.dietary_restrictions || [],
        dietaryRestrictionsOther: waiver.dietary_restrictions_other || null,
        volunteeringInterests: waiver.volunteering_interests || [],
        additionalNotes: waiver.additional_notes || null,
        signedAt: waiver.signed_at,
        waiverVersion: waiver.waiver_version,
        pdfUrl: waiver.pdf_url
      }
    });

  } catch (error) {
    console.error('PDF retrieval API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
