'use client'

/**
 * FujiScene — японская пейзажная сцена с горой Фудзи и сакурой.
 * Используется как hero-заголовок в кабинетах (дашборд, тренер, ученик, родитель).
 *
 * Тёмная тема: ночь / сумерки, звёзды, луна.
 * Светлая тема: рассвет, розовое небо, тёплое солнце.
 */
export function FujiScene({ dark = true, bgColor }: { dark?: boolean; bgColor?: string }) {
  const fadeColor = bgColor ?? (dark ? '#1C1C1E' : '#F5F4F0')

  return (
    <svg
      viewBox="0 0 400 180"
      className="w-full block"
      style={{ display: 'block' }}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
    >
      <defs>
        {/* ——— Sky ——— */}
        <linearGradient id="fj-sky" x1="0" y1="0" x2="0" y2="1">
          {dark ? (
            <>
              <stop offset="0%"   stopColor="#04040F" />
              <stop offset="35%"  stopColor="#0E0830" />
              <stop offset="65%"  stopColor="#2A1048" />
              <stop offset="100%" stopColor="#4A1C3A" />
            </>
          ) : (
            <>
              <stop offset="0%"   stopColor="#1A0530" />
              <stop offset="30%"  stopColor="#7B2560" />
              <stop offset="65%"  stopColor="#D4506A" />
              <stop offset="100%" stopColor="#F0905A" />
            </>
          )}
        </linearGradient>

        {/* ——— Horizon glow ——— */}
        <radialGradient id="fj-hglow" cx="50%" cy="90%" r="60%">
          <stop offset="0%"   stopColor={dark ? '#3A1060' : '#FFB060'} stopOpacity="0.6" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>

        {/* ——— Moon / Sun ——— */}
        <radialGradient id="fj-moon" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={dark ? '#FFF8E0' : '#FFEE80'} />
          <stop offset="70%"  stopColor={dark ? '#FFE8A0' : '#FFD840'} />
          <stop offset="100%" stopColor={dark ? '#DDB840' : '#FFB800'} stopOpacity="0.5" />
        </radialGradient>
        <filter id="fj-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* ——— Far mountains ——— */}
        <linearGradient id="fj-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={dark ? '#6A4898' : '#9060B0'} stopOpacity={dark ? "0.55" : "0.3"} />
          <stop offset="100%" stopColor={dark ? '#3A2860' : '#604880'} stopOpacity="0.05" />
        </linearGradient>

        {/* ——— Fuji body ——— */}
        <linearGradient id="fj-body" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%"   stopColor="#7A90A8" />
          <stop offset="50%"  stopColor="#587090" />
          <stop offset="100%" stopColor="#3A5068" />
        </linearGradient>
        <linearGradient id="fj-shadow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#2A3A50" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#1A2A3A" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="fj-light" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#A8C0D8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#D8EAF8" stopOpacity="0.1" />
        </linearGradient>

        {/* ——— Snow cap ——— */}
        <linearGradient id="fj-snow" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%"   stopColor="#FFFFFF" />
          <stop offset="50%"  stopColor="#EEF4FF" />
          <stop offset="100%" stopColor="#B8CCE8" />
        </linearGradient>

        {/* ——— Hills ——— */}
        <linearGradient id="fj-hills" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={dark ? '#1A3A20' : '#224A28'} />
          <stop offset="100%" stopColor={dark ? '#0A1A0C' : '#122018'} />
        </linearGradient>
        <linearGradient id="fj-fg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={dark ? '#102010' : '#182818'} />
          <stop offset="100%" stopColor={dark ? '#050D05' : '#0C1A0C'} />
        </linearGradient>

        {/* ——— Mist ——— */}
        <linearGradient id="fj-mist" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="white" stopOpacity="0" />
          <stop offset="20%"  stopColor="white" stopOpacity="0.28" />
          <stop offset="50%"  stopColor="white" stopOpacity="0.12" />
          <stop offset="80%"  stopColor="white" stopOpacity="0.22" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>

        {/* ——— Bottom page fade ——— */}
        <linearGradient id="fj-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="transparent" />
          <stop offset="100%" stopColor={fadeColor} />
        </linearGradient>

        {/* ——— Soft atmospheric blur ——— */}
        <filter id="fj-soft" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="0.7" />
        </filter>

        {/* ——— Tree shadow (subtle 3D depth) ——— */}
        <filter id="fj-treeshadow" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="2" dy="3" stdDeviation="2" floodColor="#000" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* ═══ SKY ═══ */}
      <rect width="400" height="180" fill="url(#fj-sky)" />

      {/* Horizon glow */}
      <rect width="400" height="180" fill="url(#fj-hglow)" />

      {/* ═══ MOON / SUN ═══ */}
      {dark ? (
        /* Moon with halo */
        <>
          <circle cx="310" cy="32" r="22" fill="#FFF0A0" opacity="0.12" />
          <circle cx="310" cy="32" r="16" fill="url(#fj-moon)" filter="url(#fj-glow)" />
          {/* Crescent shadow */}
          <circle cx="316" cy="30" r="13" fill="#0E0830" opacity="0.55" />
        </>
      ) : (
        /* Sun */
        <>
          <circle cx="310" cy="40" r="30" fill="#FFE080" opacity="0.18" />
          <circle cx="310" cy="40" r="20" fill="url(#fj-moon)" filter="url(#fj-glow)" />
        </>
      )}

      {/* ═══ STARS (dark only) ═══ */}
      {dark && (
        <>
          {[
            [22,16,0.8],[48,10,0.7],[82,20,0.9],[118,8,0.65],[155,18,0.75],
            [190,6,0.8],[232,14,0.7],[268,22,0.85],[345,18,0.75],[372,9,0.7],
            [35,32,0.5],[106,28,0.6],[270,8,0.8],[142,30,0.55],[200,26,0.6]
          ].map(([x,y,o],i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.1 : 0.7}
              fill="white" opacity={o} />
          ))}
          {/* A couple slightly bigger twinkling stars */}
          <circle cx="72" cy="14" r="1.4" fill="#E0E8FF" opacity="0.9" />
          <circle cx="352" cy="26" r="1.3" fill="#FFE8E0" opacity="0.85" />
        </>
      )}

      {/* ═══ FAR DISTANT MOUNTAINS ═══ */}
      <path
        d="M0 98 L28 74 L55 88 L88 62 L118 80 L152 56 L182 74 L212 60 L245 76 L275 62 L308 78 L338 64 L368 78 L400 68 L400 108 L0 108 Z"
        fill="url(#fj-far)"
        filter="url(#fj-soft)"
      />

      {/* ═══ FUJI — main shape ═══ */}
      {/* Base body */}
      <path d="M200 22 L125 115 L275 115 Z" fill="url(#fj-body)" />

      {/* Left face — shadow side */}
      <path d="M200 22 L158 82 L125 115 Z" fill="url(#fj-shadow)" />

      {/* Right face — lit side */}
      <path d="M200 22 L242 80 L275 115 Z" fill="url(#fj-light)" />

      {/* ═══ SNOW CAP ═══ */}
      {/* Main snow */}
      <path
        d="M200 22
           L178 58
           Q181 53 185 59
           Q188 52 192 59
           Q195 51 198 57
           Q200 50 202 57
           Q205 51 208 59
           Q212 52 215 59
           Q219 53 222 58
           L200 22 Z"
        fill="url(#fj-snow)"
      />

      {/* Snow ridges — 3D texture */}
      <path d="M192 59 Q195 50 198 57" stroke="#C8DCFF" strokeWidth="0.7" fill="none" opacity="0.9" />
      <path d="M208 59 Q205 50 202 57" stroke="#C8DCFF" strokeWidth="0.7" fill="none" opacity="0.9" />
      <path d="M185 59 Q188 51 192 59" stroke="#B0CCEE" strokeWidth="0.55" fill="none" opacity="0.7" />
      <path d="M215 59 Q212 51 208 59" stroke="#B0CCEE" strokeWidth="0.55" fill="none" opacity="0.7" />
      <path d="M178 58 L174 64 L179 68" stroke="white" strokeWidth="0.7" fill="none" opacity="0.45" />
      <path d="M222 58 L226 64 L221 68" stroke="white" strokeWidth="0.7" fill="none" opacity="0.45" />

      {/* Crater suggestion */}
      <ellipse cx="200" cy="23" rx="5" ry="2" fill="#3A5068" opacity="0.5" />
      <ellipse cx="200" cy="23" rx="3" ry="1.2" fill="#28384A" opacity="0.6" />

      {/* ═══ MID HILLS ═══ */}
      <path
        d="M0 114 Q25 100 62 112 Q100 96 138 110 Q162 102 200 114 Q238 104 272 110 Q308 96 348 112 Q372 102 400 114 L400 132 L0 132 Z"
        fill="url(#fj-hills)"
      />

      {/* ═══ MIST BAND ═══ */}
      <ellipse cx="200" cy="114" rx="200" ry="10" fill="url(#fj-mist)" opacity="0.9" />
      {/* Second thinner mist band for depth */}
      <ellipse cx="200" cy="122" rx="200" ry="6" fill="url(#fj-mist)" opacity="0.4" />

      {/* ═══ FOREGROUND GROUND ═══ */}
      <path
        d="M0 130 Q80 124 160 130 Q240 124 320 128 Q365 124 400 130 L400 180 L0 180 Z"
        fill="url(#fj-fg)"
      />

      {/* ═══ CHERRY BLOSSOM TREES ═══ */}

      {/* — Tree FAR LEFT (tall) — */}
      <g filter="url(#fj-treeshadow)">
        {/* Trunk */}
        <path d="M58 180 Q56 162 54 148 Q52 134 56 124" stroke="#1E0E04" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        {/* Branches */}
        <path d="M56 124 Q48 112 38 106"    stroke="#1E0E04" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M56 124 Q62 112 72 108"    stroke="#1E0E04" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M56 132 Q46 124 37 126"    stroke="#1E0E04" strokeWidth="2"   fill="none" strokeLinecap="round" />
        <path d="M56 132 Q66 124 76 128"    stroke="#1E0E04" strokeWidth="2"   fill="none" strokeLinecap="round" />
        <path d="M56 140 Q48 134 42 136"    stroke="#1E0E04" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M38 106 Q32 100 26 103"    stroke="#1E0E04" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Blossom clouds — layered circles for volume */}
        <circle cx="37"  cy="101" r="14" fill="#FF8FAD" opacity="0.8" />
        <circle cx="52"  cy="95"  r="13" fill="#FFAAC0" opacity="0.85" />
        <circle cx="68"  cy="103" r="13" fill="#FF8FAD" opacity="0.8" />
        <circle cx="30"  cy="114" r="10" fill="#FFB8CC" opacity="0.7" />
        <circle cx="51"  cy="90"  r="10" fill="#FFCCD8" opacity="0.8" />
        <circle cx="75"  cy="116" r="10" fill="#FF90B0" opacity="0.7" />
        <circle cx="44"  cy="114" r="9"  fill="#FF9AB8" opacity="0.75" />
        <circle cx="64"  cy="113" r="9"  fill="#FFAAC0" opacity="0.75" />
        <circle cx="25"  cy="103" r="8"  fill="#FFB0C5" opacity="0.65" />
        {/* Highlight dots */}
        <circle cx="48"  cy="92"  r="4"  fill="#FFECF2" opacity="0.6" />
        <circle cx="65"  cy="100" r="3"  fill="#FFECF2" opacity="0.5" />
      </g>

      {/* — Tree FAR RIGHT (tall) — */}
      <g filter="url(#fj-treeshadow)">
        <path d="M342 180 Q344 162 346 148 Q348 134 344 124" stroke="#1E0E04" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M344 124 Q352 112 362 106"  stroke="#1E0E04" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M344 124 Q338 112 328 108"  stroke="#1E0E04" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M344 132 Q354 124 363 126"  stroke="#1E0E04" strokeWidth="2"   fill="none" strokeLinecap="round" />
        <path d="M344 132 Q334 124 324 128"  stroke="#1E0E04" strokeWidth="2"   fill="none" strokeLinecap="round" />
        <path d="M344 140 Q352 134 358 136"  stroke="#1E0E04" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M362 106 Q368 100 374 103"  stroke="#1E0E04" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <circle cx="363" cy="101" r="14" fill="#FF8FAD" opacity="0.8" />
        <circle cx="348" cy="95"  r="13" fill="#FFAAC0" opacity="0.85" />
        <circle cx="332" cy="103" r="13" fill="#FF8FAD" opacity="0.8" />
        <circle cx="370" cy="114" r="10" fill="#FFB8CC" opacity="0.7" />
        <circle cx="349" cy="90"  r="10" fill="#FFCCD8" opacity="0.8" />
        <circle cx="325" cy="116" r="10" fill="#FF90B0" opacity="0.7" />
        <circle cx="356" cy="114" r="9"  fill="#FF9AB8" opacity="0.75" />
        <circle cx="336" cy="113" r="9"  fill="#FFAAC0" opacity="0.75" />
        <circle cx="375" cy="103" r="8"  fill="#FFB0C5" opacity="0.65" />
        <circle cx="352" cy="92"  r="4"  fill="#FFECF2" opacity="0.6" />
        <circle cx="335" cy="100" r="3"  fill="#FFECF2" opacity="0.5" />
      </g>

      {/* — Tree CENTER-LEFT (medium) — */}
      <g filter="url(#fj-treeshadow)">
        <path d="M148 180 Q146 166 145 155 Q144 146 146 140" stroke="#1E0E04" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M146 140 Q140 132 133 129"  stroke="#1E0E04" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M146 140 Q152 132 160 130"  stroke="#1E0E04" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M146 147 Q140 142 134 143"  stroke="#1E0E04" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <circle cx="133" cy="126" r="11" fill="#FF9AB8" opacity="0.82" />
        <circle cx="146" cy="121" r="10" fill="#FFAAC0" opacity="0.88" />
        <circle cx="160" cy="127" r="11" fill="#FFB8CC" opacity="0.82" />
        <circle cx="140" cy="118" r="8"  fill="#FFCCD8" opacity="0.78" />
        <circle cx="154" cy="118" r="8"  fill="#FF90B0" opacity="0.75" />
        <circle cx="128" cy="134" r="7"  fill="#FFB0C5" opacity="0.65" />
        <circle cx="165" cy="135" r="7"  fill="#FF9AB8" opacity="0.65" />
      </g>

      {/* — Tree CENTER-RIGHT (medium) — */}
      <g filter="url(#fj-treeshadow)">
        <path d="M252 180 Q254 166 255 155 Q256 146 254 140" stroke="#1E0E04" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M254 140 Q260 132 267 129"  stroke="#1E0E04" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M254 140 Q248 132 240 130"  stroke="#1E0E04" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M254 147 Q260 142 266 143"  stroke="#1E0E04" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <circle cx="267" cy="126" r="11" fill="#FF9AB8" opacity="0.82" />
        <circle cx="254" cy="121" r="10" fill="#FFAAC0" opacity="0.88" />
        <circle cx="240" cy="127" r="11" fill="#FFB8CC" opacity="0.82" />
        <circle cx="260" cy="118" r="8"  fill="#FFCCD8" opacity="0.78" />
        <circle cx="246" cy="118" r="8"  fill="#FF90B0" opacity="0.75" />
        <circle cx="272" cy="134" r="7"  fill="#FFB0C5" opacity="0.65" />
        <circle cx="235" cy="135" r="7"  fill="#FF9AB8" opacity="0.65" />
      </g>

      {/* ═══ FALLING PETALS ═══ */}
      {[
        [90, 130, 18],  [112, 124, -22], [138, 140, 38],
        [172, 134, -12], [210, 138, 28], [258, 126, -32],
        [282, 140, 16], [312, 132, -18], [96, 148, 42],
        [188, 146, -36], [224, 136, 24], [270, 145, -28],
        [130, 128, -8], [195, 152, 35], [240, 130, -20],
        [302, 148, 30], [80, 142, -25], [355, 138, 15],
      ].map(([x, y, rot], i) => (
        <ellipse key={i}
          cx={x} cy={y} rx="2.2" ry="3.2"
          fill={['#FFB7C5','#FF90B0','#FFCCD8','#FF9AB8'][i % 4]}
          opacity={0.5 + (i % 4) * 0.12}
          transform={`rotate(${rot}, ${x}, ${y})`}
        />
      ))}

      {/* ═══ BOTTOM FADE into page ═══ */}
      <rect x="0" y="140" width="400" height="40" fill="url(#fj-fade)" />
    </svg>
  )
}
