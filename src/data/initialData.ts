import { 
  User, 
  InventoryItem, 
  TransactionTask, 
  InboundRecord, 
  ReturnRecord, 
  OrderRecord, 
  TransferRecord 
} from '../types';
import { initialInventoryFromTsv } from './inventoryData';

export const initialUsers: User[] = [
  {
    id: 'USR-001',
    username: 'admin',
    role: 'ADMIN',
    name: 'Admin Utama',
    email: 'admin@beautywms.id',
    avatar: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=150&auto=format&fit=crop&q=80',
    phone: '+62 811-2345-6789',
    lastLogin: '16/07/2026 09:12',
    password: 'admin123'
  },
  {
    id: 'USR-002',
    username: 'budi',
    role: 'PICKER',
    name: 'Budi Picker',
    email: 'budi.picker@beautywms.id',
    avatar: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150&auto=format&fit=crop&q=80',
    phone: '+62 822-3456-7890',
    lastLogin: '16/07/2026 10:05',
    password: 'budi123'
  },
  {
    id: 'USR-003',
    username: 'cici',
    role: 'PACKER',
    name: 'Cici Packer',
    email: 'cici.packer@beautywms.id',
    avatar: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=150&auto=format&fit=crop&q=80',
    phone: '+62 833-4567-8901',
    lastLogin: '16/07/2026 09:45',
    password: 'cici123'
  },
  {
    id: 'USR-004',
    username: 'deni',
    role: 'STAFF_WAREHOUSE',
    name: 'Deni Staff Gudang',
    email: 'deni.staff@beautywms.id',
    avatar: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=150&auto=format&fit=crop&q=80',
    phone: '+62 844-5678-9012',
    lastLogin: '16/07/2026 09:30',
    password: 'deni123'
  },
  {
    id: 'USR-005',
    username: 'rian',
    role: 'ADMIN',
    name: 'Rian Admin Gudang',
    email: 'rian.gudang@beautywms.id',
    avatar: 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=150&auto=format&fit=crop&q=80',
    phone: '+62 855-6789-0123',
    lastLogin: '16/07/2026 10:20',
    password: 'rian123'
  }
];

export const initialInventory: InventoryItem[] = initialInventoryFromTsv;

export const initialInbound: InboundRecord[] = [
  {
    id: 'INB-20260716-01',
    date: '16/07/2026',
    supplier: 'PT Cosmax Indonesia',
    status: 'RECEIVED',
    receivedBy: 'Admin Utama',
    createdAt: '2026-07-16T08:00:00Z',
    items: [
      {
        skuId: 'SKI121',
        skuName: 'Skintific Retinol Skin Renewal Serum',
        brand: 'Skintific',
        barcode: '810114871201',
        qty: 50,
        location: 'AC-02-01-01',
        expiredDate: '09/09/2029'
      },
      {
        skuId: 'ANU001',
        skuName: 'Anua Heartleaf 77% Soothing Toner 40Ml',
        brand: 'Anua',
        barcode: '8809640731792',
        qty: 30,
        location: 'AC-03-02-03',
        expiredDate: '19/11/2027'
      }
    ],
    notes: 'Kiriman rutin bulanan, kemasan karton luar utuh.'
  },
  {
    id: 'INB-20260716-02',
    date: '16/07/2026',
    supplier: 'Skintific Official Distributor',
    status: 'PENDING',
    receivedBy: '-',
    createdAt: '2026-07-16T10:15:00Z',
    items: [
      {
        skuId: 'SKI201',
        skuName: 'Skintific Radiance Boost Serum Spray',
        brand: 'Skintific',
        barcode: '4897147690739',
        qty: 100,
        location: 'AC-02-01-01',
        expiredDate: '22/12/2029'
      }
    ],
    notes: 'Urgent inbound untuk replenishment stok kritis.'
  }
];

export const initialReturns: ReturnRecord[] = [
  {
    id: 'RET-20260716-01',
    date: '16/07/2026',
    reason: 'DAMAGED',
    status: 'PENDING',
    returnFrom: 'Shopee Mall Beauty Store',
    processedBy: 'Admin Utama',
    createdAt: '2026-07-16T09:15:00Z',
    items: [
      {
        skuId: 'SOU026',
        skuName: 'Soulyu Fluffy Haze Lip Velvet - 06 Rum Raisin',
        brand: 'Soulyu',
        barcode: '710497670142',
        qty: 5,
        location: 'AC-06-02-04',
        condition: 'DAMAGED'
      }
    ],
    notes: 'Kemasan luar lip velvet retak/bocor saat ekspedisi.'
  }
];

export const initialOrders: OrderRecord[] = [
  {
    id: 'ORD-20260716-001',
    orderNumber: 'BEAUTY-20260716-001',
    date: '16/07/2026',
    customer: 'Toko Cantik Sehat Jakarta',
    status: 'NEW',
    shippingAddress: 'Jl. Jenderal Sudirman No. 45, Kebayoran Baru, Jakarta Selatan',
    processedBy: 'Admin Utama',
    createdAt: '2026-07-16T09:30:00Z',
    items: [
      {
        skuId: 'SKI121',
        skuName: 'Skintific Retinol Skin Renewal Serum',
        brand: 'Skintific',
        barcode: '810114871201',
        qty: 10,
        location: 'AC-02-01-01',
        expiredDate: '09/09/2029'
      },
      {
        skuId: 'AVO002',
        skuName: 'Avoskin Miraculous Refining Toner (100 Ml)',
        brand: 'Avoskin',
        barcode: '8997239323357',
        qty: 5,
        location: 'RK-03-02-01',
        expiredDate: '01/11/2027'
      }
    ],
    notes: 'Kirim via JNE Trucking.'
  },
  {
    id: 'ORD-20260715-999',
    orderNumber: 'BEAUTY-20260715-999',
    date: '15/07/2026',
    customer: 'Glow Skin Reseller Bandung',
    status: 'COMPLETED',
    shippingAddress: 'Jl. Dago No. 102, Coblong, Kota Bandung',
    processedBy: 'Admin Utama',
    createdAt: '2026-07-15T14:20:00Z',
    items: [
      {
        skuId: 'ANU001',
        skuName: 'Anua Heartleaf 77% Soothing Toner 40Ml',
        brand: 'Anua',
        barcode: '8809640731792',
        qty: 12,
        location: 'AC-03-02-03',
        expiredDate: '19/11/2027'
      }
    ],
    notes: 'Kemasan Bubble Wrap Tebal.'
  }
];

export const initialTasks: TransactionTask[] = [
  {
    id: 'TSK-20260716-001',
    type: 'OUTBOUND',
    orderNumber: 'BEAUTY-20260716-001',
    skuId: 'SKI121',
    skuName: 'Skintific Retinol Skin Renewal Serum',
    barcode: '810114871201',
    qty: 10,
    qtyHandled: 0,
    location: 'AC-02-01-01',
    warehouse: 'Gudang AC',
    status: 'PENDING',
    createdAt: '2026-07-16T09:30:00Z',
    customerOrSupplier: 'Toko Cantik Sehat Jakarta',
    operatorLogs: []
  },
  {
    id: 'TSK-20260716-002',
    type: 'OUTBOUND',
    orderNumber: 'BEAUTY-20260716-001',
    skuId: 'AVO002',
    skuName: 'Avoskin Miraculous Refining Toner (100 Ml)',
    barcode: '8997239323357',
    qty: 5,
    qtyHandled: 0,
    location: 'RK-03-02-01',
    warehouse: 'Gudang Rak',
    status: 'PENDING',
    createdAt: '2026-07-16T09:30:00Z',
    customerOrSupplier: 'Toko Cantik Sehat Jakarta',
    operatorLogs: []
  }
];

export const initialTransfers: TransferRecord[] = [
  {
    id: 'TRF-20260715-01',
    date: '15/07/2026',
    status: 'COMPLETED',
    transferBy: 'Admin Utama',
    createdAt: '2026-07-15T10:00:00Z',
    items: [
      {
        skuId: 'SKI121',
        skuName: 'Skintific Retinol Skin Renewal Serum',
        brand: 'Skintific',
        barcode: '810114871201',
        qty: 20,
        fromLocation: 'AC-02-01-01',
        toLocation: 'AC-02-02-01'
      }
    ],
    notes: 'Pemerataan penempatan stok untuk efisiensi pengambilan.'
  }
];

// Helper functions for LocalStorage management
export const getLocalStorageData = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
};

export const setLocalStorageData = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error setting localStorage key "${key}":`, error);
  }
};
