# Guía de Emergencia: Eliminar Commit con Credenciales Expuestas

Esta guía detalla los pasos para eliminar el último commit tanto localmente como en GitHub, preservando tus cambios de código, tras haber expuesto accidentalmente claves sensibles (como las de Supabase).

## 🚨 IMPORTANTE: Primer Paso de Seguridad

**Antes de hacer nada con Git, ve al dashboard de Supabase (o el servicio correspondiente) y ROTA/REGENERA LAS CLAVES.**

Aunque elimines el commit del historial visible:

1. Bots automáticos escanean GitHub constantemente buscando keys.
2. El commit "borrado" puede seguir accesible mediante su hash directo en GitHub por un tiempo.
3. **Tus claves actuales ya están comprometidas.** Cambiarlas es la única solución 100% segura.

---

## Procedimiento Paso a Paso

### 1. Deshacer el commit localmente (manteniendo cambios)

Abre tu terminal en la raíz del proyecto y ejecuta:

```bash
# Deshace el último commit pero MANTIENE tus cambios en "staged" (listos para commit)
git reset --soft HEAD~1
```

_Si prefieres que los cambios no estén "staged" (listos para commit) sino solo en tus archivos, usa `git reset HEAD~1` (sin --soft)._

### 2. Limpiar el código

Ahora que has deshecho el commit, tus archivos están como antes de confirmar.

1.  **Borra las claves** de los archivos donde las pusiste.
2.  Mueve esas claves a un archivo de variables de entorno (ej. `.env`).
3.  Asegúrate de que el archivo `.env` esté incluido en tu `.gitignore`.

### 3. Volver a hacer el commit (Limpio)

Una vez eliminadas las claves del código:

```bash
# Verifica que los cambios son correctos
git status

# Agrega los archivos corregidos
git add .

# Haz el nuevo commit seguro
git commit -m "feat: tu mensaje de commit corregido"
```

### 4. Actualizar GitHub (Force Push)

Como el historial local ha cambiado (el commit viejo ya no existe y hay uno nuevo), necesitas forzar la actualización en GitHub.

**⚠️ Cuidado:** Asegúrate de estar en la rama correcta y que nadie más haya subido cambios después de tu commit erróneo.

```bash
# Reemplaza 'main' por el nombre de tu rama si es diferente
git push origin main --force
```

---

## Prevención Futura

Para evitar que esto vuelva a suceder:

1.  **Usa archivos `.env`:** Nunca escribas credenciales directamente en el código (`hardcode`).
2.  **Revisa `.gitignore`:** Confirma que `.env`, `*.env`, o `environment.ts` (si contiene secretos) estén ignorados.
3.  **Hooks de pre-commit:** Considera herramientas como `husky` o `git-secrets` que impiden hacer commit si detectan patrones de claves.
