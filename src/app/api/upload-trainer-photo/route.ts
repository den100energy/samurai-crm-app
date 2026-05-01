import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const trainerId = formData.get('trainer_id') as string | null

  if (!file || !trainerId) {
    return NextResponse.json({ error: 'file and trainer_id required' }, { status: 400 })
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const base64 = buffer.toString('base64')
  const dataUri = `data:${file.type};base64,${base64}`

  const timestamp = Math.floor(Date.now() / 1000)
  const folder = 'samurai-crm/trainers'
  const publicId = `trainer_${trainerId}`

  const crypto = await import('crypto')
  const transformation = 'w_400,h_400,c_fill,g_face,q_auto,f_auto'
  const signStr = `folder=${folder}&overwrite=true&public_id=${publicId}&timestamp=${timestamp}&transformation=${transformation}${apiSecret}`
  const signature = crypto.createHash('sha256').update(signStr).digest('hex')

  const uploadForm = new FormData()
  uploadForm.append('file', dataUri)
  uploadForm.append('api_key', apiKey)
  uploadForm.append('timestamp', String(timestamp))
  uploadForm.append('signature', signature)
  uploadForm.append('folder', folder)
  uploadForm.append('public_id', publicId)
  uploadForm.append('overwrite', 'true')
  uploadForm.append('transformation', transformation)

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: uploadForm,
  })

  const uploadData = await uploadRes.json()

  if (!uploadData.secure_url) {
    return NextResponse.json({ error: 'Upload failed', details: uploadData }, { status: 500 })
  }

  await supabase
    .from('trainers')
    .update({ photo_url: uploadData.secure_url })
    .eq('id', trainerId)

  return NextResponse.json({ url: uploadData.secure_url })
}
