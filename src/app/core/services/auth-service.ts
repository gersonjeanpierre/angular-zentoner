import { computed, inject, Injectable } from '@angular/core';
import { Supabase } from '@core/supabase/supabase';
import { SignUpWithPasswordCredentials } from '@supabase/supabase-js';
import {
  EdgeFunctionPayload,
  EdgeFunctionResponse,
} from '../../data/models/auth/edge-function.model';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ShopService } from './shop-service';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  //Services
  private readonly authSupabase = inject(Supabase).client.auth;
  private readonly supabase = inject(Supabase).client;
  private readonly shopsService = inject(ShopService);

  protected readonly shops = toSignal(this.shopsService.dataShops$, { initialValue: [] });

  protected readonly availableShops = computed(() => {
    const result = this.shops();
    return (result ?? [])
      .filter((shop) => shop.id)
      .map((shop) => ({
        id: shop.id,
        name: shop.name,
      }));
  });

  // HttpClient for Edge Functions
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

  updateMetadata(metadata: { [key: string]: any }) {
    return this.authSupabase.updateUser({ data: metadata });
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
    // console.log('metadata', session);
    return {
      id: session['user'].id,
      name: response,
      email: session['user'].email,
      roles: roles,
      shopName: this.availableShops().filter((shop) => shop.id === user_metadata.shopId)[0]?.name,
      shopId: user_metadata.shopId,
      role_id: user_metadata.roleId || null,
    };
  }

  async getShopIdByUser() {
    const metadata = await this.getUserProfileData();
    return metadata.shopId;
  }

  async getUserRoles() {
    const metadata = await this.getUserProfileData();
    return metadata.roles;
  }
}
