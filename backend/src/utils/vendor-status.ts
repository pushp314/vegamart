/**
 * Vendor Status Utilities
 * Centralized vendor status checks and constants
 */

export const VENDOR_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
} as const;

export const KYC_STATUS = {
  NOT_SUBMITTED: 'not_submitted',
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
} as const;

export type VendorStatus = typeof VENDOR_STATUS[keyof typeof VENDOR_STATUS];
export type KycStatus = typeof KYC_STATUS[keyof typeof KYC_STATUS];

/**
 * Check if vendor is approved and can access dashboard
 */
export const isVendorApproved = (vendorStatus: string, kycStatus?: string): boolean => {
  const normalizedVendorStatus = vendorStatus?.toLowerCase() || '';
  const normalizedKycStatus = kycStatus?.toLowerCase() || '';
  
  return normalizedVendorStatus === VENDOR_STATUS.APPROVED || 
         normalizedKycStatus === KYC_STATUS.VERIFIED;
};

/**
 * Check if vendor is suspended
 */
export const isVendorSuspended = (vendorStatus: string): boolean => {
  return vendorStatus?.toLowerCase() === VENDOR_STATUS.SUSPENDED;
};

/**
 * Check if vendor is rejected
 */
export const isVendorRejected = (vendorStatus: string): boolean => {
  return vendorStatus?.toLowerCase() === VENDOR_STATUS.REJECTED;
};

/**
 * Check if vendor KYC is pending
 */
export const isKycPending = (kycStatus: string): boolean => {
  return kycStatus?.toLowerCase() === KYC_STATUS.PENDING;
};

/**
 * Get human-readable status label
 */
export const getVendorStatusLabel = (status: string): string => {
  const normalized = status?.toLowerCase() || '';
  switch (normalized) {
    case VENDOR_STATUS.APPROVED:
      return 'Approved';
    case VENDOR_STATUS.PENDING:
      return 'Pending';
    case VENDOR_STATUS.REJECTED:
      return 'Rejected';
    case VENDOR_STATUS.SUSPENDED:
      return 'Suspended';
    default:
      return 'Unknown';
  }
};
