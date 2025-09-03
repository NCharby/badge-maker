import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    // Check environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Missing environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Create Supabase client inside the function
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const filename = decodeURIComponent(params.filename)
    
    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      )
    }

    // Generate signed URL for secure access (expires in 1 hour)
    console.log('Attempting to generate signed URL for:', filename)
    console.log('Using bucket: badge-images')
    console.log('Full path being requested:', filename)
    
    // First, let's try to list files to see what's actually there
    const { data: listData, error: listError } = await supabase.storage
      .from('badge-images')
      .list('', { limit: 10 })
    
    if (listError) {
      console.error('List error:', listError)
    } else {
      console.log('Files in bucket:', listData)
    }
    
    const { data: signedUrlData, error } = await supabase.storage
      .from('badge-images')
      .createSignedUrl(filename, 3600) // 1 hour expiry

    if (error) {
      console.error('Signed URL generation error:', error)
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        filename: filename
      })
      return NextResponse.json(
        { error: 'Failed to generate access URL', details: error.message },
        { status: 500 }
      )
    }

    console.log('Signed URL generated successfully for:', filename)

    return NextResponse.json({
      success: true,
      url: signedUrlData.signedUrl,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    })

  } catch (error) {
    console.error('Image access API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
