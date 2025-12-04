// Construyendo mi Empleado Autenticado - Deno Deploy Service
//@ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2';
// @ts-ignore
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
// @ts-ignore
const SUPABASE_SERVICE_ROLE_KEY = '';
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
console.info('Empezando el servicio de creación de empleados autenticados...');
//--- Función Principal ---
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
          },
        },
      ]);
    return new Response(
      JSON.stringify({
        user_id: newUserId,
        email: email,
        roleAssignmentResults,
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
      (errorMsg.includes('DB_PEOPLE_FAILED') || errorMsg.includes('DB_EMPLOYEE_FAILED'))
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
