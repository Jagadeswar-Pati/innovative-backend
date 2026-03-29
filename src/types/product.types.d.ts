/**
 * TypeScript interfaces for Product API responses and queries.
 * Used for type safety in JSDoc and if the project is migrated to TypeScript.
 */

/** Lean product fields returned by the list endpoint for fast loading */
export interface ProductListItem {
  _id: string;
  name: string;
  price: number;
  thumbnail: string;
  rating: number;
  /** Included for frontend compatibility */
  sellingPrice?: number;
  shortDescription?: string;
  categories?: string[];
  images?: Array<{ url: string; publicId?: string }>;
  videos?: Array<{ url: string; publicId?: string }>;
  mrp?: number;
  gstMode?: string;
  gstPercentage?: number;
  stockQuantity?: number;
  sku?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Paginated products API response */
export interface ProductsListResponse {
  success: boolean;
  products: ProductListItem[];
  totalProducts: number;
  currentPage: number;
  totalPages: number;
  /** @deprecated Use products. Kept for frontend compatibility */
  data: ProductListItem[];
  /** @deprecated Use totalProducts. Kept for frontend compatibility */
  total: number;
}

/** Query params for GET /api/products */
export interface ProductsQueryParams {
  page?: number;
  limit?: number;
  skip?: number;
  category?: string;
  search?: string;
  sort?: 'newest' | 'price-low' | 'price-high' | 'name';
}
