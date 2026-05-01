import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  console.log('[upload-photo] called')

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const studentId = formData.get('student_id') as string | null

  console.log('[upload-photo] file:', file?.size, 'studentId:', studentId)

  if (!file || !studentId) {
    return NextResponse.json({ error: 'file and student_id required' }, { status: 400 })
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  console.log('[upload-photo] cloudName:', cloudName ? 'set' : 'MISSING', 'apiKey:', apiKey ? 'set' : 'MISSING', 'apiSecret:', apiSecret ? 'set' : 'MISSING')

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const base64 = buffer.toString('base64')
  const dataUri = `data:${file.type};base64,${base64}`

  const timestamp = Math.floor(Date.now() / 1000)
  const folder = 'samurai-crm/students'
  const publicId = `student_${studentId}`

  const crypto = await import('crypto')
  const signStr = `folder=${folder}&overwrite=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`
  const signature = crypto.createHash('sha256').update(signStr).digest('hex')

  const uploadForm = new FormData()
  uploadForm.append('file', dataUri)
  uploadForm.append('api_key', apiKey)
  uploadForm.append('timestamp', String(timestamp))
  uploadForm.append('signature', signature)
  uploadForm.append('folder', folder)
  uploadForm.append('public_id', publicId)
  uploadForm.append('overwrite', 'true')

  console.log('[upload-photo] sending to Cloudinary...')

  let uploadData: Record<string, unknown>
  try {
    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: uploadForm,
    })
    uploadData = await uploadRes.json()
  } catch (err) {
    console.error('[upload-photo] Cloudinary fetch error:', err)
    return NextResponse.json({ error: 'Cloudinary unreachable' }, { status: 500 })
  }

  console.log('[upload-photo] Cloudinary response:', JSON.stringify(uploadData))

  if (!uploadData.secure_url) {
    return NextResponse.json({ error: 'Upload failed', details: uploadData }, { status: 500 })
  }

  await supabase
    .from('students')
    .update({ photo_url: uploadData.secure_url })
    .eq('id', studentId)

  return NextResponse.json({ url: uploadData.secure_url })
}
