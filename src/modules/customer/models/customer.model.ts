import { BaseModel } from '@/common/models/base.model';

/**
 * Customer Model.
 *
 * Encapsulates model-level behavior and hidden fields for the Customer domain.
 */
export class CustomerModel extends BaseModel {
    static override readonly hidden = [] as const;
}

export const sanitizeCustomer = (customer: any) =>
    CustomerModel.sanitize(customer);
export const sanitizeCustomers = (customers: any[]) =>
    CustomerModel.sanitizeMany(customers);
