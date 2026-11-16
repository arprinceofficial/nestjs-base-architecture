export interface ApiResponse<T = any> {
    status: boolean;
    message: string;
    data?: T;
}

export interface PaginatedResult<T = any> {
    data: T[];
    total?: number;
    current_page?: number;
    per_page?: number;
    last_page?: number;
    permissions?: any;
}
