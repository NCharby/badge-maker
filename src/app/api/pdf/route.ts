import { NextRequest, NextResponse } from 'next/server';
import { generateWaiverPDF, WaiverPDFData } from '@/lib/pdf';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fullName,
      email,
      dateOfBirth,
      emergencyContact,
      emergencyPhone,
      signatureImage,
      sessionId
    } = body;

    // Validate required fields
    if (!fullName || !email || !dateOfBirth || !emergencyContact || !emergencyPhone || !signatureImage) {
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
      fullName,
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
        full_name: fullName,
        email: email,
        date_of_birth: dateOfBirth,
        emergency_contact: emergencyContact,
        emergency_phone: emergencyPhone,
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

    return NextResponse.json({
      success: true,
      pdfUrl: result.pdfUrl,
      waiverId: waiverData.id,
      message: 'PDF generated and stored successfully'
    });

  } catch (error) {
    console.error('PDF generation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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
        fullName: waiver.full_name,
        email: waiver.email,
        dateOfBirth: waiver.date_of_birth,
        emergencyContact: waiver.emergency_contact,
        emergencyPhone: waiver.emergency_phone,
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
