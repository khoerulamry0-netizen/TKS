import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { 
  Search, 
  Filter, 
  Plus, 
  Edit3, 
  Trash2, 
  ClipboardCheck, 
  Calendar, 
  Tag, 
  CheckCircle, 
  X, 
  AlertCircle,
  Warehouse,
  BarChart3,
  Download,
  Upload,
  FileSpreadsheet,
  MapPin,
  UserCheck,
  ClipboardList,
  CheckCircle2,
  Sparkles,
  Camera,
  ArrowLeft,
  Users
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { InventoryItem, User, StockOpnameSession, StockOpnameDetail, TransactionTask } from '../types';
import { downloadInventoryTemplate } from '../utils/excelTemplates';
import CameraScanner from './CameraScanner';

export function getExpiredStatus(expiredDateStr: string): 'expired' | 'under <18bln' | 'aman' {
  if (!expiredDateStr) return 'aman';
  
  // Format DD/MM/YYYY
  const parts = expiredDateStr.split('/');
  if (parts.length !== 3) return 'aman';
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed month
  let year = parseInt(parts[2], 10);
  if (parts[2].length === 2) {
    year += 2000;
  }
  
  const expDate = new Date(year, month, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expDate.setHours(0, 0, 0, 0);
  
  if (expDate < today) {
    return 'expired';
  }
  
  const diffMonths = (expDate.getFullYear() - today.getFullYear()) * 12 + (expDate.getMonth() - today.getMonth());
  if (diffMonths < 18) {
    return 'under <18bln';
  }
  
  return 'aman';
}

interface InventoryViewProps {
  inventory: InventoryItem[];
  currentUser: User;
  onAddItem: (item: InventoryItem) => void;
  onImportItems?: (items: InventoryItem[]) => void;
  onUpdateItem: (updated: InventoryItem) => void;
  onDeleteItem: (id: string) => void;
  onClearInventory?: () => void;
  onSaveOpname: (session: StockOpnameSession) => void;
  tasks?: TransactionTask[];
  allUsers?: User[];
  onAddTask?: (task: TransactionTask) => void;
  onUpdateTask?: (task: TransactionTask) => void;
  onUpdateInventory?: (updated: InventoryItem[]) => void;
}

export default function InventoryView({
  inventory,
  currentUser,
  onAddItem,
  onImportItems,
  onUpdateItem,
  onDeleteItem,
  onClearInventory,
  onSaveOpname,
  tasks = [],
  allUsers = [],
  onAddTask,
  onUpdateTask,
  onUpdateInventory,
}: InventoryViewProps) {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('SEMUA');
  const [selectedBrand, setSelectedBrand] = useState<string>('SEMUA');
  const [selectedStatus, setSelectedStatus] = useState<string>('SEMUA');
  const [selectedLocation, setSelectedLocation] = useState<string>('SEMUA');
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showOpnameModal, setShowOpnameModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sub-tab Navigation
  const [activeTab, setActiveTab] = useState<'STOK' | 'PENUGASAN'>('STOK');

  // Stock Opname Assignment States
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignWarehouse, setAssignWarehouse] = useState<'Gudang AC' | 'Gudang Utama' | 'Gudang Rak' | 'SEMUA'>('SEMUA');
  const [assignBrand, setAssignBrand] = useState('SEMUA');
  const [assignSku, setAssignSku] = useState('SEMUA');
  const [assignLocation, setAssignLocation] = useState('');
  const [assignNotes, setAssignNotes] = useState('');

  // Stock Opname Active Execution States
  const [activeExecutionAssignment, setActiveExecutionAssignment] = useState<TransactionTask | null>(null);
  const [executionCounts, setExecutionCounts] = useState<Record<string, number>>({});
  const [showExecutionScanner, setShowExecutionScanner] = useState(false);

  // Form states
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  
  // New Item Form
  const [newSkuId, setNewSkuId] = useState('');
  const [newSkuName, setNewSkuName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newExpiredDate, setNewExpiredDate] = useState('2028-12-31');
  const [newLocation, setNewLocation] = useState('');
  const [newWarehouse, setNewWarehouse] = useState<'Gudang AC' | 'Gudang Utama' | 'Gudang Rak'>('Gudang Utama');
  const [newQty, setNewQty] = useState(100);
  const [newThreshold, setNewThreshold] = useState(20);
  const [newNotes, setNewNotes] = useState('');

  // Stock Opname Form
  const [opnameActualQty, setOpnameActualQty] = useState<number>(0);
  const [opnameNotes, setOpnameNotes] = useState('');

  // Extract all brands for filter
  const brands = Array.from(new Set(inventory.map(item => item.brand)));

  // Extract all unique locations for rack filter
  const locations = Array.from(new Set(inventory.map(item => item.location).filter(Boolean).map(loc => loc.trim()))).sort();

  // Filtered Inventory
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = 
      item.skuName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.skuId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.barcode.includes(searchTerm) ||
      item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesWarehouse = selectedWarehouse === 'SEMUA' || item.warehouse === selectedWarehouse;
    const matchesBrand = selectedBrand === 'SEMUA' || item.brand === selectedBrand;
    const matchesLowStock = !showOnlyLowStock || (item.qty <= item.lowStockThreshold);
    const matchesStatus = selectedStatus === 'SEMUA' || getExpiredStatus(item.expiredDate) === selectedStatus;
    const matchesLocation = selectedLocation === 'SEMUA' || (item.location || '').trim() === selectedLocation;

    return matchesSearch && matchesWarehouse && matchesBrand && matchesLowStock && matchesStatus && matchesLocation;
  });

  // Handle Add Submit
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'ADMIN') return;

    // Convert date YYYY-MM-DD to DD/MM/YYYY
    const dateParts = newExpiredDate.split('-');
    const formattedDate = dateParts.length === 3 
      ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` 
      : '31/12/2028';

    const newItem: InventoryItem = {
      id: `STK-${Date.now()}`,
      skuId: newSkuId.toUpperCase().trim(),
      skuName: newSkuName.trim(),
      brand: newBrand.trim(),
      barcode: newBarcode.trim() || String(Math.floor(Math.random() * 9000000000000) + 1000000000000),
      expiredDate: formattedDate,
      location: newLocation.toUpperCase().trim(),
      warehouse: newWarehouse,
      qty: Number(newQty),
      lowStockThreshold: Number(newThreshold),
      notes: newNotes.trim() || undefined
    };

    onAddItem(newItem);
    setShowAddModal(false);
    resetAddForm();
  };

  const resetAddForm = () => {
    setNewSkuId('');
    setNewSkuName('');
    setNewBrand('');
    setNewBarcode('');
    setNewExpiredDate('2028-12-31');
    setNewLocation('');
    setNewWarehouse('Gudang Utama');
    setNewQty(100);
    setNewThreshold(20);
    setNewNotes('');
  };

  // Handle Edit Submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || currentUser.role !== 'ADMIN') return;

    onUpdateItem(selectedItem);
    setShowEditModal(false);
  };

  // Handle Stock Opname Execution
  const handleOpnameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const systemQty = selectedItem.qty;
    const discrepancy = opnameActualQty - systemQty;

    const opnameDetail: StockOpnameDetail = {
      skuId: selectedItem.skuId,
      skuName: selectedItem.skuName,
      barcode: selectedItem.barcode,
      systemQty: systemQty,
      actualQty: opnameActualQty,
      discrepancy: discrepancy
    };

    const session: StockOpnameSession = {
      id: `OPN-${Date.now()}`,
      warehouse: selectedItem.warehouse,
      locationFilter: selectedItem.location.slice(0, 5),
      date: new Date().toLocaleDateString('id-ID'),
      status: 'COMPLETED',
      createdBy: currentUser.name,
      details: [opnameDetail]
    };

    // Update the item quantity directly in system
    const updatedItem = {
      ...selectedItem,
      qty: opnameActualQty,
      notes: opnameNotes ? `${selectedItem.notes || ''} [Opname ${session.date}: ${opnameNotes}]`.trim() : selectedItem.notes
    };

    onUpdateItem(updatedItem);
    onSaveOpname(session);
    setShowOpnameModal(false);
    setOpnameNotes('');
  };

  // CREATE PENUGASAN STOCK OPNAME
  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddTask) {
      toast.error('Gagal membuat penugasan: handler tidak tersedia.');
      return;
    }
    if (!assignUserId) {
      toast.error('Pilih petugas terlebih dahulu.');
      return;
    }

    const assignedUser = allUsers.find(u => u.id === assignUserId || u.username === assignUserId);
    const assignedName = assignedUser ? assignedUser.name : assignUserId;

    const opnameTask: TransactionTask = {
      id: `OPN-${Date.now().toString().slice(-6)}`,
      type: 'INBOUND', // using INBOUND operational flow or general task categorization
      skuId: assignSku,
      skuName: assignBrand,
      barcode: assignNotes || 'Audit Stok Opname',
      qty: 0,
      qtyHandled: 0,
      location: assignLocation.trim().toUpperCase() || 'SEMUA',
      warehouse: assignWarehouse === 'SEMUA' ? 'Gudang Utama' : assignWarehouse as any,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      orderNumber: assignUserId, // store assignee
      operatorLogs: [{
        role: currentUser.role,
        operatorName: currentUser.name,
        action: `Membuat penugasan opname untuk ${assignedName}. Filter - Gudang: ${assignWarehouse}, Brand: ${assignBrand}, SKU: ${assignSku}, Lokasi: ${assignLocation || 'SEMUA'}.`,
        timestamp: new Date().toISOString()
      }]
    };

    // Specifically tag the task type as 'OPNAME_ASSIGNMENT' in the barcode/description context
    (opnameTask as any).isOpname = true;

    onAddTask(opnameTask);
    toast.success(`Penugasan Opname berhasil dibuat untuk ${assignedName}!`);
    setShowAssignModal(false);
    
    // reset form
    setAssignUserId('');
    setAssignWarehouse('SEMUA');
    setAssignBrand('SEMUA');
    setAssignSku('SEMUA');
    setAssignLocation('');
    setAssignNotes('');
  };

  // EXECUTE PENUGASAN OPNAME
  const handleStartExecution = (task: TransactionTask) => {
    // Find all matching items in inventory
    const matchingItems = inventory.filter(item => {
      const matchesWarehouse = (task.warehouse as any) === 'SEMUA' || item.warehouse === task.warehouse;
      const matchesBrand = task.skuName === 'SEMUA' || item.brand === task.skuName;
      const matchesSku = task.skuId === 'SEMUA' || item.skuId === task.skuId;
      const matchesLocation = task.location === 'SEMUA' || item.location.toUpperCase().includes(task.location.toUpperCase());
      return matchesWarehouse && matchesBrand && matchesSku && matchesLocation;
    });

    if (matchingItems.length === 0) {
      toast.error('Tidak ada barang di inventory yang cocok dengan kriteria filter tugas opname ini.');
      return;
    }

    // Initialize counts with 0 (or empty/undefined to prevent user bias)
    const counts: Record<string, number> = {};
    matchingItems.forEach(item => {
      counts[item.id] = 0; // standard default
    });

    setExecutionCounts(counts);
    setActiveExecutionAssignment(task);
  };

  // COMPLETE OPNAME EXECUTION
  const handleCompleteExecution = () => {
    if (!activeExecutionAssignment || !onUpdateTask || !onUpdateInventory) return;

    // Build the list of updated inventory items
    const updatedInventory = inventory.map(item => {
      const isTracked = item.id in executionCounts;
      if (isTracked) {
        const actualCount = executionCounts[item.id];
        const discrepancy = actualCount - item.qty;
        
        return {
          ...item,
          qty: actualCount,
          notes: `[Opname ${new Date().toLocaleDateString('id-ID')}: ${actualCount} pcs, Selisih: ${discrepancy > 0 ? '+' : ''}${discrepancy} pcs] ${item.notes || ''}`.trim()
        };
      }
      return item;
    });

    // Generate details for logging
    const matchingItems = inventory.filter(item => item.id in executionCounts);
    const logDetails = matchingItems.map(item => {
      const actualCount = executionCounts[item.id];
      const discrepancy = actualCount - item.qty;
      return `${item.skuId} (${item.location}): ${actualCount} pcs (Selisih: ${discrepancy > 0 ? '+' : ''}${discrepancy})`;
    }).join(', ');

    const updatedTask: TransactionTask = {
      ...activeExecutionAssignment,
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      operatorLogs: [
        ...activeExecutionAssignment.operatorLogs,
        {
          role: currentUser.role,
          operatorName: currentUser.name,
          action: `Audit fisik diselesaikan. Hasil audit: ${logDetails}`,
          timestamp: new Date().toISOString()
        }
      ]
    };

    onUpdateInventory(updatedInventory);
    onUpdateTask(updatedTask);
    
    toast.success('Hasil Audit Opname berhasil diverifikasi dan stok diupdate!');
    setActiveExecutionAssignment(null);
    setExecutionCounts({});
  };

  // EXPORT TO EXCEL
  const handleExportExcel = () => {
    try {
      const dataToExport = filteredInventory.map(item => ({
        'brand': item.brand,
        'barcode': item.barcode,
        'sku id': item.skuId,
        'sku name': item.skuName,
        'Expired date': item.expiredDate,
        'status': getExpiredStatus(item.expiredDate),
        'location': item.location,
        'qty': item.qty
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Stok Barang');
      XLSX.writeFile(workbook, `WMS_Beauty_Katalog_Stok_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
      toast.error('Gagal mengekspor data ke Excel.');
    }
  };

  // PROCESS IMPORTED DATA ROWS
  const processImportData = (rows: any[]) => {
    try {
      const getValueByFlexibleKeys = (row: any, fallbackNames: string[]): string => {
        for (const fallback of fallbackNames) {
          const exactMatch = Object.keys(row).find(
            k => k.trim().toLowerCase() === fallback.toLowerCase()
          );
          if (exactMatch !== undefined) {
            return (row[exactMatch] ?? '').toString().trim();
          }
        }

        const normalize = (str: string) => str.toLowerCase().replace(/[\s_\-\.]/g, '');
        const normalizedFallbacks = fallbackNames.map(normalize);

        const matchedKey = Object.keys(row).find(k => {
          const normK = normalize(k);
          return normalizedFallbacks.some(f => normK === f || normK.includes(f) || f.includes(normK));
        });

        if (matchedKey !== undefined) {
          return (row[matchedKey] ?? '').toString().trim();
        }

        return '';
      };

      const importedItems: InventoryItem[] = [];
      let count = 0;

      rows.forEach((row, index) => {
        const brand = getValueByFlexibleKeys(row, ['brand', 'merek', 'merk', 'manufacturer', 'vendor']);
        const barcode = getValueByFlexibleKeys(row, ['barcode', 'bar code', 'upc', 'ean', 'kode barcode', 'kode bar']);
        const skuId = getValueByFlexibleKeys(row, ['sku id', 'sku_id', 'sku', 'kode sku', 'id sku', 'kode barang', 'kode produk', 'no sku', 'sku code', 'product code', 'item code', 'item id', 'product id']);
        const skuName = getValueByFlexibleKeys(row, ['sku name', 'sku_name', 'name', 'product name', 'item name', 'product', 'item', 'nama sku', 'nama produk', 'nama barang', 'nama']);
        const expiredDateRaw = getValueByFlexibleKeys(row, ['expired date', 'expiry date', 'exp date', 'expired', 'expiry', 'tanggal kedaluwarsa', 'tgl kedaluwarsa', 'kedaluwarsa', 'tgl exp', 'tanggal exp', 'exp']);
        const location = getValueByFlexibleKeys(row, ['location', 'loc', 'bin', 'rack', 'shelf', 'lokasi', 'rak', 'posisi']);
        const qtyStr = getValueByFlexibleKeys(row, ['qty', 'quantity', 'count', 'stock', 'amount', 'jumlah', 'stok', 'kuantitas']) || '0';

        if (!skuId || !skuName) return;

        // Auto-assign warehouse based on location prefix
        let warehouse: 'Gudang AC' | 'Gudang Utama' | 'Gudang Rak' = 'Gudang Utama';
        const locUpper = location.toUpperCase();
        if (locUpper.startsWith('AC-')) {
          warehouse = 'Gudang AC';
        } else if (locUpper.startsWith('RK-')) {
          warehouse = 'Gudang Rak';
        } else if (locUpper.startsWith('FL-')) {
          warehouse = 'Gudang Utama';
        }

        // Clean expired date format
        let expiredDate = expiredDateRaw;
        if (!expiredDate) {
          expiredDate = '31/12/2028';
        } else {
          const parts = expiredDate.split('/');
          if (parts.length === 3) {
            const dd = parts[0].padStart(2, '0');
            const mm = parts[1].padStart(2, '0');
            let yyyy = parts[2].trim();
            if (yyyy.length === 2) yyyy = '20' + yyyy;
            expiredDate = `${dd}/${mm}/${yyyy}`;
          } else if (parts.length === 2) {
            const dd = parts[0].padStart(2, '0');
            const mm = parts[1].padStart(2, '0');
            expiredDate = `${dd}/${mm}/2028`;
          }
        }

        // Clean quantity thousands dots
        let cleanQtyStr = qtyStr.replace(/,/g, '');
        if (cleanQtyStr.includes('.') && cleanQtyStr.split('.')[1]?.length === 3) {
          cleanQtyStr = cleanQtyStr.replace(/\./g, '');
        }
        const qty = Math.max(0, parseInt(cleanQtyStr) || 0);

        importedItems.push({
          id: `STK-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
          brand: brand || 'Tanpa Merek',
          barcode: barcode || String(Math.floor(Math.random() * 9000000000000) + 1000000000000),
          skuId: skuId.toUpperCase(),
          skuName: skuName,
          expiredDate: expiredDate,
          location: location || 'UT-01-01-01',
          warehouse: warehouse,
          qty: qty,
          lowStockThreshold: 20
        });
        count++;
      });

      if (importedItems.length > 0) {
        if (onImportItems) {
          onImportItems(importedItems);
        } else {
          importedItems.forEach(item => onAddItem(item));
        }
        toast.success(`Berhasil mengimpor ${count} produk ke dalam sistem.`);
        setShowImportModal(false);
        setPastedText('');
      } else {
        toast.error('Tidak ada baris data valid yang terdeteksi.');
      }
    } catch (err) {
      toast.error('Terjadi kesalahan saat memproses data impor.');
    }
  };

  // UPLOAD FILE HANDLER
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

        processImportData(jsonData);
      } catch (err) {
        toast.error('Gagal membaca file Excel. Pastikan file berformat .xlsx, .xls, atau .csv');
      }
    };
    reader.readAsArrayBuffer(file);
    if (e.target) e.target.value = ''; // Reset input element
  };

  // TSV TEXT PASTE HANDLER
  const handlePasteImport = () => {
    if (!pastedText.trim()) {
      toast.error('Tempelkan teks data terlebih dahulu.');
      return;
    }

    const lines = pastedText.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 1) {
      toast.error('Data kurang lengkap.');
      return;
    }

    // Help detect separator
    const getCols = (line: string): string[] => {
      if (line.includes('\t')) {
        return line.split('\t').map(c => c.trim().replace(/"/g, ''));
      }
      if (line.includes(';')) {
        return line.split(';').map(c => c.trim().replace(/"/g, ''));
      }
      if (line.includes(',')) {
        return line.split(',').map(c => c.trim().replace(/"/g, ''));
      }
      if (/\s{2,}/.test(line)) {
        return line.split(/\s{2,}/).map(c => c.trim().replace(/"/g, ''));
      }
      return [line];
    };

    // Check if the first line is a header row
    const firstCols = getCols(lines[0]);
    
    const isHeaderRow = (cols: string[]): boolean => {
      const headerKeywords = [
        'brand', 'merek', 'merk', 'manufacturer', 'vendor',
        'barcode', 'bar code', 'upc', 'ean', 'kode barcode', 'kode bar',
        'sku id', 'sku_id', 'sku', 'kode sku', 'id sku', 'kode barang', 'kode produk',
        'sku name', 'sku_name', 'product name', 'item name', 'nama sku', 'nama produk',
        'expired date', 'expiry date', 'exp date', 'expired', 'expiry', 'tanggal kedaluwarsa',
        'location', 'loc', 'bin', 'rack', 'shelf', 'lokasi', 'rak',
        'qty', 'quantity', 'count', 'stock', 'amount', 'jumlah', 'stok'
      ];
      
      return cols.some(col => {
        const val = col.toLowerCase().trim();
        return headerKeywords.some(kw => val === kw || val.includes(kw));
      });
    };

    const isDataRow = (cols: string[]): boolean => {
      // Check if any column is a barcode (8+ digits)
      const hasBarcode = cols.some(c => /^\d{8,20}$/.test(c));
      // Check if any column is a date (dd/mm/yyyy or similar)
      const hasDate = cols.some(c => /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(c));
      return hasBarcode || hasDate;
    };

    const isHeader = isHeaderRow(firstCols) && !isDataRow(firstCols);

    // Merge split rows sequentially if they look split
    const mergedLines: string[][] = [];
    let pendingCols: string[] = [];

    const startIndex = isHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const cols = getCols(lines[i]);
      if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

      if (pendingCols.length > 0) {
        // We have a pending row. Is this line a continuation?
        const isContinuation = 
          /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(cols[0]) || // starts with date
          /^[A-Z]{2,}-\d{2}-\d{2}-\d{2}$/i.test(cols[0]) || // starts with location
          cols.length <= 4; // has few columns

        if (isContinuation) {
          mergedLines.push([...pendingCols, ...cols]);
          pendingCols = [];
        } else {
          mergedLines.push(pendingCols);
          pendingCols = cols;
        }
      } else {
        // Check if it looks incomplete (typically we expect 5 to 7 columns for a full record)
        const looksIncomplete = cols.length < 5;
        if (looksIncomplete) {
          pendingCols = cols;
        } else {
          mergedLines.push(cols);
        }
      }
    }
    if (pendingCols.length > 0) {
      mergedLines.push(pendingCols);
    }

    // Now, map these columns to objects
    const rows: any[] = [];
    const headers = isHeader ? firstCols.map(h => h.toLowerCase().trim()) : [];

    mergedLines.forEach((cols) => {
      const obj: any = {};
      if (isHeader) {
        headers.forEach((header, index) => {
          obj[header] = cols[index] || '';
        });
      } else {
        // If no header, assign by guessing or standard position
        let brand = '';
        let barcode = '';
        let skuId = '';
        let skuName = '';
        let expiredDate = '';
        let location = '';
        let qty = '';

        if (cols.length === 7) {
          brand = cols[0];
          barcode = cols[1];
          skuId = cols[2];
          skuName = cols[3];
          expiredDate = cols[4];
          location = cols[5];
          qty = cols[6];
        } else {
          // Dynamic detection of column type
          cols.forEach(col => {
            const val = col.trim();
            if (!val) return;

            if (/^\d{8,20}$/.test(val)) {
              barcode = val;
            } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(val)) {
              expiredDate = val;
            } else if (/^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/i.test(val) || /^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/i.test(val)) {
              location = val;
            } else if (/^\d+$/.test(val.replace(/[\.,]/g, '')) && val.length < 6) {
              qty = val;
            } else if (/^[A-Z0-9_\-\/]{3,15}$/i.test(val) && !skuId && val === val.toUpperCase()) {
              skuId = val;
            } else if (val.length > 15 && !skuName) {
              skuName = val;
            } else if (!brand) {
              brand = val;
            } else if (brand && !skuName) {
              skuName = val;
            }
          });

          // Fallbacks based on indices
          if (!skuId && cols[2]) skuId = cols[2];
          if (!skuName && cols[3]) skuName = cols[3];
          if (!brand && cols[0]) brand = cols[0];
          if (!barcode && cols[1]) barcode = cols[1];
          if (!expiredDate && cols[4]) expiredDate = cols[4];
          if (!location && cols[5]) location = cols[5];
          if (!qty && cols[6]) qty = cols[6];
        }

        obj['brand'] = brand;
        obj['barcode'] = barcode;
        obj['sku id'] = skuId;
        obj['sku name'] = skuName;
        obj['expired date'] = expiredDate;
        obj['location'] = location;
        obj['qty'] = qty;
      }
      rows.push(obj);
    });

    processImportData(rows);
  };

  // POPULATE WITH USER SAMPLE DATA
  const handleLoadUserSampleData = () => {
    const sampleTsv = `brand	barcode	sku id	sku name	Expired date	location	qty
Skintific	810114871201	SKI121	Skintific Retinol Skin Renewal Serum	09/09/2029	AC-02-01-01	35
Skintific	4897147690739	SKI201	Skintific Radiance Boost Serum Spray	22/12/2029	AC-02-01-01	96
Skintific	810114870402	SKI217	Skintific Msh Niacinamide Brightening Moisture Gel 6 gr	24/12/2029	AC-02-02-01	152
Anua	8809640731792	ANU001	Anua Heartleaf 77% Soothing Toner 40Ml	19/11/2027	AC-03-02-03	15
Avoskin	8997239323357	AVO002	Avoskin Miraculous Refining Toner (100 Ml)	01/11/2027	RK-03-02-01	24
Soulyu	710497670142	SOU026	Soulyu Fluffy Haze Lip Velvet - 06 Rum Raisin	08/05/2028	AC-06-02-04	14
Fss	5524411232218	FSS020	Fss Salicylic Acid Toner 2% with Succinic Acid 100ml	01/07/2028	AC-04-01-01	168
Finally Found You	8994464410111	FIN028	Finally Found You Triple Vitamin B-Arrier + Peach + Snail Mucin Intensive Soothing Essence Toner	01/02/2028	AC-06-01-01	29
Brighty	8993883100009	BRI003	Brighty Glowing Underarm Gel 30 Ml		FL-06-05-01	1.028
Beautyinu	8994461990029	BEA002	Beautyinu Kefir Collagen Soap Bar 60 Gr	9/1/2027	AC-01-01-01	80
Mlen Diary	100101195	MLE051	Mlen Diary Magnetic Eyelashes-Manga Falsies-21	12/1/2028	AC-01-01-01	9
Blink Charm	8997031660070	BLI019	Blink Charm Sensl Curls#1-1 Pair Lem 1Ml	5/1/2027	AC-01-01-02	44
Glowfx	8994465580011	GLO002	Glowfx Glow Bomb Serum 20Ml	12/1/2027	AC-01-01-04	55
Hanasui	8998824552398	HAN028	Hanasui Collagen Water Sunscreen Spf30 With Renew Hangtag 30Gr X 48	2/1/2029	AC-01-01-04	28
Raecca	8997236031590	RAE010	Raecca Swipe To Glow Work	1/2/2029	FL-02-03-02	291
Jejuby	8994460180032	JEJ002	Jejuby Gluta Rice Clay Mask 50g	1/3/2029	FL-04-01-01	551
Kime	8994467420162	KIM001	Kime Luminizing Jeju Brightening Soap		FL-03-04-03	3.762
Rintik	8994452170010	RIN002	Rintik Stretch Mark Cream 200Ml	1/10/2027	FL-06-02-01	627
Buttered	8997724496986	BUT047	Buttered Lip Scrub Bubble Gum	1/7/2028	FL-06-03-01	74
Ciara	8993883100122	CIA005	Ciara Liquid Serum For Stretch Marks 30 Ml	1/2/2028	FL-06-04-01	127
Skin1004	8809576261110	SKI075	Skin1004 Madagascar Centella Light Cleansing Oil 200Ml	13/1/2029	FL-06-03-02	108
Implora	8993883801135	IMP249	Imp Essential Sheet Mask (Brightening) (48X12X25Gr)	17/12/2028	FL-02-04-01	96
Perfect White	(90)NA18221901080(91)250406-1	PER001	Perfect White Aha Body Serum (100Ml)	1/3/2028	FL-02-03-01	1.895
Mykonos	3475932544781	MYK032	Mykonos Monaco Royale 50Ml	1/6/2029	FL-01-01-02	72`;

    const lines = sampleTsv.trim().split('\n');
    const headers = lines[0].toLowerCase().split('\t').map(h => h.trim());
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split('\t').map(c => c.trim());
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = cols[index] || '';
      });
      rows.push(obj);
    }

    processImportData(rows);
  };

  const openEditModal = (item: InventoryItem) => {
    setSelectedItem({ ...item });
    setShowEditModal(true);
  };

  const openOpnameModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setOpnameActualQty(item.qty);
    setShowOpnameModal(true);
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider">Katalog & Stok Barang</h2>
          <p className="text-[11px] text-slate-500">Lihat, cari, tambah SKU, serta kelola audit fisik stok opname kosmetik.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Export Button */}
          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Ekspor data katalog stok ke Excel (.xlsx)"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            Ekspor Excel
          </button>

          {currentUser.role === 'ADMIN' ? (
            <>
              {/* Import Button */}
              <button
                onClick={() => setShowImportModal(true)}
                className="px-3 py-1.5 border border-emerald-200 hover:border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Impor data kosmetik dari Excel atau teks TSV"
              >
                <Upload className="h-3.5 w-3.5 text-emerald-600" />
                Impor Data
              </button>

              {/* Delete All Button */}
              {onClearInventory && (
                <button
                  onClick={onClearInventory}
                  className="px-3 py-1.5 border border-rose-200 hover:border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Hapus semua stok barang dari katalog"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                  Hapus Semua Stok
                </button>
              )}

              <button
                onClick={() => setShowAddModal(true)}
                className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah SKU Baru
              </button>
            </>
          ) : (
            <div className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200 px-2.5 py-1 rounded font-mono">
              Mode Baca-Saja ({currentUser.role})
            </div>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border border-slate-200 bg-slate-50 p-1 rounded-xl max-w-sm">
        <button
          onClick={() => setActiveTab('STOK')}
          className={`flex-1 py-1 text-[11px] font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'STOK'
              ? 'bg-white text-pink-600 shadow-xs border border-slate-100'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Warehouse className="h-3.5 w-3.5" />
          Katalog Stok
        </button>
        <button
          onClick={() => setActiveTab('PENUGASAN')}
          className={`flex-1 py-1 text-[11px] font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
            activeTab === 'PENUGASAN'
              ? 'bg-white text-pink-600 shadow-xs border border-slate-100'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Penugasan Opname
          {tasks.filter(t => (t as any).isOpname && t.status === 'PENDING').length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
              {tasks.filter(t => (t as any).isOpname && t.status === 'PENDING').length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'STOK' ? (
        <>
          {/* Filter and Search Bar */}
          <div className="bg-white p-3.5 rounded border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 items-center">
        {/* Search Input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Cari SKU, nama, brand, rak, barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-pink-500 focus:border-pink-500 outline-none text-slate-700 bg-slate-50/50"
          />
        </div>

        {/* Brand Filter */}
        <div className="flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="w-full p-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-pink-500 focus:border-pink-500 outline-none text-slate-600 bg-slate-50/50"
          >
            <option value="SEMUA">Semua Brand</option>
            {brands.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </div>

        {/* Expired Status Filter */}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full p-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-pink-500 focus:border-pink-500 outline-none text-slate-600 bg-slate-50/50"
          >
            <option value="SEMUA">Semua Status Expired</option>
            <option value="aman">Aman</option>
            <option value="expired">Expired</option>
            <option value="under <18bln">Under &lt;18 Bln</option>
          </select>
        </div>

        {/* Rack/Location Filter */}
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full p-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-pink-500 focus:border-pink-500 outline-none text-slate-600 bg-slate-50/50"
          >
            <option value="SEMUA">Semua Rak Lokasi</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>

        {/* Low Stock Checkbox */}
        <div className="flex items-center justify-start md:justify-center">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showOnlyLowStock}
              onChange={(e) => setShowOnlyLowStock(e.target.checked)}
              className="rounded text-pink-500 focus:ring-pink-500 border-slate-300 w-3.5 h-3.5"
            />
            <span className="font-semibold text-pink-600 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> Hanya Stok Tipis (Kritis)
            </span>
          </label>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                <th className="py-2.5 px-3">SKU & Brand</th>
                <th className="py-2.5 px-3">Nama Produk</th>
                <th className="py-2.5 px-3">Lokasi Rak</th>
                <th className="py-2.5 px-3">Expired Date</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Level Stok (Pcs)</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 bg-slate-50/20">
                    <AlertCircle className="h-6 w-6 text-slate-300 mx-auto mb-1" />
                    <p className="font-semibold text-slate-700">Produk Tidak Ditemukan</p>
                    <p className="text-[10px] mt-0.5">Coba sesuaikan kata kunci pencarian atau matikan filter stok kritis Anda.</p>
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const isLow = item.qty <= item.lowStockThreshold;
                  // percentage relative to critical or max level
                  const qtyPercentage = Math.min((item.qty / (item.lowStockThreshold * 3)) * 100, 100);
                  const status = getExpiredStatus(item.expiredDate);
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* SKU & Brand */}
                      <td className="py-2 px-3">
                        <span className="font-extrabold text-slate-800 font-mono text-[10px] block">{item.skuId}</span>
                        <span className="inline-block px-1.5 py-0.5 bg-pink-50 text-pink-600 font-bold text-[8px] rounded-sm border border-pink-100 mt-0.5">
                          {item.brand}
                        </span>
                      </td>
 
                      {/* Name */}
                      <td className="py-2 px-3 max-w-xs">
                        <p className="font-bold text-slate-800 line-clamp-1 text-[11px]">{item.skuName}</p>
                        <p className="text-[9px] text-slate-400 font-mono">Barcode: {item.barcode}</p>
                      </td>
 
                      {/* Location Rack */}
                      <td className="py-2 px-3">
                        <span className="font-mono bg-slate-100 text-slate-700 font-semibold px-1.5 py-0.5 rounded-sm text-[9px] border border-slate-200 inline-block" title={item.warehouse}>
                          📍 {item.location}
                        </span>
                        <span className="block text-[8px] text-slate-400 mt-0.5">{item.warehouse}</span>
                      </td>
 
                      {/* Expired Date */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1 text-slate-600 text-[11px]">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>{item.expiredDate}</span>
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="py-2 px-3">
                        {status === 'expired' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                            Expired
                          </span>
                        ) : status === 'under <18bln' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                            Under &lt;18 Bln
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Aman
                          </span>
                        )}
                      </td>
 
                      {/* Current Qty & Meter */}
                      <td className="py-2 px-3">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className={`font-black text-[12px] ${isLow ? 'text-pink-600' : 'text-slate-800'}`}>
                            {item.qty} <span className="text-[9px] font-normal text-slate-400">pcs</span>
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">Min: {item.lowStockThreshold}</span>
                        </div>
                        {/* Interactive level bar */}
                        <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
                          <div 
                            className={`h-full rounded-full ${isLow ? 'bg-pink-500' : 'bg-emerald-500'}`}
                            style={{ width: `${qtyPercentage}%` }}
                          />
                        </div>
                      </td>
 
                      {/* Actions */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Opname Button */}
                          <button
                            onClick={() => openOpnameModal(item)}
                            title="Audit Fisik (Stok Opname)"
                            className="p-1 hover:bg-emerald-50 rounded text-emerald-600 hover:text-emerald-700 border border-transparent hover:border-emerald-200 transition-all cursor-pointer"
                          >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                          </button>
 
                          {/* Edit / Delete for Admin */}
                          {currentUser.role === 'ADMIN' && (
                            <>
                              <button
                                onClick={() => openEditModal(item)}
                                title="Edit Detail SKU"
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteItem(item.id)}
                                title="Hapus SKU"
                                className="p-1 hover:bg-pink-50 rounded text-pink-500 hover:text-pink-600 border border-transparent hover:border-pink-200 transition-all cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-150 text-xs font-mono">
              <tr className="font-bold text-slate-700">
                <td colSpan={5} className="py-2.5 px-3 text-right text-[10px] uppercase tracking-wider text-slate-500 font-sans">
                  Total Qty SKU Terfilter
                </td>
                <td className="py-2.5 px-3 text-slate-900 font-black text-[12px]">
                  {filteredInventory.reduce((acc, curr) => acc + curr.qty, 0).toLocaleString('id-ID')} <span className="text-[9px] font-normal text-slate-500 font-sans">pcs</span>
                </td>
                <td className="py-2 px-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="py-2 px-3 border-t border-slate-150 bg-slate-50/50 text-slate-400 text-[9px] flex justify-between items-center font-mono">
          <span>Menampilkan {filteredInventory.length} dari {inventory.length} total SKU | Total Qty: {inventory.reduce((acc, curr) => acc + curr.qty, 0).toLocaleString('id-ID')} pcs</span>
          <span>Suhu Ruangan Gudang AC: 18.4°C (Stabil)</span>
        </div>
      </div>
    </>
  ) : (
        /* ==================== STOCK OPNAME ASSIGNMENT & EXECUTION TAB ==================== */
        <div className="space-y-4">
          {/* Active Audit Execution Screen (Wizard Overlay) */}
          {activeExecutionAssignment && (
            <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex flex-col justify-between p-4 z-50 animate-in fade-in duration-150">
              <div className="bg-white rounded-xl border border-slate-200 w-full max-w-3xl mx-auto my-auto shadow-2xl flex flex-col h-[90vh] overflow-hidden">
                {/* Wizard Header */}
                <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-pink-500 text-white">
                  <div>
                    <h3 className="font-extrabold text-xs uppercase tracking-wider flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4" /> EKSEKUSI AUDIT STOK (OPNAME)
                    </h3>
                    <p className="text-[10px] opacity-90 mt-0.5">
                      Petugas: <span className="font-bold">{allUsers.find(u => u.id === activeExecutionAssignment.orderNumber || u.username === activeExecutionAssignment.orderNumber)?.name || activeExecutionAssignment.orderNumber}</span> | 
                      Target: <span className="font-bold">{activeExecutionAssignment.warehouse} / {activeExecutionAssignment.skuName}</span>
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      if (confirm('Batal melakukan audit? Semua input jumlah fisik sementara akan hilang.')) {
                        setActiveExecutionAssignment(null);
                        setExecutionCounts({});
                      }
                    }} 
                    className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Wizard Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-[11px] text-amber-800 space-y-1">
                    <p className="font-bold flex items-center gap-1">⚠️ Aturan Audit Anti-Bias</p>
                    <p>Sistem menyembunyikan stok sistem untuk memastikan perhitungan dilakukan secara jujur dan mandiri. Masukkan jumlah fisik yang sebenarnya Anda temukan di rak terkait.</p>
                  </div>

                  {/* Camera Barcode Scanner for Wizard */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row justify-between items-center gap-2">
                    <div className="text-center sm:text-left">
                      <span className="text-xs font-bold text-slate-800 block">Pindai Barcode untuk Audit Cepat</span>
                      <span className="text-[10px] text-slate-500">Pindai barcode produk di rak untuk otomatis mencari dan menambah jumlah hitungan fisik.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowExecutionScanner(true)}
                      className="px-4 py-1.5 bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-xs rounded-lg flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                    >
                      <Camera className="h-4 w-4" /> Aktifkan Scanner Kamera
                    </button>
                  </div>

                  {/* General Scanner Overlay within Wizard */}
                  {showExecutionScanner && (
                    <div className="relative border-2 border-dashed border-pink-300 rounded-lg overflow-hidden bg-slate-900/5 p-4">
                      <CameraScanner
                        onClose={() => setShowExecutionScanner(false)}
                        onScan={(code) => {
                          const cleanedCode = code.trim().toUpperCase();
                          // Find item with matching barcode or SKU in matching list
                          const matchingItem = inventory.find(item => 
                            (item.id in executionCounts) && 
                            (item.barcode === cleanedCode || item.skuId.toUpperCase() === cleanedCode)
                          );

                          if (matchingItem) {
                            setExecutionCounts(prev => ({
                              ...prev,
                              [matchingItem.id]: (prev[matchingItem.id] || 0) + 1
                            }));
                            toast.success(`Berhasil memindai ${matchingItem.skuName}! Hitungan ditambah.`);
                          } else {
                            toast.error(`Barcode "${code}" tidak cocok dengan kriteria audit penugasan ini.`);
                          }
                        }}
                        title="Pindai Produk untuk Audit Opname"
                      />
                    </div>
                  )}

                  {/* List of target items to audit */}
                  <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Daftar Barang untuk Dihitung</h4>
                    
                    {inventory.filter(item => item.id in executionCounts).map((item) => {
                      const currentCount = executionCounts[item.id] || 0;
                      
                      return (
                        <div key={item.id} className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-3xs transition-all">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-slate-900 text-xs font-mono">{item.skuId}</span>
                              <span className="px-1.5 py-0.5 bg-pink-50 text-pink-600 font-bold text-[8px] rounded-sm border border-pink-100">
                                {item.brand}
                              </span>
                            </div>
                            <p className="font-bold text-slate-800 text-[11px] line-clamp-1">{item.skuName}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              Lokasi: <span className="font-bold text-slate-700">📍 {item.location}</span> | Barcode: {item.barcode}
                            </p>
                          </div>

                          {/* Count Inputs */}
                          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
                            <span className="text-[10px] text-slate-400 uppercase font-bold sm:hidden">Jumlah Fisik:</span>
                            <div className="flex items-center gap-1.5">
                              {/* Decrement */}
                              <button
                                type="button"
                                onClick={() => setExecutionCounts(prev => ({
                                  ...prev,
                                  [item.id]: Math.max(0, (prev[item.id] || 0) - 1)
                                }))}
                                className="w-7 h-7 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-lg font-black text-xs cursor-pointer flex items-center justify-center"
                              >
                                -
                              </button>
                              
                              <input
                                type="number"
                                required
                                min="0"
                                value={currentCount}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setExecutionCounts(prev => ({
                                    ...prev,
                                    [item.id]: isNaN(val) ? 0 : val
                                  }));
                                }}
                                className="w-16 p-1 border border-slate-200 text-center text-xs font-black rounded-lg text-slate-800"
                              />

                              {/* Increment */}
                              <button
                                type="button"
                                onClick={() => setExecutionCounts(prev => ({
                                  ...prev,
                                  [item.id]: (prev[item.id] || 0) + 1
                                }))}
                                className="w-7 h-7 bg-pink-100 hover:bg-pink-200 border border-pink-200 text-pink-600 rounded-lg font-black text-xs cursor-pointer flex items-center justify-center"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Wizard Footer */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Batal melakukan audit? Semua input jumlah fisik sementara akan hilang.')) {
                        setActiveExecutionAssignment(null);
                        setExecutionCounts({});
                      }
                    }}
                    className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleCompleteExecution}
                    className="px-5 py-2 bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Simpan & Selesaikan Audit Opname
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Top Panel explaining Opname Workflow */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-3xs">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <ClipboardCheck className="h-4 w-4 text-pink-500" />
                SISTEM PENUGASAN STOCK OPNAME (MUTU FISIK)
              </h3>
              <p className="text-[11px] text-slate-500 max-w-xl">
                Admin dapat menugaskan operator gudang (Staff, Picker, Packer) untuk menghitung kecocokan fisik stok barang di lokasi rak, brand, atau SKU tertentu guna mendeteksi selisih / penyusutan barang.
              </p>
            </div>
            
            {currentUser.role === 'ADMIN' && (
              <button
                onClick={() => {
                  setAssignUserId('');
                  setShowAssignModal(true);
                }}
                className="px-3.5 py-1.5 bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-3xs transition-all shrink-0"
              >
                <Plus className="h-4 w-4" /> Buat Penugasan Baru
              </button>
            )}
          </div>

          {/* Section 1: My Personal Pending Opname Assignments */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <UserCheck className="h-3.5 w-3.5 text-pink-500" /> Penugasan Opname Saya (Menunggu Perhitungan)
            </h4>

            {tasks.filter(t => (t as any).isOpname && t.status === 'PENDING' && (t.orderNumber === currentUser.id || t.orderNumber === currentUser.username)).length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-400 shadow-3xs">
                <CheckCircle2 className="h-7 w-7 text-emerald-500 mx-auto mb-1.5" />
                <span className="text-xs font-bold text-slate-700 block">Tidak Ada Tugas Opname Tertunda</span>
                <span className="text-[10px]">Semua tugas audit fisik Anda telah diselesaikan atau Anda belum ditugaskan.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tasks.filter(t => (t as any).isOpname && t.status === 'PENDING' && (t.orderNumber === currentUser.id || t.orderNumber === currentUser.username)).map((task) => (
                  <div key={task.id} className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 space-y-3 shadow-3xs transition-all relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-2 h-full bg-pink-500" />
                    
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-mono text-slate-400 block">ID TUGAS: {task.id}</span>
                        <span className="text-xs font-extrabold text-slate-800 uppercase block mt-0.5">Audit: {task.skuName} ({task.warehouse})</span>
                      </div>
                      <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-600 font-extrabold text-[8px] rounded-full uppercase tracking-wider">
                        PENDING
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg text-[11px] text-slate-600 space-y-1 border border-slate-100">
                      <p>📍 <span className="font-bold text-slate-700">Filter Lokasi:</span> {task.location || 'Semua'}</p>
                      <p>🏷️ <span className="font-bold text-slate-700">SKU Filter:</span> {task.skuId || 'Semua'}</p>
                      <p>📝 <span className="font-bold text-slate-700">Instruksi:</span> {task.barcode || '-'}</p>
                    </div>

                    <div className="flex justify-between items-center gap-2 pt-1.5">
                      <span className="text-[10px] text-slate-400">Dibuat: {new Date(task.createdAt).toLocaleDateString('id-ID')}</span>
                      <button
                        onClick={() => handleStartExecution(task)}
                        className="px-3.5 py-1.5 bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-[11px] rounded-lg cursor-pointer flex items-center gap-1.5 shadow-3xs"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" /> Mulai Hitung Stok
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: All assignments overview for Admin */}
          {currentUser.role === 'ADMIN' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-3xs space-y-2">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-slate-500" /> SEMUA TUGAS & RIWAYAT AUDIT OPNAME
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Total Penugasan: {tasks.filter(t => (t as any).isOpname).length}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-150 text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-2 px-3">Tugas / Tanggal</th>
                      <th className="py-2 px-3">Petugas</th>
                      <th className="py-2 px-3">Target Filter</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Hasil Audit / Selisih</th>
                      <th className="py-2 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {tasks.filter(t => (t as any).isOpname).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          Belum ada data penugasan opname yang pernah dibuat.
                        </td>
                      </tr>
                    ) : (
                      tasks.filter(t => (t as any).isOpname).map((task) => {
                        const assignedUser = allUsers.find(u => u.id === task.orderNumber || u.username === task.orderNumber);
                        const assignedName = assignedUser ? assignedUser.name : task.orderNumber;
                        
                        return (
                          <tr key={task.id} className="hover:bg-slate-50/40 transition-all">
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-800 block">{task.id}</span>
                              <span className="text-[9px] text-slate-400 font-mono">{new Date(task.createdAt).toLocaleString('id-ID')}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-700 block">{assignedName}</span>
                              <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-mono uppercase mt-0.5 inline-block">{assignedUser?.role || 'Operator'}</span>
                            </td>
                            <td className="py-2.5 px-3 max-w-xs">
                              <p className="font-bold text-slate-700 line-clamp-1">Gudang: {task.warehouse}</p>
                              <p className="text-[10px] text-slate-400 font-mono">Brand: {task.skuName} | SKU: {task.skuId} | Rak: {task.location}</p>
                            </td>
                            <td className="py-2.5 px-3">
                              {task.status === 'PENDING' ? (
                                <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-700 font-bold text-[8px] rounded-full uppercase tracking-wider">
                                  Menunggu
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-[8px] rounded-full uppercase tracking-wider">
                                  Selesai
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 max-w-md">
                              {task.status === 'COMPLETED' ? (
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-bold text-slate-700">Hasil Perhitungan Fisik:</p>
                                  <p className="text-[9px] text-slate-500 font-mono leading-tight">{task.operatorLogs[task.operatorLogs.length - 1]?.action || '-'}</p>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">- Menunggu dikerjakan petugas -</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {task.status === 'PENDING' && (
                                <button
                                  onClick={() => {
                                    if (confirm('Apakah Anda yakin ingin membatalkan/menghapus tugas opname ini?')) {
                                      // Admin deletion
                                      if (onUpdateTask) {
                                        onUpdateTask({ ...task, status: 'COMPLETED', skuName: 'DIBATALKAN' });
                                        toast.success('Penugasan berhasil dibatalkan.');
                                      }
                                    }
                                  }}
                                  className="p-1 hover:bg-rose-50 rounded text-rose-500 hover:text-rose-600 transition-all cursor-pointer"
                                  title="Hapus Penugasan"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Admin Assign Modal */}
          {showAssignModal && currentUser.role === 'ADMIN' && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
              <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
                <div className="flex justify-between items-center px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1">
                    <Users className="h-4 w-4 text-pink-500" /> Buat Penugasan Opname Baru
                  </h3>
                  <button onClick={() => setShowAssignModal(false)} className="p-1 rounded hover:bg-slate-200 text-slate-400 cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateAssignment} className="p-4 space-y-3.5">
                  {/* Select Operator */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Pilih Operator Gudang</label>
                    <select
                      required
                      value={assignUserId}
                      onChange={(e) => setAssignUserId(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 text-slate-700 bg-slate-50/50"
                    >
                      <option value="">-- Pilih Petugas --</option>
                      {allUsers.filter(u => u.role !== 'ADMIN' || u.id === currentUser.id).map((u) => (
                        <option key={u.id} value={u.id || u.username}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  </div>

                  {/* Target Warehouse */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Target Gudang</label>
                    <select
                      value={assignWarehouse}
                      onChange={(e) => setAssignWarehouse(e.target.value as any)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 text-slate-700 bg-slate-50/50"
                    >
                      <option value="SEMUA">Semua Gudang</option>
                      <option value="Gudang Utama">Gudang Utama</option>
                      <option value="Gudang AC">Gudang AC</option>
                      <option value="Gudang Rak">Gudang Rak</option>
                    </select>
                  </div>

                  {/* Target Brand */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Filter Brand Kosmetik</label>
                    <select
                      value={assignBrand}
                      onChange={(e) => setAssignBrand(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 text-slate-700 bg-slate-50/50"
                    >
                      <option value="SEMUA">Semua Brand</option>
                      {brands.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  {/* Target SKU */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Filter SKU ID</label>
                    <select
                      value={assignSku}
                      onChange={(e) => setAssignSku(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 text-slate-700 bg-slate-50/50"
                    >
                      <option value="SEMUA">Semua SKU</option>
                      {inventory.map((item) => (
                        <option key={item.id} value={item.skuId}>{item.skuId} - {item.skuName.slice(0, 35)}...</option>
                      ))}
                    </select>
                  </div>

                  {/* Location Prefix */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Filter Rak / Lokasi (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Contoh: AC-02 (Semua rak AC-02)"
                      value={assignLocation}
                      onChange={(e) => setAssignLocation(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 text-slate-700 bg-slate-50/50"
                    />
                  </div>

                  {/* Assignment Notes */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Catatan / Catatan Instruksi</label>
                    <textarea
                      placeholder="Contoh: Tolong hitung fisik stock Skintific serum karena dicurigai ada selisih."
                      value={assignNotes}
                      onChange={(e) => setAssignNotes(e.target.value)}
                      rows={2}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 text-slate-700 bg-slate-50/50 resize-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAssignModal(false)}
                      className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-lg transition-all cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-xs rounded-lg transition-all cursor-pointer shadow-xs"
                    >
                      Kirim Penugasan
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add SKU Modal */}
      {showAddModal && currentUser.role === 'ADMIN' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded border border-slate-200 w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center px-4 py-2.5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Tambah SKU Kosmetik Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded hover:bg-slate-200 text-slate-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">SKU ID (Unik)</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: COSRX-CLE-02"
                    value={newSkuId}
                    onChange={(e) => setNewSkuId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Barcode / EAN</label>
                  <input
                    type="text"
                    placeholder="Kosongkan untuk auto-generate"
                    value={newBarcode}
                    onChange={(e) => setNewBarcode(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Nama Produk Kosmetik</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Low pH Good Morning Gel Cleanser 150ml"
                  value={newSkuName}
                  onChange={(e) => setNewSkuName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Merek / Brand</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: COSRX"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tanggal Kedaluwarsa</label>
                  <input
                    type="date"
                    required
                    value={newExpiredDate}
                    onChange={(e) => setNewExpiredDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Gudang Penyimpanan</label>
                  <select
                    value={newWarehouse}
                    onChange={(e) => setNewWarehouse(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700"
                  >
                    <option value="Gudang AC">Gudang AC (Skincare)</option>
                    <option value="Gudang Utama">Gudang Utama (Bulk)</option>
                    <option value="Gudang Rak">Gudang Rak (Lipstik)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Bin / Kode Lokasi Rak</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: AC-02-01-01"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Kuantitas Stok Awal</label>
                  <input
                    type="number"
                    required
                    value={newQty}
                    onChange={(e) => setNewQty(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Batas Minimum (Threshold)</label>
                  <input
                    type="number"
                    required
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Instruksi penanganan khusus atau instruksi suhu..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetAddForm(); }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Simpan SKU
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit SKU Modal */}
      {showEditModal && selectedItem && currentUser.role === 'ADMIN' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">Edit Detail SKU: {selectedItem.skuId}</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 rounded-lg hover:bg-slate-200 text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Nama Produk Kosmetik</label>
                <input
                  type="text"
                  required
                  value={selectedItem.skuName}
                  onChange={(e) => setSelectedItem({ ...selectedItem, skuName: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Merek</label>
                  <input
                    type="text"
                    required
                    value={selectedItem.brand}
                    onChange={(e) => setSelectedItem({ ...selectedItem, brand: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tanggal Expired (DD/MM/YYYY)</label>
                  <input
                    type="text"
                    required
                    value={selectedItem.expiredDate}
                    onChange={(e) => setSelectedItem({ ...selectedItem, expiredDate: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Gudang</label>
                  <select
                    value={selectedItem.warehouse}
                    onChange={(e) => setSelectedItem({ ...selectedItem, warehouse: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none"
                  >
                    <option value="Gudang AC">Gudang AC (Skincare)</option>
                    <option value="Gudang Utama">Gudang Utama (Bulk)</option>
                    <option value="Gudang Rak">Gudang Rak (Lipstik)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Lokasi Bin</label>
                  <input
                    type="text"
                    required
                    value={selectedItem.location}
                    onChange={(e) => setSelectedItem({ ...selectedItem, location: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Kuantitas Fisik Saat Ini</label>
                  <input
                    type="number"
                    required
                    value={selectedItem.qty}
                    onChange={(e) => setSelectedItem({ ...selectedItem, qty: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Batas Minimum</label>
                  <input
                    type="number"
                    required
                    value={selectedItem.lowStockThreshold}
                    onChange={(e) => setSelectedItem({ ...selectedItem, lowStockThreshold: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Catatan</label>
                <textarea
                  rows={2}
                  value={selectedItem.notes || ''}
                  onChange={(e) => setSelectedItem({ ...selectedItem, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none text-slate-700"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Opname Audit Modal */}
      {showOpnameModal && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-emerald-50">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-slate-800 text-sm">Audit Fisik (Stock Opname)</h3>
              </div>
              <button onClick={() => setShowOpnameModal(false)} className="p-1 rounded-lg hover:bg-slate-200 text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleOpnameSubmit} className="p-6 space-y-4">
              {/* Product brief info */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                <p className="text-[10px] text-slate-400 font-mono">ID SKU: {selectedItem.skuId}</p>
                <p className="font-bold text-slate-800 text-xs">{selectedItem.skuName}</p>
                <p className="text-[11px] text-slate-500 flex justify-between pt-1">
                  <span>Sistem Record: <strong>{selectedItem.qty} pcs</strong></span>
                  <span>Rak: <strong>{selectedItem.location}</strong></span>
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Jumlah Fisik Aktual di Rak</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    value={opnameActualQty}
                    onChange={(e) => setOpnameActualQty(Number(e.target.value))}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center"
                  />
                </div>
                <div className="mt-2 text-[10px] flex justify-between px-1">
                  <span className="text-slate-400">Selisih (Discrepancy):</span>
                  <span className={`font-mono font-bold ${opnameActualQty - selectedItem.qty === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {opnameActualQty - selectedItem.qty > 0 ? '+' : ''}{opnameActualQty - selectedItem.qty} pcs
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Alasan Penyesuaian / Catatan</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Selisih salah hitung, ada barang rusak dsb."
                  value={opnameNotes}
                  onChange={(e) => setOpnameNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowOpnameModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Konfirmasi Audit Opname
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && currentUser.role === 'ADMIN' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Impor Katalog & Stok Kosmetik</h3>
              </div>
              <button 
                onClick={() => { setShowImportModal(false); setPastedText(''); }} 
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Option 1: File Upload */}
              <div className="border border-dashed border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/10 p-6 rounded-xl text-center transition-all">
                <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <h4 className="font-bold text-slate-800 text-xs">Pilih atau Seret File Excel (.xlsx, .xls, .csv)</h4>
                <p className="text-[10px] text-slate-400 mt-1 mb-3">Kolom wajib: brand, barcode, sku id, sku name, Expired date, location, qty</p>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleImportFile}
                  accept=".xlsx, .xls, .csv, .tsv"
                  className="hidden" 
                />
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Upload className="h-3 w-3" />
                    Pilih File Excel
                  </button>
                  <button
                    type="button"
                    onClick={downloadInventoryTemplate}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Download className="h-3 w-3 text-pink-500" />
                    Unduh Template Excel
                  </button>
                </div>
              </div>

              <div className="flex items-center my-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider before:content-[''] before:flex-1 before:border-b before:border-slate-200 before:mr-3 after:content-[''] after:flex-1 after:border-b after:border-slate-200 after:ml-3">
                Atau
              </div>

              {/* Option 2: Copy Paste */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase">Tempel Teks Spreadsheet (Format Tab-Separated/Excel)</label>
                <p className="text-[10px] text-slate-400">Salin tabel dari Excel atau dokumen teks lalu tempel di bawah ini (baris pertama harus berupa header kolom):</p>
                <textarea
                  rows={4}
                  placeholder={`brand\tbarcode\tsku id\tsku name\tExpired date\tlocation\tqty\nSkintific\t810114871201\tSKI121\tSkintific Retinol Serum\t09/09/2029\tAC-02-01-01\t35`}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-[11px] font-mono outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 bg-slate-50/50"
                />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 font-mono">Input: {pastedText ? pastedText.split('\n').length : 0} baris</span>
                  <button
                    type="button"
                    onClick={handlePasteImport}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-all cursor-pointer"
                  >
                    Proses Teks Tempel
                  </button>
                </div>
              </div>

              <div className="flex items-center my-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider before:content-[''] before:flex-1 before:border-b before:border-slate-200 before:mr-3 after:content-[''] after:flex-1 after:border-b after:border-slate-200 after:ml-3">
                Atau
              </div>

              {/* Option 3: Load preset sample data */}
              <div className="bg-pink-50/50 border border-pink-100 p-4 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-pink-800 text-xs">Instan: Muat Data Preset Kosmetik Lengkap</h4>
                  <p className="text-[10px] text-pink-600 mt-0.5">Isi katalog gudang secara instan dengan 24+ item dari brand Skintific, Anua, Avoskin, Soulyu, Fss, dsb.</p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadUserSampleData}
                  className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shrink-0 shadow-xs"
                >
                  Muat Sekarang
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => { setShowImportModal(false); setPastedText(''); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
