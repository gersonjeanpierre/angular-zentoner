// generate-env.js

const fs = require('fs');
const path = require('path');

// Las variables de entorno de Cloudflare se exponen a este proceso
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_DEFAULT_KEY = process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_DEFAULT_KEY) {
  console.error('FATAL: SUPABASE_URL o SUPABASE_KEY no están definidas en el entorno de build.');
  process.exit(1); // Falla el script si las variables no están
}

const envContent = `
// Este archivo es generado automáticamente en el proceso de compilación de Cloudflare Pages
export const environment = {
  production: true,
  SUPABASE_URL: "${SUPABASE_URL}",
  SUPABASE_PUBLISHABLE_DEFAULT_KEY: "${SUPABASE_PUBLISHABLE_DEFAULT_KEY}"
};
`;

const targetDir = path.join(__dirname, 'src', 'environments');
const targetPath = path.join(targetDir, 'environment.ts');

try {
  // 1. Crea el directorio si no existe (soluciona tu error anterior)
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 2. Escribe el archivo
  fs.writeFileSync(targetPath, envContent.trim());
  console.log(`✅ Archivo de entorno generado con éxito en: ${targetPath}`);
} catch (error) {
  console.error('❌ Error al generar el archivo de entorno:', error);
  process.exit(1);
}
