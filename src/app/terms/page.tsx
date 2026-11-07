import type { Metadata } from "next"
import Link from "next/link"
import LegalShell, { Contact } from "@/components/LegalShell"

export const metadata: Metadata = { title: "Términos de uso · Clarifi" }

export default function TermsPage() {
  return (
    <LegalShell title="Términos de uso">
      <p>
        Al crear una cuenta o usar Clarifi aceptas estos términos. Si no estás de acuerdo, no uses el servicio.
      </p>

      <h2>Qué es Clarifi</h2>
      <p>
        Clarifi es una herramienta para registrar y organizar tus finanzas personales. Es un <strong>proyecto piloto</strong>:
        el servicio es gratuito, puede cambiar, tener interrupciones o errores, y podría discontinuarse avisándote con anticipación
        para que descargues tus datos.
      </p>

      <h2>No es un banco ni asesoría financiera</h2>
      <ul>
        <li>Clarifi no mueve dinero, no se conecta a tus cuentas bancarias y no guarda claves bancarias.</li>
        <li>Los saldos y análisis se calculan con la información que tú ingresas; verifica siempre con tu banco.</li>
        <li>Nada en la app es asesoría financiera, tributaria ni de inversión.</li>
      </ul>

      <h2>Tu cuenta</h2>
      <ul>
        <li>Eres responsable de mantener segura tu contraseña y el acceso a tu cuenta de Google o GitHub.</li>
        <li>Debes usar datos verdaderos y ser mayor de 18 años, o contar con autorización de tu representante legal.</li>
        <li>Puedes eliminar tu cuenta cuando quieras desde Perfil → Tus datos.</li>
      </ul>

      <h2>Uso aceptable</h2>
      <p>
        No puedes intentar acceder a cuentas ajenas, vulnerar la seguridad del servicio, sobrecargarlo con solicitudes
        automatizadas ni usarlo para actividades ilegales. Podemos suspender cuentas que incumplan estas reglas.
      </p>

      <h2>Tus datos</h2>
      <p>
        Tus datos son tuyos. Cómo los tratamos está descrito en la <Link href="/privacy">Política de privacidad</Link>.
      </p>

      <h2>Responsabilidad</h2>
      <p>
        El servicio se entrega &ldquo;tal como está&rdquo; durante el piloto. En la medida que la ley lo permita, Clarifi no
        responde por decisiones financieras tomadas con base en la información de la app ni por pérdidas de datos;
        te recomendamos descargar tus datos periódicamente.
      </p>

      <h2>Cambios y contacto</h2>
      <p>
        Si cambiamos estos términos de forma importante te avisaremos en la app. Se rigen por las leyes de Chile.
        Para dudas, <Contact />.
      </p>
    </LegalShell>
  )
}
