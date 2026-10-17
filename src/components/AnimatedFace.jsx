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
      viewBox="76 116 360 360"
      role="img"
      aria-label="Carita animada que parpadea y mira a los lados"
      focusable="false"
    >
      <defs>
        <radialGradient id="afBg" cx="50%" cy="48%" r="70%">
          <stop offset="0" stopColor="#EFE6D4" />
          <stop offset="1" stopColor="#E7DBC4" />
        </radialGradient>
        <linearGradient id="afBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7907A" />
          <stop offset=".35" stopColor="#F06547" />
          <stop offset="1" stopColor="#E7452D" />
        </linearGradient>
        <radialGradient id="afEyeFill" cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor="#FFF7F4" />
          <stop offset=".7" stopColor="#F4D5D2" />
          <stop offset="1" stopColor="#B9D3EE" />
        </radialGradient>
        <filter id="afBlurGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="24" />
        </filter>
        <filter id="afBlurHalo" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id="afBlurGloss" x="-30%" y="-80%" width="160%" height="260%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <rect width="512" height="512" fill="url(#afBg)" />

      <g className="afLean">
        {/* brillo exterior y halo amarillo */}
        <path
          d="M95 340C95 245 170 178 256 178s161 67 161 162q0 55-55 55H150q-55 0-55-55Z"
          fill="#EF5338"
          opacity=".55"
          filter="url(#afBlurGlow)"
        />
        <ellipse cx="256" cy="212" rx="152" ry="70" fill="#FFD75A" filter="url(#afBlurHalo)" />

        <g className="afBreathe">
          {/* cuerpo */}
          <path
            d="M95 340C95 245 170 178 256 178s161 67 161 162q0 55-55 55H150q-55 0-55-55Z"
            fill="url(#afBody)"
          />
          <ellipse
            cx="232"
            cy="212"
            rx="96"
            ry="26"
            fill="#fff"
            opacity=".32"
            filter="url(#afBlurGloss)"
          />

          {/* ojos */}
          <g className="afLook">
            <g className="afEye">
              <ellipse
                cx="211"
                cy="288"
                rx="24"
                ry="31"
                transform="rotate(5 211 288)"
                fill="url(#afEyeFill)"
              />
              <circle cx="204" cy="275" r="6" fill="#fff" />
              <circle cx="219" cy="304" r="3" fill="#fff" opacity=".55" />
            </g>
            <g className="afEye">
              <ellipse
                cx="309"
                cy="285"
                rx="25"
                ry="32"
                transform="rotate(5 309 285)"
                fill="url(#afEyeFill)"
              />
              <circle cx="301" cy="271" r="6" fill="#fff" />
              <circle cx="318" cy="302" r="3" fill="#fff" opacity=".55" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
