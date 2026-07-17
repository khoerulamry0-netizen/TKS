export type UserRole = 'ADMIN' | 'PICKER' | 'PACKER' | 'STAFF_WAREHOUSE';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
  email: string;
  avatar: string;
  phone: string;
  lastLogin: string;
  password?: string;
}

export interface InventoryItem {
  id: string;
  brand: string;
  barcode: string;
  skuId: string;
  skuName: string;
  expiredDate: string; // formatted DD/MM/YYYY
  location: string;    // e.g. AC-02-01-01
  warehouse: 'Gudang AC' | 'Gudang Utama' | 'Gudang Rak';
  qty: number;
  lowStockThreshold: number;
  notes?: string;
  batchNumber?: string; // e.g. BCH-SKI121-104
}

export type TaskType = 'INBOUND' | 'OUTBOUND' | 'RETURN';
export type TaskStatus = 'PENDING' | 'PICKING' | 'CHECKING' | 'COMPLETED';
export type InboundStatus = 'PENDING' | 'RECEIVED' | 'CHECKED' | 'COMPLETED';

export interface TransactionTask {
  id: string;
  type: TaskType;
  orderNumber?: string;
  skuId: string;
  skuName: string;
  barcode: string;
  qty: number;
  qtyHandled: number; // picked or loaded amount
  location: string;
  warehouse: 'Gudang AC' | 'Gudang Utama' | 'Gudang Rak';
  status: TaskStatus;
  assignedPickerId?: string;
  assignedPackerId?: string;
  boxNumber?: string;
  expiredDate?: string;
  createdAt: string;
  completedAt?: string;
  customerOrSupplier?: string;
  operatorLogs: {
    role: UserRole;
    operatorName: string;
    action: string;
    timestamp: string;
  }[];
}

export interface InboundRecord {
  id: string;
  date: string;
  supplier: string;
  items: {
    skuId: string;
    skuName: string;
    brand: string;
    barcode: string;
    qty: number;
    location: string;
    expiredDate: string;
    batchNumber?: string;
  }[];
  status: InboundStatus;
  receivedBy: string;
  notes?: string;
  createdAt: string;
  completedAt?: string;
}

export interface StockOpnameDetail {
  skuId: string;
  skuName: string;
  barcode: string;
  systemQty: number;
  actualQty: number;
  discrepancy: number;
}

export type ReturnStatus = 'PENDING' | 'INSPECTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
export type ReturnReason = 'EXPIRED' | 'DAMAGED' | 'WRONG_ITEM' | 'QUALITY_ISSUE' | 'OTHER';

export interface ReturnRecord {
  id: string;
  date: string;
  reason: ReturnReason;
  items: {
    skuId: string;
    skuName: string;
    brand: string;
    barcode: string;
    qty: number;
    location: string;
    condition: 'GOOD' | 'DAMAGED' | 'EXPIRED';
  }[];
  status: ReturnStatus;
  returnFrom: string;
  processedBy: string;
  notes?: string;
  createdAt: string;
}

export interface StockOpnameSession {
  id: string;
  warehouse: 'Gudang AC' | 'Gudang Utama' | 'Gudang Rak' | 'SEMUA';
  locationFilter?: string; // e.g. AC-02
  brandFilter?: string;    // filter by brand
  skuFilter?: string;      // filter by SKU ID
  date: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
  createdBy: string;
  assignedUserId?: string;
  assignedUserName?: string;
  details: StockOpnameDetail[];
}

export type OrderStatus = 'NEW' | 'PROCESSING' | 'PICKING' | 'PACKED' | 'SHIPPED' | 'COMPLETED';

export interface OrderRecord {
  id: string;
  orderNumber: string;
  date: string;
  customer: string;
  items: {
    skuId: string;
    skuName: string;
    brand: string;
    barcode?: string;
    qty: number;
    location: string;
    expiredDate?: string;
    batchNumber?: string;
    boxNumber?: string;
  }[];
  status: OrderStatus;
  shippingAddress: string;
  processedBy: string;
  notes?: string;
  createdAt: string;
}

export interface MonthlyReport {
  month: string; // e.g. "2026-07"
  totalInbound: number;
  totalOutbound: number;
  totalReturn: number;
  topMovingSku: { skuName: string; qty: number }[];
}

export interface ExternalAPILog {
  id: string;
  endpoint: string;
  method: 'GET' | 'POST';
  status: number;
  timestamp: string;
  payload: string;
}

export type TransferStatus = 'PENDING' | 'IN_TRANSIT' | 'COMPLETED';

export interface TransferRecord {
  id: string;
  date: string;
  items: {
    skuId: string;
    skuName: string;
    brand: string;
    barcode: string;
    qty: number;
    fromLocation: string;
    toLocation: string;
  }[];
  status: TransferStatus;
  transferBy: string;
  notes?: string;
  createdAt: string;
}

export type MenuType = 'DASHBOARD' | 'STOK_BARANG' | 'INBOUND' | 'RETURN' | 'INPUT_ORDER' | 'PROSES_PICKING' | 'PROSES_PACKING' | 'HISTORY_ORDER' | 'TRANSFER_STOK' | 'AKUN' | 'GOOGLE_WORKSPACE';
