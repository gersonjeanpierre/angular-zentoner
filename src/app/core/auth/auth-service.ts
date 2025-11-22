import { inject, Injectable } from '@angular/core';
import { Supabase } from '@core/supabase/supabase';
import { SignUpWithPasswordCredentials } from '@supabase/supabase-js';
import { EdgeFunctionPayload, EdgeFunctionResponse } from './models/edge-function.model';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment.development';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly authSupabase = inject(Supabase).client.auth;
  private readonly http = inject(HttpClient);
  private readonly edgeFunctionUrl = `${environment.SUPABASE_URL}/functions/v1/create-employee`;

  async createEmployee(payload: EdgeFunctionPayload): Promise<EdgeFunctionResponse> {
    const {
      data: { session },
      error,
    } = await this.getSession();
    if (error || !session) {
      throw new Error('Autenticación requerida.');
    }

    const token = session.access_token;
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Implementar try catch finally
    try {
      const response = await firstValueFrom(
        this.http.post<EdgeFunctionResponse>(this.edgeFunctionUrl, payload, {
          headers,
        }),
      );

      return response;
    } catch (httpError: unknown) {
      const serverError = { error: 'Error en la red o Edge function no disponible' };
      console.error(serverError);
      throw new Error(serverError.error || 'GENERIC');
    }
  }

  logIn(credentials: SignUpWithPasswordCredentials) {
    return this.authSupabase.signInWithPassword(credentials);
  }

  signOut() {
    return this.authSupabase.signOut();
  }
  getUser() {
    return this.authSupabase.getUser();
  }

  getSession() {
    return this.authSupabase.getSession();
  }
}
