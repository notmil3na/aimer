import "./AnimatedFace.css";

/**
 * Carita animada (parpadea, respira y mira a los lados).
 *
 * El SVG va en línea, no como <img src="...svg">, porque las animaciones CSS
 * dentro de un SVG cargado con <img> no se reproducen de forma confiable
 * (Chrome las congela). En línea sí se ven siempre.
 */
export default function AnimatedFace({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 26 512 512"
      role="img"
      aria-label="Carita animada que parpadea y mira a los lados"
      focusable="false"
    >
      <defs>
        <path
          id="afP"
          d="M95 340C95 245 170 178 256 178s161 67 161 162q0 55-55 55H150q-55 0-55-55Z"
        />
        <clipPath id="afClipBody">
          <use href="#afP" />
        </clipPath>

        <radialGradient id="afBg" cx="50%" cy="46%" r="75%">
          <stop offset="0" stopColor="#F1E8D7" />
          <stop offset="1" stopColor="#EDE2D0" />
        </radialGradient>
        <linearGradient id="afBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4A590" />
          <stop offset=".3" stopColor="#EE6247" />
          <stop offset=".55" stopColor="#EA5538" />
          <stop offset=".85" stopColor="#E3614A" />
          <stop offset="1" stopColor="#E9856C" />
        </linearGradient>
        <linearGradient id="afHalo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBE59A" />
          <stop offset="1" stopColor="#F6CF70" />
        </linearGradient>
        <linearGradient id="afGloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".92" />
          <stop offset=".45" stopColor="#FFE3DA" stopOpacity=".38" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="afGlossL" cx="40%" cy="40%" r="62%">
          <stop offset="0" stopColor="#fff" stopOpacity=".85" />
          <stop offset=".55" stopColor="#FFE6DE" stopOpacity=".4" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="afEyeFill" cx="38%" cy="32%" r="80%">
          <stop offset="0" stopColor="#FFF9F6" />
          <stop offset=".6" stopColor="#F6DAD6" />
          <stop offset="1" stopColor="#E3BFC6" />
        </radialGradient>
        <linearGradient id="afRim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#BFDDF5" stopOpacity="0" />
          <stop offset=".5" stopColor="#A9CBEE" stopOpacity=".35" />
          <stop offset="1" stopColor="#8FB9E8" />
        </linearGradient>

        <filter id="afBWide" filterUnits="userSpaceOnUse" x="-60" y="-60" width="632" height="632">
          <feGaussianBlur stdDeviation="30" />
        </filter>
        <filter id="afBMid" filterUnits="userSpaceOnUse" x="-60" y="-60" width="632" height="632">
          <feGaussianBlur stdDeviation="11" />
        </filter>
        <filter id="afBHalo" filterUnits="userSpaceOnUse" x="-60" y="-60" width="632" height="632">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id="afBEdge" filterUnits="userSpaceOnUse" x="-60" y="-60" width="632" height="632">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
        <filter id="afBRim" filterUnits="userSpaceOnUse" x="-60" y="-60" width="632" height="632">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id="afBGloss" filterUnits="userSpaceOnUse" x="-60" y="-60" width="632" height="632">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="afBEye" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation=".7" />
        </filter>
        <filter id="afGrain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" />
          <feColorMatrix values="0 0 0 0 .45  0 0 0 0 .3  0 0 0 0 .25  0 0 0 .22 0" />
        </filter>
      </defs>

      <rect x="-96" y="-96" width="704" height="704" fill="url(#afBg)" />

      {/* difuminados exteriores (fijos) */}
      <use
        href="#afP"
        fill="#EE4F34"
        stroke="#EE4F34"
        strokeWidth="84"
        strokeLinejoin="round"
        opacity=".9"
        filter="url(#afBWide)"
      />
      <use
        href="#afP"
        fill="#E8432B"
        stroke="#E8432B"
        strokeWidth="34"
        strokeLinejoin="round"
        opacity=".95"
        filter="url(#afBMid)"
      />
      <use
        href="#afP"
        fill="url(#afHalo)"
        opacity=".92"
        transform="translate(-5 -31) scale(1.02 1)"
        filter="url(#afBHalo)"
      />
      <use
        href="#afP"
        fill="#E8432B"
        stroke="#E8432B"
        strokeWidth="10"
        strokeLinejoin="round"
        opacity=".55"
        filter="url(#afBHalo)"
      />

      <g className="afLean">
        <g className="afBreathe">
          {/* cuerpo con borde suave */}
          <use href="#afP" fill="url(#afBody)" filter="url(#afBEdge)" />

          <g clipPath="url(#afClipBody)">
            {/* borde interior más claro, como gelatina translúcida */}
            <use
              href="#afP"
              fill="none"
              stroke="#F9B7AA"
              strokeWidth="34"
              opacity=".55"
              filter="url(#afBRim)"
            />
            {/* brillo superior */}
            <ellipse
              cx="226"
              cy="206"
              rx="178"
              ry="66"
              transform="rotate(-9 226 206)"
              fill="url(#afGlossL)"
              filter="url(#afBGloss)"
            />
            <ellipse
              cx="250"
              cy="190"
              rx="120"
              ry="16"
              fill="#fff"
              opacity=".55"
              filter="url(#afBGloss)"
            />
            {/* luz suave abajo */}
            <ellipse
              cx="256"
              cy="396"
              rx="112"
              ry="20"
              fill="#FFC4AE"
              opacity=".6"
              filter="url(#afBRim)"
            />
          </g>

          {/* ojos */}
          <g className="afLook">
            <g className="afEye">
              <ellipse
                cx="211"
                cy="295"
                rx="24"
                ry="34"
                transform="rotate(-9 211 295)"
                fill="url(#afEyeFill)"
                stroke="url(#afRim)"
                strokeWidth="3.5"
                filter="url(#afBEye)"
              />
              <circle cx="205" cy="277" r="6" fill="#fff" />
              <circle cx="217" cy="310" r="3" fill="#fff" opacity=".5" />
            </g>
            <g className="afEye">
              <ellipse
                cx="309"
                cy="290"
                rx="25"
                ry="34"
                transform="rotate(-9 309 290)"
                fill="url(#afEyeFill)"
                stroke="url(#afRim)"
                strokeWidth="3.5"
                filter="url(#afBEye)"
              />
              <circle cx="300" cy="271" r="6" fill="#fff" />
              <circle cx="316" cy="305" r="3" fill="#fff" opacity=".5" />
            </g>
          </g>
        </g>
      </g>

      {/* grano sutil, como el original */}
      <rect x="-96" y="-96" width="704" height="704" filter="url(#afGrain)" opacity=".5" />
    </svg>
  );
}
