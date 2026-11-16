/**
 * Model Hidden Fields Configuration.
 *
 * Define any model name and the array of sensitive fields you want to automatically
 * exclude whenever records are serialized or returned in API responses.
 */
export const MODEL_HIDDEN = {
    user: [
        'password',
        'auth_code',
        'otp_expires_at',
        'otp_for',
    ] as const,
};

export type ModelName = keyof typeof MODEL_HIDDEN;

/**
 * Strips hidden fields from a single model object or an array of objects.
 */
export function sanitizeModel<T extends Record<string, any>>(
    modelName: ModelName,
    data: T | T[] | null | undefined,
): any {
    if (!data) return data;

    const hiddenFields = MODEL_HIDDEN[modelName] || [];

    const sanitizeSingle = (item: any) => {
        if (!item || typeof item !== 'object') return item;
        const copy = { ...item };
        for (const field of hiddenFields) {
            delete copy[field];
        }
        return copy;
    };

    if (Array.isArray(data)) {
        return data.map(sanitizeSingle);
    }

    return sanitizeSingle(data);
}

/**
 * Convenience helper to sanitize User objects.
 */
export function sanitizeUser<T extends Record<string, any>>(
    user: T | T[] | null | undefined,
): any {
    return sanitizeModel('user', user);
}
