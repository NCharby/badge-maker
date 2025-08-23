import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Check environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Create Supabase client inside the function
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'original' or 'cropped'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!type || !['original', 'cropped'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "original" or "cropped"' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      )
    }

    // Generate unique filename with folder structure
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop()
    const filename = `${type}/${timestamp}.${fileExtension}`

    console.log('Attempting to upload:', { filename, type, size: file.size })

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to Supabase Storage using private bucket with folders
    const { data, error } = await supabase.storage
      .from('badge-images')
      .upload(filename, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json(
        { 
          error: 'Failed to upload file',
          details: error.message
        },
        { status: 500 }
      )
    }

    console.log('Upload successful:', data)

    // Generate signed URL for secure access (expires in 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('badge-images')
      .createSignedUrl(filename, 3600) // 1 hour expiry

    if (signedUrlError) {
      console.error('Signed URL generation error:', signedUrlError)
      return NextResponse.json(
        { 
          error: 'Failed to generate access URL',
          details: signedUrlError.message
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      filename,
      url: signedUrlData.signedUrl,
      size: file.size,
      type: file.type
    })

  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
