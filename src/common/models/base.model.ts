/**
 * Base Model Class.
 *
 * Provides a standardized foundation for all domain models.
 * Subclasses declare their own `hidden` fields array right inside their module.
 */
export abstract class BaseModel {
    /**
     * Array of sensitive field names to hide from API responses.
     */
    static readonly hidden: readonly string[] = [];

    /**
     * Strips hidden fields from a single model object.
     */
    static sanitize<T extends Record<string, any>>(
        this: typeof BaseModel,
        data: T | null | undefined,
    ): any {
        if (!data || typeof data !== 'object') return data;
        const copy = { ...data };
        for (const field of this.hidden) {
            delete (copy as any)[field];
        }
        return copy;
    }

    /**
     * Strips hidden fields from an array of model objects.
     */
    static sanitizeMany<T extends Record<string, any>>(
        this: typeof BaseModel,
        items: T[] | null | undefined,
    ): any[] {
        if (!Array.isArray(items)) return [];
        return items.map((item) => (this as any).sanitize(item));
    }
}
