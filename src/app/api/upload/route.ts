import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
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


    // Generate public URL for immediate access
    const { data: publicUrlData } = supabase.storage
      .from('badge-images')
      .getPublicUrl(filename)

    if (!publicUrlData?.publicUrl) {
      console.error('Failed to generate public URL')
      return NextResponse.json(
        { 
          error: 'Failed to generate access URL',
          details: 'Public URL generation failed'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      filename,
      url: publicUrlData.publicUrl,
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
