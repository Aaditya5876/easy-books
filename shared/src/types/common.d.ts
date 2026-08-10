export declare const VAT_RATE = 0.13;
export declare const DEFAULT_CURRENCY = "NPR";
export declare const API_VERSION = "v1";
export declare const API_PREFIX = "/api/v1";
export type PaginatedResponse<T> = {
    data: T[];
    total: number;
    page: number;
    limit: number;
};
export type ApiResponse<T> = {
    success: boolean;
    data: T;
    message?: string;
};
