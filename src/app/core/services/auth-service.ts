import { inject, Injectable } from '@angular/core';
import { Supabase } from '@core/supabase/supabase';
import { SignUpWithPasswordCredentials } from '@supabase/supabase-js';
import {
  EdgeFunctionPayload,
  EdgeFunctionResponse,
} from '../../data/models/auth/edge-function.model';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';

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

    try {
      const response = await firstValueFrom(
        this.http.post<EdgeFunctionResponse>(this.edgeFunctionUrl, payload, {
          headers,
        }),
      );

      return response;
    } catch (httpError: unknown) {
      console.error('error real', httpError);
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

  async getUserProfileData() {
    const key = localStorage.key(0);
    const value = localStorage.getItem(key!);
    const session = value ? JSON.parse(value) : null;
    const { user_metadata } = session['user'];
    const response =
      user_metadata.first_name && user_metadata.last_name
        ? user_metadata.first_name + ' ' + user_metadata.last_name
        : 'SuperAdmin';
    const roles = user_metadata.roleAssignmentResults[0].roles_assigned;

    return {
      id: session['user'].id,
      name: response,
      email: session['user'].email,
      roles: roles,
    };
  }
}
