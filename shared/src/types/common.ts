export const VAT_RATE = 0.13;
export const DEFAULT_CURRENCY = 'NPR';
export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

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
