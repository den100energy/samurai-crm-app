import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fal } from '@fal-ai/client'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const STYLES: Record<string, string> = {
  samurai: 'wearing traditional Japanese samurai yoroi armor, red-black lacquered plates, ornate kabuto helmet with menpo face mask, ancient Japanese temple background, dramatic cinematic lighting, photorealistic portrait photography, 8k',
  ninja:   'wearing black shinobi ninja outfit with hood, cherry blossom night scene background, moonlight dramatic lighting, photorealistic portrait photography, 8k',
  warrior: 'wearing feudal Japanese warrior battle armor, holding katana, misty mountain landscape background, epic cinematic lighting, photorealistic portrait photography, 8k',
  ronin:   'lone ronin samurai, worn weathered armor with battle scars, misty Japanese forest background, dramatic side lighting golden hour, photorealistic portrait photography, 8k',
}

fal.config({ credentials: process.env.FAL_KEY! })

export async function POST(req: NextRequest) {
  const { student_id, style } = await req.json()

  if (!student_id || !style || !STYLES[style]) {
    return NextResponse.json({ error: 'student_id and valid style required' }, { status: 400 })
  }

  // Fetch student's current photo URL
  const { data: student } = await supabase
    .from('students')
    .select('photo_url')
    .eq('id', student_id)
    .single()

  if (!student?.photo_url) {
    return NextResponse.json({ error: 'no_photo' }, { status: 400 })
  }

  const prompt = `${STYLES[style]}, face preserved exactly, same person`

  // Call fal.ai
  let falResult: { images?: { url: string }[] }
  try {
    const result = await fal.subscribe('fal-ai/ip-adapter-face-id', {
      input: {
        face_image_url: student.photo_url,
        prompt,
        negative_prompt: 'deformed, ugly, blurry, low quality, bad anatomy, disfigured, extra limbs, changed face, different person',
        num_inference_steps: 30,
        guidance_scale: 7.5,
      },
    })
    falResult = result.data as { images?: { url: string }[] }
  } catch (err) {
    console.error('fal.ai error:', err)
    return NextResponse.json({ error: 'generation_failed' }, { status: 500 })
  }

  const generatedUrl = falResult?.images?.[0]?.url
  if (!generatedUrl) {
    return NextResponse.json({ error: 'no_result_url' }, { status: 500 })
  }

  // Upload generated image to Cloudinary
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!
  const apiKey = process.env.CLOUDINARY_API_KEY!
  const apiSecret = process.env.CLOUDINARY_API_SECRET!

  const timestamp = Math.floor(Date.now() / 1000)
  const folder = 'samurai-crm/avatars'
  const publicId = `avatar_${student_id}`

  const crypto = await import('crypto')
  const signStr = `folder=${folder}&overwrite=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`
  const signature = crypto.createHash('sha256').update(signStr).digest('hex')

  const uploadForm = new FormData()
  uploadForm.append('file', generatedUrl)
  uploadForm.append('api_key', apiKey)
  uploadForm.append('timestamp', String(timestamp))
  uploadForm.append('signature', signature)
  uploadForm.append('folder', folder)
  uploadForm.append('public_id', publicId)
  uploadForm.append('overwrite', 'true')

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: uploadForm,
  })
  const uploadData = await uploadRes.json()

  if (!uploadData.secure_url) {
    return NextResponse.json({ error: 'cloudinary_upload_failed', details: uploadData }, { status: 500 })
  }

  // Save to student record
  await supabase
    .from('students')
    .update({ photo_url: uploadData.secure_url })
    .eq('id', student_id)

  return NextResponse.json({ url: uploadData.secure_url })
}
