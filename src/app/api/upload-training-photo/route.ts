import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const groupName = formData.get('group_name') as string | null
  const sessionDate = formData.get('session_date') as string | null
  const trainerName = formData.get('trainer_name') as string | null
  const studentCount = formData.get('student_count') as string | null
  const sortOrder = formData.get('sort_order') as string | null

  if (!file || !groupName || !sessionDate) {
    return NextResponse.json({ error: 'file, group_name and session_date required' }, { status: 400 })
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

  // Папка по месяцу: samurai-crm/training-sessions/2026-05
  const monthFolder = sessionDate.slice(0, 7)
  const folder = `samurai-crm/training-sessions/${monthFolder}`
  const timestamp = Math.floor(Date.now() / 1000)
  const publicId = `training_${groupName.replace(/\s+/g, '_')}_${sessionDate}_${timestamp}`

  const crypto = await import('crypto')
  const signStr = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`
  const signature = crypto.createHash('sha256').update(signStr).digest('hex')

  const uploadForm = new FormData()
  uploadForm.append('file', dataUri)
  uploadForm.append('api_key', apiKey)
  uploadForm.append('timestamp', String(timestamp))
  uploadForm.append('signature', signature)
  uploadForm.append('folder', folder)
  uploadForm.append('public_id', publicId)

  let uploadData: Record<string, unknown>
  try {
    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: uploadForm,
    })
    uploadData = await uploadRes.json()
  } catch (err) {
    console.error('[upload-training-photo] Cloudinary error:', err)
    return NextResponse.json({ error: 'Cloudinary unreachable' }, { status: 500 })
  }

  if (!uploadData.secure_url) {
    console.error('[upload-training-photo] Cloudinary rejected:', JSON.stringify(uploadData))
    return NextResponse.json({ error: 'Upload failed', details: uploadData }, { status: 500 })
  }

  const { data, error } = await supabase.from('training_photos').insert({
    group_name: groupName,
    session_date: sessionDate,
    trainer_name: trainerName || null,
    student_count: studentCount ? parseInt(studentCount) : null,
    photo_url: uploadData.secure_url as string,
    cloudinary_public_id: uploadData.public_id as string,
    sort_order: sortOrder ? parseInt(sortOrder) : 0,
  }).select().single()

  if (error) {
    console.error('[upload-training-photo] DB error:', error)
    return NextResponse.json({ error: 'DB save failed' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, url: data.photo_url })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: photo } = await supabase
    .from('training_photos')
    .select('cloudinary_public_id')
    .eq('id', id)
    .single()

  if (photo?.cloudinary_public_id) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET
    if (cloudName && apiKey && apiSecret) {
      const timestamp = Math.floor(Date.now() / 1000)
      const crypto = await import('crypto')
      const signStr = `public_id=${photo.cloudinary_public_id}&timestamp=${timestamp}${apiSecret}`
      const signature = crypto.createHash('sha256').update(signStr).digest('hex')
      const delForm = new FormData()
      delForm.append('public_id', photo.cloudinary_public_id)
      delForm.append('api_key', apiKey)
      delForm.append('timestamp', String(timestamp))
      delForm.append('signature', signature)
      await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
        method: 'POST', body: delForm,
      }).catch(e => console.error('[upload-training-photo] Cloudinary delete error:', e))
    }
  }

  await supabase.from('training_photos').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
