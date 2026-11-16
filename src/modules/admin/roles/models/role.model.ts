import { BaseModel } from '@/common/models/base.model';

/**
 * Role Model.
 *
 * Encapsulates model-level behavior and hidden fields for the Role domain.
 */
export class RoleModel extends BaseModel {
    static override readonly hidden = [] as const;
}

export const sanitizeRole = (role: any) => RoleModel.sanitize(role);
export const sanitizeRoles = (roles: any[]) => RoleModel.sanitizeMany(roles);
