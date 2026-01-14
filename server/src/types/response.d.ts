export interface AuthTokensResponse {
  access: {
    token: string;
    expires: Date;
  };
}
