export type SuccessResponse<T> = {
  code: number;
  status: 'success';
  message: string;
  data: T;
};

export type ErrorResponse = {
  code: number;
  status: 'error';
  message: string;
  detail?: unknown;
};

export type ResponseType<T> = SuccessResponse<T> | ErrorResponse;
