import type { Metadata } from "next"
import LegalShell, { Contact } from "@/components/LegalShell"

export const metadata: Metadata = { title: "Política de privacidad · Clarifi" }

export default function PrivacyPage() {
  return (
    <LegalShell title="Política de privacidad">
      <p>
        Clarifi es una aplicación de finanzas personales en etapa piloto. Esta política explica qué datos
        guardamos, para qué los usamos y cómo puedes llevártelos o eliminarlos. Se rige por la Ley N° 19.628
        sobre Protección de la Vida Privada de Chile.
      </p>

      <h2>Qué datos guardamos</h2>
      <ul>
        <li><strong>Datos de tu cuenta:</strong> nombre, email y, si te registras con email, tu contraseña cifrada (nunca la guardamos en texto legible).</li>
        <li><strong>Si entras con Google o GitHub:</strong> recibimos tu nombre, email y foto de perfil. No accedemos a tus correos, archivos, repositorios ni contactos.</li>
        <li><strong>Lo que tú registras:</strong> cuentas, saldos, movimientos, categorías, presupuestos, metas de ahorro, suscripciones, movimientos recurrentes y las fotos de boletas que adjuntes.</li>
        <li><strong>Preferencias:</strong> tema, notificaciones y otros ajustes de tu perfil.</li>
        <li><strong>Notificaciones push:</strong> si las activas, guardamos la dirección técnica de tu dispositivo para enviarte avisos.</li>
        <li><strong>Datos técnicos:</strong> registros de errores (mensaje, página y navegador) para corregir fallas, y contadores temporales de intentos de inicio de sesión por dirección IP para protegerte de ataques.</li>
      </ul>
      <p>
        Clarifi <strong>no</strong> se conecta a tu banco ni pide tus claves bancarias: toda la información
        financiera la ingresas o importas tú.
      </p>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Mostrarte tus finanzas, calcular saldos, presupuestos y análisis.</li>
        <li>Enviarte avisos que tú activaste (cobros próximos, presupuestos por agotarse) y correos necesarios para tu cuenta, como el de recuperar contraseña.</li>
        <li>Mantener la seguridad del servicio y corregir errores.</li>
      </ul>
      <p>No vendemos ni arrendamos tus datos, no los usamos para publicidad y no los compartimos con terceros salvo los proveedores que hacen funcionar el servicio.</p>

      <h2>Dónde se guardan</h2>
      <ul>
        <li><strong>Neon</strong> (base de datos PostgreSQL, servidores de AWS en São Paulo, Brasil).</li>
        <li><strong>Vercel</strong> (aloja la aplicación).</li>
        <li><strong>Resend</strong> (envío de correos de la cuenta).</li>
        <li><strong>Google y GitHub</strong>, solo si eliges iniciar sesión con ellos.</li>
        <li>El servicio de notificaciones de tu navegador (Apple, Google o Mozilla), solo si activas las notificaciones push.</li>
      </ul>
      <p>La conexión con Clarifi siempre va cifrada (HTTPS).</p>

      <h2>Cookies</h2>
      <p>
        Usamos solo una cookie de sesión para mantenerte conectado y cookies técnicas de seguridad del inicio de sesión.
        No usamos cookies de publicidad ni de seguimiento. Si instalas la app, tu dispositivo guarda una copia de las
        pantallas que visitas para poder mostrarlas sin conexión; se borra al cerrar sesión.
      </p>

      <h2>Tus derechos</h2>
      <p>Puedes, en cualquier momento y desde <strong>Perfil → Tus datos</strong>:</p>
      <ul>
        <li><strong>Descargar</strong> una copia completa de tus datos (formato JSON).</li>
        <li><strong>Eliminar tu cuenta</strong>: se borran de inmediato y de forma permanente tu perfil y toda tu información financiera.</li>
      </ul>
      <p>También puedes corregir tus datos editándolos directamente en la app. Para cualquier otra solicitud, <Contact />.</p>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>
        Mientras tu cuenta exista. Al eliminarla, tus datos se borran de la base de datos de inmediato. Los registros
        técnicos de errores se conservan hasta 90 días.
      </p>

      <h2>Cambios a esta política</h2>
      <p>Si la cambiamos de forma importante, te avisaremos dentro de la app antes de que el cambio aplique.</p>
    </LegalShell>
  )
}
