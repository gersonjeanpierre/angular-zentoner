import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root',
})
export class Supabase {
  private readonly supabaseClient: SupabaseClient;

  constructor() {
    if (!environment.SUPABASE_URL || !environment.SUPABASE_ANON_KEY) {
      throw new Error('Las claves de Supabase no están definidas en las variables de entorno.');
    }
    this.supabaseClient = createClient(environment.SUPABASE_URL, environment.SUPABASE_ANON_KEY);
  }

  get client(): SupabaseClient {
    return this.supabaseClient;
  }
}
