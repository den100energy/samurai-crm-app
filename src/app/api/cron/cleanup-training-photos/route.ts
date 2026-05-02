import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  // Фото старше 180 дней
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 180)
  const cutoffStr = cutoff.toISOString()

  const { data: oldPhotos, error } = await supabase
    .from('training_photos')
    .select('id, cloudinary_public_id')
    .lt('created_at', cutoffStr)

  if (error) {
    console.error('[cleanup-training-photos] DB error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!oldPhotos || oldPhotos.length === 0) {
    return NextResponse.json({ deleted: 0 })
  }

  let deleted = 0
  const crypto = await import('crypto')

  for (const photo of oldPhotos) {
    // Удаляем из Cloudinary
    if (photo.cloudinary_public_id && cloudName && apiKey && apiSecret) {
      const timestamp = Math.floor(Date.now() / 1000)
      const signStr = `public_id=${photo.cloudinary_public_id}&timestamp=${timestamp}${apiSecret}`
      const signature = crypto.createHash('sha256').update(signStr).digest('hex')
      const delForm = new FormData()
      delForm.append('public_id', photo.cloudinary_public_id)
      delForm.append('api_key', apiKey)
      delForm.append('timestamp', String(timestamp))
      delForm.append('signature', signature)
      await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
        method: 'POST', body: delForm,
      }).catch(e => console.error('[cleanup-training-photos] Cloudinary error:', e))
    }

    // Удаляем из БД
    await supabase.from('training_photos').delete().eq('id', photo.id)
    deleted++
  }

  console.log(`[cleanup-training-photos] Deleted ${deleted} old training photos`)
  return NextResponse.json({ deleted })
}
