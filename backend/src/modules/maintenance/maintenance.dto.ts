export interface EnableMaintenanceDto {
  message?: string;
}

export interface UpdateMaintenanceMessageDto {
  message: string;
}

export interface IssueDeveloperTokenDto {
  apiKey: string;
}

export interface MaintenanceStatusDto {
  maintenanceEnabled: boolean;
  maintenanceMessage: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface MaintenanceAuditLogDto {
  id: string;
  action: string;
  developerId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  message: string | null;
  createdAt: string;
}

export interface IssueDeveloperTokenResponseDto {
  token: string;
  expiresInSeconds: number;
  scope: string;
}
