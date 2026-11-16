import { BaseModel } from '@/common/models/base.model';

/**
 * CMS Model.
 *
 * Encapsulates model-level behavior and hidden fields for the CMS domain.
 */
export class CmsModel extends BaseModel {
    static override readonly hidden = [] as const;
}

export const sanitizeCms = (item: any) => CmsModel.sanitize(item);
export const sanitizeCmsList = (items: any[]) => CmsModel.sanitizeMany(items);
