// Construyendo mi Empleado Autenticado - Deno Deploy Service
//@ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2';
// @ts-ignore
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
// @ts-ignore
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_c-nXvPVJLaChofFUkVyMAw_VvbfdJ8Q';
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan claves de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  throw new Error('Missing environment variables.');
}
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: true,
  },
});
//--- Configuración de CORS (Se mantiene tu configuración) ---
const ALLOWED_ORIGINS = [
  'https://dev.zentoner.pages.dev',
  'https://zentoner.pages.dev',
  'http://localhost:4200',
];
function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}
//--- Función para generar código de cliente ---
function generateCustomerCode(firstName: string, lastName: string): string {
  const getWords = (str: string) =>
    str
      .trim()
      .toUpperCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);

  // Helper to pad or slice.
  // Note: Original logic used 'X' padding. New requirements mention 'Z' for strange cases.
  // We will use 'Z' for padding in new cases to be safe/consistent with "strange cases".
  const pad = (str: string, len: number, char = 'Z') => str.padEnd(len, char).slice(0, len);

  const fWords = getWords(firstName);
  const lWords = getWords(lastName);

  let nameCode = '';

  if (fWords.length === 1 && lWords.length === 1) {
    // Case 1: 1 word each. Use current logic (3 chars each, padded with X as per original)
    // Original logic: const pad = (str: string) => str.padEnd(3, 'X').slice(0, 3);
    const padOriginal = (str: string) => str.padEnd(3, 'Z').slice(0, 3);
    nameCode = padOriginal(fWords[0]) + padOriginal(lWords[0]);
  } else if (fWords.length === 1 && lWords.length >= 2) {
    // Case 2: 1 first, 2+ last.
    // "se debe agregar las 2 primeras letras de cada palabra" -> First(2) + Last1(2) + Last2(2)
    const f1 = pad(fWords[0], 2);
    const l1 = pad(lWords[0], 2);
    const l2 = pad(lWords[1], 2);
    nameCode = f1 + l1 + l2;
  } else if (fWords.length >= 2 && lWords.length >= 2) {
    // Case 3: 2+ first, 2+ last.
    // First: 1st letter of first 2 words.
    // Last: 2st letters of first 2 words.
    const f1 = fWords[0].charAt(0) || 'Z';
    const f2 = fWords[1].charAt(0) || 'Z';
    const l1 = pad(lWords[0], 2);
    const l2 = pad(lWords[1], 2);
    nameCode = f1 + f2 + l1 + l2;
  } else {
    // Case 4: Strange case (e.g. fWords >= 2 && lWords == 1, or empty inputs)
    // "Agregar 'Z' si algun caso extraño se presenta"
    // We fall back to taking the first available words and padding with Z to ensure 6 chars.
    const f = fWords.length > 0 ? fWords[0] : 'Z';
    const l = lWords.length > 0 ? lWords[0] : 'Z';
    // If we have extra first name words but only 1 last name, maybe we should use them?
    // But to be safe and simple as a fallback:
    nameCode = pad(f, 3, 'Z') + pad(l, 3, 'Z');
  }

  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();

  return `${nameCode}${day}${month}${year}`;
}
serve(async (req) => {
  const origin = req.headers.get('origin');
  // Manejo de OPTIONS (CORS Preflight)
  if (req.method === 'OPTIONS') {
    const headers = corsHeaders(origin);
    return new Response(null, {
      status: 204,
      headers,
    });
  }
  const baseCors = corsHeaders(origin);
  let actorId = null;
  let newUserId = null;
  let payload;
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: baseCors,
      });
    }
    const ip =
      req.headers.get('x-forwarded-for') ??
      req.headers.get('x-real-ip') ??
      req.conn.remoteAddr?.hostname ??
      'unknown';
    const userAgent = req.headers.get('user-agent') ?? null;
    payload = await req.json();
    // Desestructurar el payload enviado desde el Cliente Angular
    const {
      email,
      password,
      firstName,
      lastName,
      authEmail,
      shopId,
      initialRoleNames = [],
    } = payload;
    // -----------------------------------------------------------
    // 1. VERIFICACIÓN DE PERMISOS (PASO CRÍTICO DE SEGURIDAD)
    // -----------------------------------------------------------
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('AUTH_REQUIRED: Missing Authorization token.');
    const token = authHeader.replace('Bearer ', '');
    // Obtener el ID del usuario logueado (el ACTOR que ejecuta la creación)
    const {
      data: { user: creatorUser },
      error: tokenError,
    } = await supabaseAdmin.auth.getUser(token);
    if (tokenError || !creatorUser) throw new Error('TOKEN_INVALID: Invalid or expired token.');
    actorId = creatorUser.id;
    // Llamada RPC para verificar si el actor tiene el rol 'creador'
    const { data: isCreator, error: roleCheckError } = await supabaseAdmin
      .schema('auth_management')
      .rpc('is_universal_manager', {
        user_id: actorId,
      });
    console.info(
      `Actor ID: ${actorId}, Is Creator: ${isCreator}, Role Check Error: ${roleCheckError}`,
    );
    if (roleCheckError || !isCreator) {
      // Loguear intento fallido por falta de permiso
      await supabaseAdmin
        .schema('core')
        .from('audit_logs')
        .insert([
          {
            action: 'create_user',
            actor_id: actorId,
            status: 'denied',
            ip,
            user_agent: userAgent,
            payload: {
              reason: 'No creator role',
              target_email: email,
            },
          },
        ]);
      return new Response(
        JSON.stringify({
          error: JSON.stringify(roleCheckError),
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...baseCors,
          },
        },
      );
    }
    // -----------------------------------------------------------
    // 2. CREACIÓN DEL USUARIO (Auth)
    // -----------------------------------------------------------
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });
    if (createError) {
      // Loguear fallo en la creación de Auth
      await supabaseAdmin
        .schema('core')
        .from('audit_logs')
        .insert([
          {
            action: 'create_user',
            actor_id: actorId,
            status: 'failed',
            ip,
            user_agent: userAgent,
            payload: {
              error: createError.message,
              provided: {
                email,
                firstName,
                lastName,
              },
            },
          },
        ]);
      return new Response(
        JSON.stringify({
          error: JSON.stringify(createError.message),
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...baseCors,
          },
        },
      );
    }
    newUserId = userData.user?.id ?? null;
    if (!newUserId) throw new Error('Could not retrieve new user ID.');
    // -----------------------------------------------------------
    // 3. CREACIÓN DE PERFILES EN DB (people y employees)
    // -----------------------------------------------------------
    let peopleCreated = false;
    let employeeCreated = false;
    let customerCreated = false;
    // Intentar crear People (Email personal/público)
    const { error: peopleErr } = await supabaseAdmin
      .schema('core')
      .from('persons')
      .insert([
        {
          id: newUserId,
          email: authEmail ?? email,
          first_name: firstName ?? null,
          last_name: lastName ?? null,
          person_type: 'NATURAL',
          created_by_id: actorId,
        },
      ]);
    if (peopleErr) {
      // Si falla la DB, lanzamos error para que se active la limpieza.
      throw new Error(`DB_PEOPLE_FAILED: ${peopleErr.message}`);
    }
    peopleCreated = true;
    // Intentar crear Employee
    const { error: employeeErr } = await supabaseAdmin
      .schema('hr')
      .from('employees')
      .insert([
        {
          id: newUserId,
          auth_email: email,
          shop_id: shopId ?? null,
          status_id: 1,
          created_by_id: actorId,
        },
      ]);
    if (employeeErr) {
      //   Si falla la DB, lanzamos error para que se active la limpieza.
      throw new Error(`DB_EMPLOYEE_FAILED: ${employeeErr.message}`);
    }
    employeeCreated = true;

    //Customer
    const { error: customerErr } = await supabaseAdmin
      .schema('sales')
      .from('customers')
      .insert([
        {
          id: newUserId,
          customer_code: generateCustomerCode(firstName, lastName),
          customer_type_code: 'IMPRENTERO_NUEVO',
          notes:
            // es un jsonb
            JSON.stringify({ created_via: 'Edge Function: create-employee' }),
          created_by_id: actorId,
        },
      ]);
    if (customerErr) {
      throw new Error(`DB_CUSTOMER_FAILED: ${customerErr.message}`);
    }
    customerCreated = true;
    // -----------------------------------------------------------
    // 4. ASIGNACIÓN DE ROLES (employee_roles)
    // -----------------------------------------------------------
    const roleAssignmentResults = [];
    if (initialRoleNames.length > 0) {
      console.log('Inicio de obtencion de roles');
      // 4.1 Obtener los IDs de los roles basados en los nombres
      const { data: rolesData, error: rolesErr } = await supabaseAdmin
        .schema('hr')
        .from('roles')
        .select('id')
        .in('name', initialRoleNames);
      if (rolesErr) {
        console.error('Error fetching roles by name:', rolesErr);
        roleAssignmentResults.push({
          status: 'partial_fail',
          error: `Failed to fetch roles: ${rolesErr.message}`,
        });
      } else if (rolesData && rolesData.length > 0) {
        // 4.2 Construir el array de inserción para la tabla intermedia
        // Esto mapea el array de IDs de rol a un array de objetos listos para la inserción multi-registro
        const roleInsertions = rolesData.map((role) => ({
          employee_id: newUserId,
          role_id: role.id,
        }));
        // 4.3 Insertar el array de registros en employee_roles
        console.log('RolesInsertions', roleInsertions);
        const { error: insertErr } = await supabaseAdmin
          .schema('hr')
          .from('employee_roles')
          .insert(roleInsertions);
        if (insertErr) {
          console.error('Error inserting employee_roles:', insertErr);
          roleAssignmentResults.push({
            status: 'partial_fail',
            error: `Failed to assign roles: ${insertErr.message}`,
          });
        } else {
          roleAssignmentResults.push({
            status: 'completed',
            roles_assigned: rolesData.map((role) => role.id),
          });
        }
      } else {
        // Ningún rol proporcionado en el payload fue encontrado en la DB.
        roleAssignmentResults.push({
          status: 'partial_fail',
          error: `No matching roles found for names: ${initialRoleNames.join(', ')}`,
        });
      }
    } else {
      roleAssignmentResults.push({
        status: 'skipped',
        message: 'No roles provided in payload.',
      });
    }
    const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(newUserId, {
      user_metadata: {
        ...userData.user.user_metadata, // Preservar metadatos existentes (first_name, last_name)
        roleAssignmentResults, // Agregar resultados de asignación de roles
      },
    });
    if (updateMetaError) {
      console.error('Error updating user metadata:', updateMetaError);
      // Opcional: Podrías loguear o manejar el error, pero no lanzamos excepción para no romper el flujo
    }

    // -----------------------------------------------------------
    // 5. FINALIZACIÓN Y AUDITORÍA
    // -----------------------------------------------------------
    await supabaseAdmin
      .schema('core')
      .from('audit_logs')
      .insert([
        {
          action: 'create_user',
          actor_id: actorId,
          target_id: newUserId,
          status: 'success',
          ip,
          user_agent: userAgent,
          payload: {
            email,
            first_name: firstName,
            last_name: lastName,
            roleAssignmentResults,
            customer_created: customerCreated, // Agregado: Indicar si se creó el customer
          },
        },
      ]);
    return new Response(
      JSON.stringify({
        user_id: newUserId,
        email: email,
        roleAssignmentResults,
        customer_created: customerCreated, // Agregado: Confirmar creación del customer
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          ...baseCors,
        },
      },
    );
  } catch (err) {
    const errorMsg = String(err);
    //  🚨 Lógica de Limpieza (Rollback): Si falla la DB, eliminamos el usuario de Auth.
    if (
      newUserId &&
      (errorMsg.includes('DB_PEOPLE_FAILED') ||
        errorMsg.includes('DB_EMPLOYEE_FAILED') ||
        errorMsg.includes('DB_CUSTOMER_FAILED')) // Agregado: Incluir DB_CUSTOMER_FAILED para rollback completo
    ) {
      await supabaseAdmin.auth.admin
        .deleteUser(newUserId)
        .catch((e) => console.error('Fallo la limpieza de Auth:', e));
    }
    // Loguear error general
    try {
      await supabaseAdmin
        .schema('core')
        .from('audit_logs')
        .insert([
          {
            action: 'create_user',
            actor_id: actorId,
            target_id: newUserId,
            status: 'failed',
            ip: 'unknown',
            user_agent: null,
            payload: {
              error: errorMsg,
              provided: payload,
            },
          },
        ]);
    } catch (_) {}
    // Determinar el código de estado basado en el error
    let status = 500;
    if (errorMsg.includes('AUTH_REQUIRED') || errorMsg.includes('TOKEN_INVALID')) status = 401;
    if (errorMsg.includes('PERMISSION_DENIED')) status = 403;
    return new Response(
      JSON.stringify({
        error: errorMsg.replace(/(\w+Error: )?/, ''),
      }),
      {
        status: status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      },
    );
  }
});
