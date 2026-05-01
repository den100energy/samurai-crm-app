import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fal } from '@fal-ai/client'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NEGATIVE = 'helmet, hat, hood, headgear, headwear, cap, mask, cartoon, anime, illustration, painting, drawing, render, 3d, unrealistic, deformed, ugly, blurry, low quality, bad anatomy, disfigured, extra limbs, changed face, different person, mutated'

const STYLES: Record<string, { prompt: string }> = {
  samurai: { prompt: 'hyperrealistic portrait photo of a person wearing traditional Japanese samurai chest armor (do-maru), bare head, red and black lacquered plates, ancient Japanese temple background, dramatic cinematic lighting, 4k DSLR photography, detailed skin texture' },
  ninja:   { prompt: 'hyperrealistic portrait photo of a person wearing black shinobi ninja outfit, bare head, cherry blossom night scene background, moonlight, 4k DSLR photography, detailed skin texture' },
  warrior: { prompt: 'hyperrealistic portrait photo of a person wearing feudal Japanese warrior battle armor, bare head, holding katana, misty mountain landscape background, epic cinematic lighting, 4k DSLR photography, detailed skin texture' },
  ronin:   { prompt: 'hyperrealistic portrait photo of a person wearing worn weathered ronin samurai armor, bare head, misty Japanese forest background, dramatic golden hour side lighting, 4k DSLR photography, detailed skin texture' },
}

export async function POST(req: NextRequest) {
  const { student_id, style } = await req.json()

  if (!student_id || !style || !STYLES[style]) {
    return NextResponse.json({ error: 'student_id and valid style required' }, { status: 400 })
  }

  const falKey = process.env.FAL_KEY
  console.log('[generate-avatar] FAL_KEY:', falKey ? 'set' : 'MISSING')

  if (!falKey) {
    return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
  }

  fal.config({ credentials: falKey })

  const { data: student } = await supabase
    .from('students')
    .select('photo_url')
    .eq('id', student_id)
    .single()

  if (!student?.photo_url) {
    return NextResponse.json({ error: 'no_photo' }, { status: 400 })
  }

  console.log('[generate-avatar] calling fal.ai, photo:', student.photo_url, 'style:', style)

  const prompt = STYLES[style].prompt

  let falResult: { image?: { url: string }; images?: { url: string }[] }
  try {
    const result = await fal.subscribe('fal-ai/pulid', {
      input: {
        face_image_url: student.photo_url,
        prompt,
        negative_prompt: NEGATIVE,
        num_inference_steps: 20,
        guidance_scale: 7.5,
      },
    })
    falResult = result.data as { image?: { url: string }; images?: { url: string }[] }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[generate-avatar] fal.ai error:', msg)
    return NextResponse.json({ error: 'generation_failed', details: msg }, { status: 500 })
  }

  const generatedUrl = falResult?.image?.url ?? falResult?.images?.[0]?.url

  if (!generatedUrl) {
    console.error('[generate-avatar] no url in result:', JSON.stringify(falResult))
    return NextResponse.json({ error: 'no_result_url' }, { status: 500 })
  }

  // Upload to Cloudinary
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
    console.error('[generate-avatar] Cloudinary error:', JSON.stringify(uploadData))
    return NextResponse.json({ error: 'cloudinary_upload_failed', details: uploadData }, { status: 500 })
  }

  await supabase
    .from('students')
    .update({ photo_url: uploadData.secure_url })
    .eq('id', student_id)

  return NextResponse.json({ url: uploadData.secure_url })
}
