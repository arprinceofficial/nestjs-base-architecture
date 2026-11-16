import { BaseModel } from '@/common/models/base.model';

/**
 * User Model.
 *
 * Encapsulates model-level behavior and hidden fields for the User domain.
 * Any field listed in `hidden` is excluded from API response serialization.
 */
export class UserModel extends BaseModel {
    static override readonly hidden = [
        'password',
        'auth_code',
        'otp_expires_at',
        'otp_for',
    ] as const;
}

export const sanitizeUser = (user: any) => UserModel.sanitize(user);
export const sanitizeUsers = (users: any[]) => UserModel.sanitizeMany(users);
