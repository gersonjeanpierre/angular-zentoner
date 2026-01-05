export interface EdgeFunctionPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  authEmail: string;
  initialRoleNames: string[];
}

export interface EdgeFunctionResponse {
  success: boolean;
  user_id: string;
}

export interface RoleModel {
  id: string;
  name: string;
}
