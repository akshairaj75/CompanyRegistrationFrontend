export interface CompanyRequest {
  companyName: string;
  registrationNumber: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  website: string;
  description: string;
  status: string;
  businessCard?: string;
}

export interface CompanyResponse {
  id: number;
  companyName: string;
  registrationNumber: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  website: string;
  description: string;
  status: string;
  businessCard?: string;
  createdAt?: string;
  updatedAt?: string;
}
