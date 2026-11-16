import { BaseModel } from '@/common/models/base.model';

/**
 * TreeEntity Model.
 *
 * Encapsulates model-level behavior and hidden fields for the TreeEntity domain.
 */
export class TreeEntityModel extends BaseModel {
    static override readonly hidden = [] as const;
}

export const sanitizeTreeEntity = (entity: any) => TreeEntityModel.sanitize(entity);
export const sanitizeTreeEntities = (entities: any[]) => TreeEntityModel.sanitizeMany(entities);
