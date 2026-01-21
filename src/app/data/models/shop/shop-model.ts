export interface ShopModel {
  id?: string;
  name: string;
  address?: string | null;
  email?: string | null;
  mainPhone?: string | null;
  secondaryPhone?: string | null;
  companyData?: Record<string, CompanyData>;
  basicServiceProviders?: Record<string, BasicServiceProvider> | null;
  deletedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdById?: string | null;
  updatedById?: string | null;
  deletedById?: string | null;
}

interface CompanyData {
  legalName: string;
  ruc: string | null;
  address: string | null;
  bankAccount: string | null;
  cci: string | null;
  yape_primary: string | null;
  yape_secondary?: string | null;
  plin?: string | null;
}

interface BasicServiceProvider {
  company: string;
  service: string;
  utilityNumber: string;
  cutOffDate: string | null;
  description: string | null;
  status?: string | null;
}
