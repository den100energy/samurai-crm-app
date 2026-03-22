'use client'

/**
 * FujiScene v2 — реалистичная гора Фудзи с сакурой.
 * Пологие склоны на bezier-кривых, снежные полосы, облака у подножия,
 * изящные ветки с мелкими лепестками вместо шаров.
 */
export function FujiScene({ dark = true, bgColor }: { dark?: boolean; bgColor?: string }) {
  const fadeColor = bgColor ?? (dark ? '#1C1C1E' : '#F5F4F0')

  return (
    <svg
      viewBox="0 0 400 185"
      className="w-full block"
      style={{ display: 'block' }}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
    >
      <defs>
        {/* Sky */}
        <linearGradient id="fj-sky" x1="0" y1="0" x2="0" y2="1">
          {dark ? (
            <>
              <stop offset="0%"   stopColor="#010511" />
              <stop offset="40%"  stopColor="#08082A" />
              <stop offset="75%"  stopColor="#16103C" />
              <stop offset="100%" stopColor="#2A1848" />
            </>
          ) : (
            <>
              <stop offset="0%"   stopColor="#1A3566" />
              <stop offset="35%"  stopColor="#2C6AA0" />
              <stop offset="70%"  stopColor="#82C4E8" />
              <stop offset="100%" stopColor="#B8DCEE" />
            </>
          )}
        </linearGradient>

        {/* Horizon glow */}
        <radialGradient id="fj-hglow" cx="50%" cy="100%" r="65%">
          <stop offset="0%"   stopColor={dark ? '#2A0C50' : '#FFCC88'} stopOpacity="0.5" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>

        {/* Moon */}
        <radialGradient id="fj-moon" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#FFFDE8" />
          <stop offset="65%"  stopColor="#FFE8A0" />
          <stop offset="100%" stopColor="#FFD060" stopOpacity="0.1" />
        </radialGradient>
        <filter id="fj-moonGlow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="6" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>

        {/* Far ridge */}
        <linearGradient id="fj-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={dark ? '#3A2E60' : '#7AA0C0'} stopOpacity={dark ? '0.65' : '0.5'} />
          <stop offset="100%" stopColor={dark ? '#1E1840' : '#9AB8D0'} stopOpacity="0.05" />
        </linearGradient>

        {/* Fuji rock */}
        <linearGradient id="fj-rock" x1="0.25" y1="0" x2="0.8" y2="1">
          {dark ? (
            <>
              <stop offset="0%"   stopColor="#6070880" />
              <stop offset="0%"   stopColor="#607088" />
              <stop offset="45%"  stopColor="#445868" />
              <stop offset="100%" stopColor="#2C3C4C" />
            </>
          ) : (
            <>
              <stop offset="0%"   stopColor="#8898A8" />
              <stop offset="45%"  stopColor="#6A7888" />
              <stop offset="100%" stopColor="#4E5E6E" />
            </>
          )}
        </linearGradient>
        <linearGradient id="fj-rockShadow" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%"   stopColor="#10202E" stopOpacity="0.7" />
          <stop offset="55%"  stopColor="#10202E" stopOpacity="0.0" />
        </linearGradient>
        <linearGradient id="fj-rockLight" x1="1" y1="0" x2="0.35" y2="0.5">
          <stop offset="0%"   stopColor={dark ? '#A0B8CC' : '#C8D8E8'} stopOpacity="0.35" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </linearGradient>

        {/* Snow */}
        <linearGradient id="fj-snow" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%"   stopColor="#FFFFFF" />
          <stop offset="55%"  stopColor="#EEF4FF" />
          <stop offset="100%" stopColor={dark ? '#C0D0E4' : '#D0E0F0'} />
        </linearGradient>

        {/* Cloud wisps */}
        <radialGradient id="fj-cloudL" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.85" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>

        {/* Hills */}
        <linearGradient id="fj-hill1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={dark ? '#1C3C22' : '#2A5230'} />
          <stop offset="100%" stopColor={dark ? '#0A180C' : '#162018'} />
        </linearGradient>
        <linearGradient id="fj-hill2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={dark ? '#152A18' : '#1E3A24'} />
          <stop offset="100%" stopColor={dark ? '#060E06' : '#0E1610'} />
        </linearGradient>

        {/* Foreground */}
        <linearGradient id="fj-fg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={dark ? '#0C180E' : '#142018'} />
          <stop offset="100%" stopColor={dark ? '#040804' : '#0A120A'} />
        </linearGradient>

        {/* Mist */}
        <linearGradient id="fj-mist" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="white" stopOpacity="0" />
          <stop offset="22%"  stopColor="white" stopOpacity="0.4" />
          <stop offset="50%"  stopColor="white" stopOpacity="0.18" />
          <stop offset="78%"  stopColor="white" stopOpacity="0.36" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>

        {/* Bottom fade */}
        <linearGradient id="fj-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="transparent" />
          <stop offset="100%" stopColor={fadeColor} />
        </linearGradient>

        {/* Filters */}
        <filter id="fj-atmo" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <filter id="fj-cloudBlur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* ═══ SKY ═══ */}
      <rect width="400" height="185" fill="url(#fj-sky)" />
      <rect width="400" height="185" fill="url(#fj-hglow)" />

      {/* ═══ MOON / SUN ═══ */}
      {dark ? (
        <>
          <circle cx="306" cy="34" r="26" fill="#FFFAE0" opacity="0.07" />
          <circle cx="306" cy="34" r="15" fill="url(#fj-moon)" filter="url(#fj-moonGlow)" />
          {/* Crescent shadow */}
          <circle cx="315" cy="31" r="12.5" fill="#08082A" />
        </>
      ) : (
        <>
          <circle cx="58" cy="36" r="30" fill="#FFDF80" opacity="0.13" />
          <circle cx="58" cy="36" r="20" fill="#FFEE90" opacity="0.25" />
          <circle cx="58" cy="36" r="13" fill="#FFF8B0" opacity="0.95" />
        </>
      )}

      {/* ═══ STARS ═══ */}
      {dark && [
        [24,11,0.9],[55,7,0.75],[92,15,0.85],[128,5,0.7],[163,12,0.8],
        [200,4,0.9],[238,10,0.78],[276,17,0.85],[338,12,0.72],[372,6,0.82],
        [42,26,0.55],[114,22,0.62],[178,28,0.52],[250,7,0.88],[295,20,0.6],
        [15,36,0.42],[148,19,0.72],[332,28,0.52],[382,18,0.66],[75,30,0.48],
      ].map(([x,y,o],i) => (
        <circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 1.3 : 0.85} fill="white" opacity={o} />
      ))}

      {/* ═══ DISTANT RIDGE ═══ */}
      <path
        d="M0 98 L20 78 L45 90 L72 66 L102 82 L132 60 L162 76 L190 64 L216 78 L246 62 L276 76 L303 66 L330 78 L356 67 L376 74 L400 70 L400 108 L0 108 Z"
        fill="url(#fj-far)"
        filter="url(#fj-atmo)"
      />

      {/* ═══ FUJI — pологий конус на bezier-кривых ═══ */}
      {/* Main body */}
      <path
        d="M200 10
           C 188 28, 164 56, 142 80
           C 114 110, 58 118, 0 120
           L 400 120
           C 342 118, 286 110, 258 80
           C 236 56, 212 28, 200 10 Z"
        fill="url(#fj-rock)"
      />
      {/* Shadow — left face */}
      <path
        d="M200 10
           C 188 28, 164 56, 142 80
           C 114 110, 58 118, 0 120
           L 110 120
           C 140 114, 168 100, 183 82
           C 191 66, 196 40, 200 10 Z"
        fill="url(#fj-rockShadow)"
      />
      {/* Highlight — right face */}
      <path
        d="M200 10
           C 212 28, 236 56, 258 80
           C 286 110, 342 118, 400 120
           L 295 120
           C 264 112, 238 98, 220 82
           C 208 66, 203 40, 200 10 Z"
        fill="url(#fj-rockLight)"
      />

      {/* ═══ SNOW CAP ═══ */}
      {/* Main snow body */}
      <path
        d="M200 10
           C 196 20, 190 32, 183 44
           Q 186 41, 189 45
           Q 192 39, 195 44
           Q 197 37, 200 42
           Q 203 37, 205 44
           Q 208 39, 211 45
           Q 214 41, 217 44
           C 210 32, 204 20, 200 10 Z"
        fill="url(#fj-snow)"
      />
      {/* Snow spreading down left slope */}
      <path
        d="M183 44 C 177 54, 170 60, 165 65
           Q 168 62, 171 65
           Q 174 60, 177 64
           Q 180 57, 182 61
           C 183 52, 183 48, 183 44 Z"
        fill="#EEF4FF" opacity="0.82"
      />
      {/* Snow spreading down right slope */}
      <path
        d="M217 44 C 223 54, 230 60, 235 65
           Q 232 62, 229 65
           Q 226 60, 223 64
           Q 220 57, 218 61
           C 217 52, 217 48, 217 44 Z"
        fill="#EEF4FF" opacity="0.82"
      />
      {/* Snow streaks — реалистичные потоки */}
      <path d="M187 46 C 182 57, 175 67, 169 74" stroke="white" strokeWidth="0.9" fill="none" opacity="0.55" strokeLinecap="round"/>
      <path d="M193 43 C 191 54, 188 64, 184 72" stroke="white" strokeWidth="0.7" fill="none" opacity="0.4"  strokeLinecap="round"/>
      <path d="M197 41 C 196 52, 195 62, 193 70" stroke="white" strokeWidth="0.65" fill="none" opacity="0.35" strokeLinecap="round"/>
      <path d="M213 46 C 218 57, 225 67, 231 74" stroke="white" strokeWidth="0.9" fill="none" opacity="0.55" strokeLinecap="round"/>
      <path d="M207 43 C 209 54, 212 64, 216 72" stroke="white" strokeWidth="0.7" fill="none" opacity="0.4"  strokeLinecap="round"/>
      <path d="M203 41 C 204 52, 205 62, 207 70" stroke="white" strokeWidth="0.65" fill="none" opacity="0.35" strokeLinecap="round"/>

      {/* Crater */}
      <ellipse cx="200" cy="11" rx="3.5" ry="1.5" fill="#253848" opacity="0.55" />

      {/* ═══ ОБЛАКА у подножия снега ═══ */}
      <ellipse cx="200" cy="88" rx="80" ry="10" fill="url(#fj-cloudL)" filter="url(#fj-cloudBlur)" opacity="0.55" />
      <ellipse cx="158" cy="94" rx="52" ry="7"  fill="white" filter="url(#fj-cloudBlur)" opacity="0.28" />
      <ellipse cx="242" cy="94" rx="52" ry="7"  fill="white" filter="url(#fj-cloudBlur)" opacity="0.28" />
      <ellipse cx="200" cy="92" rx="50" ry="5"  fill="white" filter="url(#fj-cloudBlur)" opacity="0.22" />

      {/* ═══ HILLS ═══ */}
      <path
        d="M0 114 Q32 102 72 112 Q112 98 152 110 Q178 102 200 112 Q222 104 260 110 Q298 98 340 112 Q368 104 400 114 L400 134 L0 134 Z"
        fill="url(#fj-hill1)"
      />
      <path
        d="M0 124 Q42 116 84 126 Q128 116 170 124 Q200 118 232 124 Q272 116 318 124 Q358 118 400 124 L400 142 L0 142 Z"
        fill="url(#fj-hill2)"
      />

      {/* ═══ MIST ═══ */}
      <ellipse cx="200" cy="116" rx="200" ry="8" fill="url(#fj-mist)" opacity="0.85" />
      <ellipse cx="200" cy="124" rx="200" ry="5" fill="url(#fj-mist)" opacity="0.42" />

      {/* ═══ FOREGROUND ═══ */}
      <path
        d="M0 136 Q55 128 124 136 Q188 128 258 134 Q322 128 400 136 L400 185 L0 185 Z"
        fill="url(#fj-fg)"
      />

      {/* ═══ САКУРА — изящные ветки с мелкими лепестками ═══ */}

      {/* ── Дерево ЛЕВОЕ (высокое) ── */}
      <g>
        {/* Ствол */}
        <path d="M64 185 Q62 170 61 160 Q60 150 61 142 Q62 135 61 126"
          stroke="#1E0C06" strokeWidth="3.2" fill="none" strokeLinecap="round"/>
        {/* Главные ветки */}
        <path d="M61 126 Q51 116 40 111" stroke="#1E0C06" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <path d="M61 126 Q70 114 80 110" stroke="#1E0C06" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <path d="M61 132 Q47 124 34 123" stroke="#1E0C06" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <path d="M61 132 Q75 125 88 125" stroke="#1E0C06" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        {/* Вторичные ветки */}
        <path d="M40 111 Q33 105 26 107" stroke="#1E0C06" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
        <path d="M40 111 Q37 105 34 101" stroke="#1E0C06" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        <path d="M80 110 Q86 104 92 106" stroke="#1E0C06" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
        <path d="M80 110 Q82 104 84 100" stroke="#1E0C06" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        <path d="M34 123 Q26 118 19 120" stroke="#1E0C06" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        <path d="M88 125 Q95 119 101 121" stroke="#1E0C06" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        {/* Поникающие веточки */}
        <path d="M36 104 Q30 114 26 122" stroke="#1E0C06" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
        <path d="M80 107 Q87 117 90 125" stroke="#1E0C06" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
        <path d="M24 107 Q18 115 15 123" stroke="#1E0C06" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
        <path d="M92 106 Q98 114 100 122" stroke="#1E0C06" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
        <path d="M26 120 Q22 126 20 132" stroke="#1E0C06" strokeWidth="0.7" fill="none" strokeLinecap="round"/>
        <path d="M19 120 Q14 126 12 132" stroke="#1E0C06" strokeWidth="0.7" fill="none" strokeLinecap="round"/>
        {/* Мелкие лепестки — плотные кластеры */}
        {[
          [37,100],[33,97],[40,95],[36,93],[43,98],[29,103],[31,98],
          [82,101],[85,97],[80,95],[87,100],[84,94],[78,98],[90,104],
          [52,91],[56,88],[48,90],[53,86],[58,92],[47,93],[62,89],[66,92],
          [70,88],[64,93],[68,91],[73,89],[63,86],[75,92],[59,85],
          [25,106],[22,110],[18,112],[27,112],[16,116],
          [97,108],[100,112],[103,114],[95,112],[104,116],
          [29,120],[24,124],[21,128],[27,126],
          [91,122],[96,126],[99,128],[93,126],
        ].map(([x,y],i) => (
          <ellipse key={i}
            cx={x} cy={y}
            rx={2.2 + (i % 3) * 0.5}
            ry={2.0 + (i % 4) * 0.4}
            fill={['#FF5C80','#FF7A9E','#FF9AB8','#FF6A90','#FFB0C8','#FF4E74'][i % 6]}
            opacity={0.72 + (i % 5) * 0.04}
          />
        ))}
        {/* Совсем мелкие — рассеяны среди веток */}
        {[
          [44,102],[50,96],[57,93],[65,90],[72,95],[79,103],[86,107],
          [30,110],[23,115],[19,118],[97,110],[102,115],[105,118],
        ].map(([x,y],i) => (
          <circle key={`s${i}`} cx={x} cy={y} r={1.4} fill="#FFCCDA" opacity={0.65} />
        ))}
      </g>

      {/* ── Дерево ПРАВОЕ (высокое, зеркальное) ── */}
      <g>
        <path d="M336 185 Q338 170 339 160 Q340 150 339 142 Q338 135 339 126"
          stroke="#1E0C06" strokeWidth="3.2" fill="none" strokeLinecap="round"/>
        <path d="M339 126 Q349 116 360 111" stroke="#1E0C06" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <path d="M339 126 Q330 114 320 110" stroke="#1E0C06" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <path d="M339 132 Q353 124 366 123" stroke="#1E0C06" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <path d="M339 132 Q325 125 312 125" stroke="#1E0C06" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <path d="M360 111 Q367 105 374 107" stroke="#1E0C06" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
        <path d="M360 111 Q363 105 366 101" stroke="#1E0C06" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        <path d="M320 110 Q314 104 308 106" stroke="#1E0C06" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
        <path d="M320 110 Q318 104 316 100" stroke="#1E0C06" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        <path d="M366 123 Q374 118 381 120" stroke="#1E0C06" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        <path d="M312 125 Q305 119 299 121" stroke="#1E0C06" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        <path d="M364 104 Q370 114 374 122" stroke="#1E0C06" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
        <path d="M320 107 Q313 117 310 125" stroke="#1E0C06" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
        <path d="M376 107 Q382 115 385 123" stroke="#1E0C06" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
        <path d="M308 106 Q302 114 300 122" stroke="#1E0C06" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
        <path d="M374 120 Q378 126 380 132" stroke="#1E0C06" strokeWidth="0.7" fill="none" strokeLinecap="round"/>
        <path d="M381 120 Q386 126 388 132" stroke="#1E0C06" strokeWidth="0.7" fill="none" strokeLinecap="round"/>
        {[
          [363,100],[367,97],[360,95],[364,93],[357,98],[371,103],[369,98],
          [318,101],[315,97],[320,95],[313,100],[316,94],[322,98],[310,104],
          [348,91],[344,88],[352,90],[347,86],[342,92],[353,93],[338,89],[334,92],
          [330,88],[336,93],[332,91],[327,89],[337,86],[325,92],[341,85],
          [375,106],[378,110],[382,112],[373,112],[384,116],
          [303,108],[300,112],[297,114],[305,112],[296,116],
          [371,120],[376,124],[379,128],[373,126],
          [309,122],[304,126],[301,128],[307,126],
        ].map(([x,y],i) => (
          <ellipse key={i}
            cx={x} cy={y}
            rx={2.2 + (i % 3) * 0.5}
            ry={2.0 + (i % 4) * 0.4}
            fill={['#FF5C80','#FF7A9E','#FF9AB8','#FF6A90','#FFB0C8','#FF4E74'][i % 6]}
            opacity={0.72 + (i % 5) * 0.04}
          />
        ))}
        {[
          [356,102],[350,96],[343,93],[335,90],[328,95],[321,103],[314,107],
          [370,110],[377,115],[381,118],[303,110],[298,115],[295,118],
        ].map(([x,y],i) => (
          <circle key={`s${i}`} cx={x} cy={y} r={1.4} fill="#FFCCDA" opacity={0.65} />
        ))}
      </g>

      {/* ── Дерево ЦЕНТР-ЛЕВОЕ (среднее) ── */}
      <g>
        <path d="M150 185 Q149 173 149 165 Q148 157 149 150"
          stroke="#1E0C06" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <path d="M149 150 Q142 142 135 139" stroke="#1E0C06" strokeWidth="1.7" fill="none" strokeLinecap="round"/>
        <path d="M149 150 Q156 142 164 139" stroke="#1E0C06" strokeWidth="1.7" fill="none" strokeLinecap="round"/>
        <path d="M149 154 Q141 148 133 149" stroke="#1E0C06" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        <path d="M149 154 Q157 149 165 150" stroke="#1E0C06" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        <path d="M135 139 Q128 134 122 136" stroke="#1E0C06" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
        <path d="M164 139 Q171 134 177 136" stroke="#1E0C06" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
        <path d="M133 149 Q126 145 120 147" stroke="#1E0C06" strokeWidth="1.0" fill="none" strokeLinecap="round"/>
        {[
          [134,135],[130,132],[137,130],[128,130],[135,127],[131,128],
          [165,135],[169,132],[163,130],[171,130],[165,127],[170,128],
          [149,134],[146,131],[152,130],[149,128],[154,132],[144,131],
          [122,133],[118,130],[125,129],[120,136],[116,134],
          [177,133],[180,130],[175,129],[178,136],[184,134],
        ].map(([x,y],i) => (
          <ellipse key={i}
            cx={x} cy={y}
            rx={2.0 + (i % 3) * 0.45}
            ry={1.8 + (i % 4) * 0.35}
            fill={['#FF5C80','#FF7A9E','#FF9AB8','#FF6A90','#FFB0C8'][i % 5]}
            opacity={0.7 + (i % 5) * 0.04}
          />
        ))}
      </g>

      {/* ── Дерево ЦЕНТР-ПРАВОЕ ── */}
      <g>
        <path d="M250 185 Q251 173 251 165 Q252 157 251 150"
          stroke="#1E0C06" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <path d="M251 150 Q258 142 265 139" stroke="#1E0C06" strokeWidth="1.7" fill="none" strokeLinecap="round"/>
        <path d="M251 150 Q244 142 236 139" stroke="#1E0C06" strokeWidth="1.7" fill="none" strokeLinecap="round"/>
        <path d="M251 154 Q259 148 267 149" stroke="#1E0C06" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        <path d="M251 154 Q243 149 235 150" stroke="#1E0C06" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        <path d="M265 139 Q272 134 278 136" stroke="#1E0C06" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
        <path d="M236 139 Q229 134 223 136" stroke="#1E0C06" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
        <path d="M267 149 Q274 145 280 147" stroke="#1E0C06" strokeWidth="1.0" fill="none" strokeLinecap="round"/>
        {[
          [266,135],[270,132],[263,130],[272,130],[265,127],[270,128],
          [235,135],[231,132],[237,130],[229,130],[235,127],[230,128],
          [251,134],[254,131],[248,130],[251,128],[246,132],[256,131],
          [278,133],[282,130],[275,129],[280,136],[284,134],
          [223,133],[220,130],[225,129],[222,136],[216,134],
        ].map(([x,y],i) => (
          <ellipse key={i}
            cx={x} cy={y}
            rx={2.0 + (i % 3) * 0.45}
            ry={1.8 + (i % 4) * 0.35}
            fill={['#FF5C80','#FF7A9E','#FF9AB8','#FF6A90','#FFB0C8'][i % 5]}
            opacity={0.7 + (i % 5) * 0.04}
          />
        ))}
      </g>

      {/* ═══ ЛЕПЕСТКИ В ВОЗДУХЕ ═══ */}
      {[
        [96,132,18],[110,124,-22],[137,140,38],[172,133,-12],[220,136,28],
        [257,126,-32],[282,140,16],[313,131,-18],[93,148,42],[187,145,-36],
        [230,134,24],[270,143,-28],[130,127,-8],[200,151,35],[244,129,-20],
        [307,146,30],[78,141,-25],[360,137,15],[167,156,22],[287,152,-15],
        [118,143,28],[195,128,-18],[248,158,12],[145,136,-30],[330,154,25],
      ].map(([x,y,rot],i) => (
        <ellipse key={i}
          cx={x} cy={y} rx="1.8" ry="2.8"
          fill={['#FF9AB8','#FF7090','#FFCCD8','#FF85A8'][i % 4]}
          opacity={0.45 + (i % 4) * 0.1}
          transform={`rotate(${rot},${x},${y})`}
        />
      ))}

      {/* ═══ BOTTOM FADE ═══ */}
      <rect x="0" y="135" width="400" height="50" fill="url(#fj-fade)" />
    </svg>
  )
}
