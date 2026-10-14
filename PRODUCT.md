# Product

## Platform

web

## Users

Estudiantes de la Universidad del Magdalena, con foco en Ingeniería de Sistemas
y las demás carreras cargadas (Hotelería y Turismo, Ingeniería Industrial,
Negocios Internacionales). El usuario directo es el desarrollador y su
comunidad/círculo cercano: se usa para llevar entre todos las materias, notas y
horarios del semestre. Idioma de la app: español.

## Product Purpose

Una sola app para todo el semestre: malla curricular con estados y
prerequisitos, horario semanal, calendario, asignaciones, notas, seguimiento
del semestre en curso y recordatorios, con exportación (imagen/PDF y wallpaper)
y sincronización offline. Éxito = el estudiante sabe dónde va en su carrera y
en su semestre en cualquier momento, incluso sin conexión.

## Positioning

"Todo en uno del semestre": horario + calendario + notas + asignaciones +
recordatorios + exportar, unificados para el semestre, sobre la malla curricular
real (Acuerdo Académico N° 21 de 2024) con prerequisitos y simulación de
escenarios (p. ej. "qué pasa si repruebo").

## Operating Context

Uso diario desde el celular como PWA instalable (con pulido específico para
Safari/iOS), también en desktop. Se usa en movimiento, entre clases y en
situaciones sin conexión: los cambios locales se guardan en cola y se
sincronizan al volver la red. El usuario configura su corte de ingreso y las
fechas de su semestre; el semestre en curso se muestra con cuenta regresiva y
progreso.

## Capabilities and Constraints

- Autenticación con hash scrypt, sesiones JWT y recuperación de contraseña por
  pregunta de seguridad (backend propio en Vercel Functions + Supabase, sin
  clave pública en el bundle).
- Mallas reales de 4 carreras de la Universidad del Magdalena (datos en
  `src/data/malla.js`): materias con código, créditos, prerequisitos y estados
  (faltante / cursando / aprobada).
- Secciones: Horario, Calendario, Asignaciones, Semestre (cursando), Notas,
  Malla, Mi Perfil, Colaboración (amistades), Personalizar.
- Personalización por usuario: 9 temas de acento (ámbar por defecto), modo
  claro/oscuro, radio de bordes, escala tipográfica y fuente del cuerpo.
- Sincronización offline con cola de guardados pendientes; PWA con service
  worker; aviso obligatorio de actualización ("Actualización disponible →
  Recargar ahora") vía `mimalla:swupdate` + `UpdatePrompt`.
- Notificaciones push y recordatorios de asignaciones/eventos.
- Colaboración: solicitudes de amistad (pendiente/aceptado), comparación de
  horarios y vista de progreso compartido.
- Exportación de horario a imagen/PDF y generación de wallpaper.
- Despliegue en Vercel (`vercel --prod --yes`). El nombre de caché del service
  worker lo renombra el plugin de Vite en cada build; no se edita a mano.
- Alcance decidido: fijo en Universidad del Magdalena por ahora; otras
  universidades/carreras quedan como decisión futura.

## Brand Commitments

- Nombre: "MiMalla" (marca "Mi" + "Malla", esta última en énfasis).
- Logo: estrella/sparkle sobre cuadrado redondeado oscuro; favicon e iconos
  SVG/PNG alineados con esa marca.
- Voz y texto en español; tagline de login: "Mi plan de estudio <3".
- Tema por defecto de cuentas nuevas: modo claro, acento ámbar, tipografía
  "DM Sans".

## Evidence on Hand

- Mallas reales de 4 carreras en `src/data/malla.js` (códigos, créditos,
  prerequisitos, optativas), basadas en el Acuerdo Académico N° 21 de 2024.
- Esquema de datos: `users`, `user_data` (columnas jsonb por sección) y
  `friendships`; migraciones SQL en la raíz del repo.
- Constante de corte actual: `SEMESTER_CORTE = "2026-2"` con fechas de inicio y
  fin del semestre (`src/utils/semesterCountdown.js`).
- No existen testimonios, casos de estudio ni métricas de uso publicados; no
  inventar ninguno.

## Product Principles

1. Un semestre, un lugar: toda la vida académica del semestre visible y
   conectada (horario, notas, asignaciones, malla, calendario).
2. Offline primero: editar sin red debe ser seguro y sincronizarse sin perder
   datos.
3. Personal, no genérico: tema, tipografía, semestre y corte configurables por
   cada usuario.
4. Social desde el diseño: amigos y colaboración son parte del flujo, no un
   extra.
5. Datos reales, sin inventar: mallas oficiales, fechas reales del semestre y
   estados honestos de la carrera.

## Accessibility & Inclusion

Personalización confirmada: modo claro/oscuro, escala tipográfica y radio de
bordes ajustables por usuario. No hay un estándar de accesibilidad (WCAG u
otro) comprometido como requisito formal.
