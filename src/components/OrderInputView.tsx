import React, { useState, useRef, useEffect } from 'react';
import { 
  ShoppingCart, 
  Trash2, 
  User, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Sparkles, 
  X, 
  Upload, 
  Download,
  Calendar, 
  ClipboardList, 
  Hash,
  Clock,
  ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { InventoryItem, User as UserType, OrderRecord, TransactionTask } from '../types';
import { downloadOrderTemplate } from '../utils/excelTemplates';

interface OrderInputViewProps {
  inventory: InventoryItem[];
  currentUser: UserType;
  onCreateOrder: (order: OrderRecord, tasks: TransactionTask[]) => void;
}

interface AllocationDetail {
  id: string; // unique key
  inventoryItemId: string; // ID of inventory item
  qtyToPick: number;
  location: string;
  expiredDate: string;
  batchNumber: string;
  warehouse: 'Gudang AC' | 'Gudang Utama' | 'Gudang Rak';
}

interface AllocationItem {
  skuId: string;
  skuName: string;
  brand: string;
  barcode: string;
  requestedQty: number;
  allocations: AllocationDetail[];
  error?: string;
}

function parseDateString(dateStr: string): number {
  if (!dateStr) return Infinity;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day).getTime();
  }
  return Infinity;
}

export default function OrderInputView({
  inventory,
  currentUser,
  onCreateOrder,
}: OrderInputViewProps) {
  // Client & Document details
  const [customer, setCustomer] = useState('N/A');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [customOrderNumber, setCustomOrderNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [needsPacking, setNeedsPacking] = useState(true);

  // Bulk Item copy-paste state
  const [pastedText, setPastedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time structured allocation state
  const [allocationItems, setAllocationItems] = useState<AllocationItem[]>([]);

  // Statistics
  const [totalRows, setTotalRows] = useState(0);
  const [validRows, setValidRows] = useState(0);
  const [errorRows, setErrorRows] = useState(0);

  // Inline Notification
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Parse text area whenever it changes
  useEffect(() => {
    const lines = pastedText.split('\n');
    let tRows = 0;
    let vRows = 0;
    let eRows = 0;

    const parsedList: { skuId: string; qty: number; isValid: boolean; error?: string }[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      tRows++;

      // Split by spaces, tabs, commas, semicolons
      const tokens = trimmed.split(/[\s\t,;]+/).map(t => t.trim()).filter(Boolean);
      const skuId = tokens[0]?.toUpperCase() || '';
      const qtyStr = tokens[1] || '1';
      const qty = parseInt(qtyStr, 10);

      const isSkuExists = inventory.some(item => item.skuId.toUpperCase() === skuId.toUpperCase());

      if (!skuId) {
        eRows++;
        parsedList.push({ skuId: '', qty: 0, isValid: false, error: 'Baris kosong atau format salah' });
      } else if (isNaN(qty) || qty <= 0) {
        eRows++;
        parsedList.push({ skuId, qty: 0, isValid: false, error: `Qty "${qtyStr}" tidak valid` });
      } else if (!isSkuExists) {
        eRows++;
        parsedList.push({ skuId, qty, isValid: false, error: 'SKU tidak terdaftar di katalog' });
      } else {
        vRows++;
        parsedList.push({ skuId, qty, isValid: true });
      }
    }

    setTotalRows(tRows);
    setValidRows(vRows);
    setErrorRows(eRows);

    // Synchronize to allocationItems state (preserve manual changes where possible)
    setAllocationItems(prev => {
      const updatedList: AllocationItem[] = [];

      for (const parsed of parsedList) {
        if (!parsed.isValid || !parsed.skuId) continue;

        // Try to find if this exact SKU & Qty already exists in our previous state to preserve selections
        const existing = prev.find(item => item.skuId === parsed.skuId && item.requestedQty === parsed.qty);

        if (existing) {
          updatedList.push(existing);
        } else {
          // Perform automatic FIFO allocation
          const skuIdUpper = parsed.skuId.toUpperCase();
          const matchedInv = inventory
            .filter(item => item.skuId.toUpperCase() === skuIdUpper && item.qty > 0)
            .sort((a, b) => parseDateString(a.expiredDate) - parseDateString(b.expiredDate));

          const sampleItem = inventory.find(item => item.skuId.toUpperCase() === skuIdUpper);
          const skuName = sampleItem?.skuName || `SKU ${parsed.skuId}`;
          const brand = sampleItem?.brand || 'Unknown';
          const barcode = sampleItem?.barcode || '';

          const allocations: AllocationDetail[] = [];
          let remaining = parsed.qty;

          for (const inv of matchedInv) {
            if (remaining <= 0) break;
            const allocatedQty = Math.min(inv.qty, remaining);
            allocations.push({
              id: `${inv.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              inventoryItemId: inv.id,
              qtyToPick: allocatedQty,
              location: inv.location,
              expiredDate: inv.expiredDate,
              batchNumber: inv.batchNumber || '',
              warehouse: inv.warehouse
            });
            remaining -= allocatedQty;
          }

          // If remaining > 0, we have an under-allocation (insufficient stock)
          const errorMsg = remaining > 0 ? `Stok kurang ${remaining} pcs` : undefined;

          updatedList.push({
            skuId: parsed.skuId,
            skuName,
            brand,
            barcode,
            requestedQty: parsed.qty,
            allocations,
            error: errorMsg
          });
        }
      }

      return updatedList;
    });
  }, [pastedText, inventory]);

  // Handle excel import for outbound orders
  const handleImportExcelOrder = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const rows = jsonData.map(row => {
          const skuId = (row['sku id'] || row['SKU'] || row['Kode SKU'] || row['sku'] || '').toString().trim();
          const qty = parseInt(row['qty'] || row['Qty'] || row['Kuantitas'] || row['Jumlah'] || row['qty'] || '1', 10);
          return { skuId, qty };
        }).filter(r => r.skuId && r.qty > 0);

        if (rows.length === 0) {
          setFeedback({
            type: 'error',
            message: 'Gagal mengimpor Excel: Tidak ditemukan kolom SKU ID atau Qty yang valid.'
          });
          return;
        }

        const textRepresentation = rows.map(r => `${r.skuId} ${r.qty}`).join('\n');
        setPastedText(textRepresentation);
        setFeedback({
          type: 'success',
          message: `Berhasil memuat ${rows.length} baris dari Excel.`
        });
      } catch (err) {
        setFeedback({
          type: 'error',
          message: 'Gagal membaca file Excel. Pastikan file berformat .xlsx, .xls, atau .csv'
        });
      }
    };
    reader.readAsArrayBuffer(file);
    if (e.target) e.target.value = '';
  };

  // Change selected location for an allocation line
  const handleLocationChange = (skuId: string, allocId: string, inventoryItemId: string) => {
    const invItem = inventory.find(i => i.id === inventoryItemId);
    if (!invItem) return;

    setAllocationItems(prev => prev.map(item => {
      if (item.skuId !== skuId) return item;

      const updatedAllocations = item.allocations.map(alloc => {
        if (alloc.id !== allocId) return alloc;
        return {
          ...alloc,
          inventoryItemId: invItem.id,
          location: invItem.location,
          expiredDate: invItem.expiredDate,
          batchNumber: invItem.batchNumber || '',
          warehouse: invItem.warehouse
        };
      });

      // Recalculate status and verify if enough stock
      const totalAllocated = updatedAllocations.reduce((sum, a) => sum + a.qtyToPick, 0);
      const errorMsg = totalAllocated < item.requestedQty ? `Stok kurang ${item.requestedQty - totalAllocated} pcs` : undefined;

      return {
        ...item,
        allocations: updatedAllocations,
        error: errorMsg
      };
    }));
  };

  // Change quantity for an allocation line
  const handleQtyChange = (skuId: string, allocId: string, value: number) => {
    setAllocationItems(prev => prev.map(item => {
      if (item.skuId !== skuId) return item;

      const updatedAllocations = item.allocations.map(alloc => {
        if (alloc.id !== allocId) return alloc;
        return {
          ...alloc,
          qtyToPick: Math.max(0, value)
        };
      });

      const totalAllocated = updatedAllocations.reduce((sum, a) => sum + a.qtyToPick, 0);
      const errorMsg = totalAllocated < item.requestedQty 
        ? `Stok kurang ${item.requestedQty - totalAllocated} pcs` 
        : totalAllocated > item.requestedQty
          ? `Alokasi berlebih (+${totalAllocated - item.requestedQty} pcs)`
          : undefined;

      return {
        ...item,
        allocations: updatedAllocations,
        error: errorMsg
      };
    }));
  };

  // Split allocation to add another location
  const handleAddSplitLocation = (skuId: string) => {
    setAllocationItems(prev => prev.map(item => {
      if (item.skuId !== skuId) return item;

      const availableInv = inventory.filter(i => i.skuId.toUpperCase() === skuId.toUpperCase() && i.qty > 0);
      const firstAvailable = availableInv[0];

      const newAlloc: AllocationDetail = {
        id: `split-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        inventoryItemId: firstAvailable?.id || '',
        qtyToPick: 0,
        location: firstAvailable?.location || '',
        expiredDate: firstAvailable?.expiredDate || '',
        batchNumber: firstAvailable?.batchNumber || '',
        warehouse: firstAvailable?.warehouse || 'Gudang Utama'
      };

      return {
        ...item,
        allocations: [...item.allocations, newAlloc]
      };
    }));
  };

  // Remove an allocation row (split row)
  const handleRemoveSplitRow = (skuId: string, allocId: string) => {
    setAllocationItems(prev => prev.map(item => {
      if (item.skuId !== skuId) return item;

      const updatedAllocations = item.allocations.filter(a => a.id !== allocId);
      const totalAllocated = updatedAllocations.reduce((sum, a) => sum + a.qtyToPick, 0);
      const errorMsg = totalAllocated < item.requestedQty ? `Stok kurang ${item.requestedQty - totalAllocated} pcs` : undefined;

      return {
        ...item,
        allocations: updatedAllocations,
        error: errorMsg
      };
    }));
  };

  // Remove a SKU row from allocation list entirely
  const handleRemoveSkoRow = (skuId: string) => {
    // Remove from pasted text as well to keep in sync
    const lines = pastedText.split('\n');
    const updatedLines = lines.filter(line => {
      const tokens = line.trim().split(/[\s\t,;]+/);
      return tokens[0]?.toUpperCase() !== skuId.toUpperCase();
    });
    setPastedText(updatedLines.join('\n'));
  };

  // Clear all form data
  const handleClearAll = () => {
    setPastedText('');
    setCustomer('');
    setAddress('');
    setNotes('');
    setCustomOrderNumber('');
    setPoNumber('');
    setFeedback(null);
  };

  // Load actual valid SKUs from inventory as example format
  const handleLoadExample = () => {
    const availableItems = inventory.filter(item => item.qty > 0);
    const uniqueSkus: { skuId: string; qty: number }[] = [];
    const seen = new Set<string>();

    for (const item of availableItems) {
      if (uniqueSkus.length >= 3) break;
      const skuUpper = item.skuId.toUpperCase();
      if (!seen.has(skuUpper)) {
        seen.add(skuUpper);
        const suggestedQty = Math.min(3, item.qty);
        uniqueSkus.push({ skuId: item.skuId, qty: suggestedQty });
      }
    }

    if (uniqueSkus.length > 0) {
      const templateText = uniqueSkus.map(u => `${u.skuId} ${u.qty}`).join('\n');
      setPastedText(templateText);
      setFeedback({
        type: 'success',
        message: 'Contoh format SKU valid dari daftar stok Anda berhasil dimuat!'
      });
    } else {
      setPastedText('SKI121 2\nANU001 3');
      setFeedback({
        type: 'success',
        message: 'Contoh format dimuat (stok kosong, menggunakan SKU bawaan).'
      });
    }
  };

  // Submit Bulk Outbound Order & Tasks
  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (allocationItems.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Tidak ada item yang dialokasikan untuk outbound.'
      });
      return;
    }

    const finalCustomer = customer.trim() || 'N/A';

    // Validate that we don't have errors or unallocated stock
    const hasErrors = allocationItems.some(item => !!item.error);
    if (hasErrors) {
      setFeedback({
        type: 'error',
        message: 'Ada masalah alokasi stok. Pastikan semua SKU memiliki alokasi yang cukup dan pas sebelum memproses.'
      });
      return;
    }

    const orderId = `ORD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}–${String(Math.floor(Math.random() * 900) + 100)}`;
    const orderNum = customOrderNumber.trim()
      ? customOrderNumber.trim()
      : `BEAUTY-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 90) + 10)}`;

    const itemsForOrder: OrderRecord['items'] = [];
    const matchingTasks: TransactionTask[] = [];

    allocationItems.forEach((item, idx) => {
      item.allocations.forEach((alloc, sIdx) => {
        if (alloc.qtyToPick <= 0) return;

        itemsForOrder.push({
          skuId: item.skuId,
          skuName: item.skuName,
          brand: item.brand,
          barcode: item.barcode,
          qty: alloc.qtyToPick,
          location: alloc.location,
          expiredDate: alloc.expiredDate,
          batchNumber: alloc.batchNumber || undefined
        });

        matchingTasks.push({
          id: `TSK-OUT-${orderNum.slice(-6)}-${String(idx + 1).padStart(2, '0')}${String(sIdx + 1).padStart(2, '0')}`,
          type: 'OUTBOUND',
          orderNumber: orderNum,
          skuId: item.skuId,
          skuName: item.skuName,
          barcode: item.barcode || '',
          qty: alloc.qtyToPick,
          qtyHandled: 0,
          location: alloc.location,
          warehouse: alloc.warehouse,
          status: 'PENDING',
          customerOrSupplier: finalCustomer,
          createdAt: new Date().toISOString(),
          operatorLogs: [{
            role: currentUser.role,
            operatorName: currentUser.name,
            action: `Tugas picking dibuat otomatis via alokasi masal. Lokasi rak: ${alloc.location}.`,
            timestamp: new Date().toISOString()
          }]
        });
      });
    });

    if (itemsForOrder.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Kuantitas total item harus lebih dari 0 pcs.'
      });
      return;
    }

    const formattedNotes = [
      poNumber.trim() ? `PO: ${poNumber.trim()}` : '',
      notes.trim() ? `Catatan: ${notes.trim()}` : '',
      `Validasi Packing: ${needsPacking ? 'Ya' : 'Tidak'}`
    ].filter(Boolean).join(' | ');

    const newOrder: OrderRecord = {
      id: orderId,
      orderNumber: orderNum,
      date: new Date().toLocaleDateString('id-ID'),
      customer: finalCustomer,
      items: itemsForOrder,
      status: 'NEW',
      shippingAddress: address.trim() || 'Gudang Utama',
      processedBy: currentUser.name,
      notes: formattedNotes,
      createdAt: new Date().toISOString()
    };

    // Store custom toggle inside each task so the picking process knows whether to skip checking/packing!
    const tasksWithValidationRule = matchingTasks.map(t => ({
      ...t,
      // Custom property dynamically injected
      needsPacking: needsPacking
    })) as TransactionTask[];

    onCreateOrder(newOrder, tasksWithValidationRule);

    // Clear forms and show feedback
    handleClearAll();
    setFeedback({
      type: 'success',
      message: `Sukses memproses outbound! Order ${orderNum} telah terdaftar dan ${matchingTasks.length} rute picking dikirim ke antrean Picker.`
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-pink-500" />
            Alur Input Order Penjualan & Alokasi Real-Time
          </h2>
          <p className="text-[11px] text-slate-500">Tulis data outbound secara masal. Sistem akan mengalokasikan rute picking terpendek berdasarkan FIFO secara otomatis.</p>
        </div>
        <div className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded border border-emerald-150 flex items-center gap-1.5 shrink-0">
          <Sparkles className="h-3.5 w-3.5 animate-pulse text-emerald-500" />
          Rute Cerdas FIFO & Batch Outbound: Aktif
        </div>
      </div>

      {/* Inline Feedback Banner */}
      {feedback && (
        <div className={`p-3.5 rounded-lg border text-xs flex justify-between items-start transition-all animate-in fade-in duration-200 ${
          feedback.type === 'error' 
            ? 'bg-pink-50 text-pink-900 border-pink-200' 
            : 'bg-emerald-50 text-emerald-900 border-emerald-200'
        }`}>
          <div className="flex items-start gap-2.5">
            {feedback.type === 'error' ? (
              <AlertTriangle className="h-4.5 w-4.5 text-pink-500 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-extrabold">{feedback.type === 'error' ? 'Peringatan Operasional' : 'Aktivitas Berhasil'}</p>
              <p className="text-slate-600 mt-0.5 leading-relaxed">{feedback.message}</p>
            </div>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 shrink-0 ml-3 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Left Inputs vs Right Real-time Allocations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column (Grid Span 5) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Card 1: Parameter Dokumen & Outbound */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4 shadow-3xs">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="p-1 bg-pink-50 text-pink-600 rounded-lg">
                <Hash className="h-4 w-4" />
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">PARAMETER DOKUMEN & OUTBOUND</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ORDER NUMBER</label>
                <input
                  type="text"
                  placeholder="Contoh: ORD-10029"
                  value={customOrderNumber}
                  onChange={(e) => setCustomOrderNumber(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 text-slate-700 bg-slate-50/50 font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">NO PO</label>
                  <input
                    type="text"
                    placeholder="Contoh: PO-9876"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 text-slate-700 bg-slate-50/50 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CUSTOMER NAME</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: PT. Kosmetik"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 text-slate-700 bg-slate-50/50 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ALAMAT PENGIRIMAN / TUJUAN</label>
                <input
                  type="text"
                  placeholder="Contoh: Jl. Mangga Dua No. 12, Surabaya"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 text-slate-700 bg-slate-50/50"
                />
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <input
                  id="needsPackingCheckbox"
                  type="checkbox"
                  checked={needsPacking}
                  onChange={(e) => setNeedsPacking(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-pink-600 focus:ring-pink-500 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="needsPackingCheckbox" className="select-none cursor-pointer">
                  <span className="block text-[11px] font-bold text-slate-800">Butuh Validasi Packing (Pending)</span>
                  <span className="block text-[9px] text-slate-400 mt-0.5">Order masuk antrean QC scan barang oleh Packer terlebih dahulu sebelum dikirim.</span>
                </label>
              </div>
            </div>
          </div>

          {/* Card 2: Input Data Outbound Bulk Mode */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-3xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-pink-50 text-pink-600 rounded-lg">
                  <ClipboardList className="h-4 w-4" />
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">INPUT DATA OUTBOUND (BULK MODE)</h3>
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleLoadExample}
                  className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer bg-emerald-50 border border-emerald-100 px-2 py-1 rounded"
                >
                  <Sparkles className="h-3 w-3" /> Muat Contoh Valid
                </button>
                <button
                  type="button"
                  onClick={downloadOrderTemplate}
                  className="text-[10px] text-slate-700 hover:text-slate-800 border border-slate-300 hover:bg-slate-50 font-bold flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded"
                >
                  <Download className="h-3 w-3 text-pink-500" /> Template
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10px] text-pink-600 hover:text-pink-700 font-bold flex items-center gap-1 cursor-pointer bg-pink-50 border border-pink-100 px-2 py-1 rounded"
                >
                  <Upload className="h-3 w-3" /> Impor Excel
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImportExcelOrder}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[9px] text-slate-400 hover:text-slate-600 font-bold border border-slate-200 px-2 py-1 rounded cursor-pointer"
                >
                  Hapus Semua
                </button>
              </div>
            </div>

            <textarea
              rows={8}
              placeholder="Format: SKU_ID Kuantitas&#10;Contoh:&#10;SKI121 2&#10;ANU001 3"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              className="w-full p-3 border-2 border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-mono bg-slate-900 text-emerald-400 outline-none focus:ring-1 focus:ring-emerald-500/25 leading-relaxed tracking-wider shadow-inner"
            />

            {/* Custom counters styled exactly like the second screenshot block */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-center">
                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">TOTAL BARIS</span>
                <span className="block text-sm font-black text-slate-700 font-mono mt-0.5">{totalRows}</span>
              </div>
              <div className="bg-emerald-50/50 border border-emerald-150 p-2 rounded-lg text-center">
                <span className="block text-[8px] font-black text-emerald-500 uppercase tracking-widest">VALID</span>
                <span className="block text-sm font-black text-emerald-600 font-mono mt-0.5">{validRows}</span>
              </div>
              <div className="bg-pink-50/50 border border-pink-150 p-2 rounded-lg text-center">
                <span className="block text-[8px] font-black text-pink-500 uppercase tracking-widest font-bold">ERROR</span>
                <span className="block text-sm font-black text-pink-600 font-mono mt-0.5">{errorRows}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Real-time Route Allocation List (Grid Span 7) */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-white border border-slate-200 rounded-xl shadow-3xs p-4 min-h-[500px]">
          
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-pink-50 text-pink-600 rounded-lg">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Hasil Alokasi Rute Picker Real-Time</h3>
              </div>
              <span className="text-[10px] text-emerald-600 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                Validasi Stok Bersih Otomatis
              </span>
            </div>

            {allocationItems.length === 0 ? (
              <div className="py-24 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <ShoppingCart className="h-10 w-10 text-slate-300 mx-auto mb-2 animate-bounce" />
                <p className="text-xs font-bold text-slate-600">Alokasi Kosong</p>
                <p className="text-[10px] px-2 mt-1 max-w-sm mx-auto">Tulis daftar SKU dan kuantitas pada panel kiri (Bulk Mode). Sistem akan mensimulasikan rute rak pengambilan secara real-time.</p>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
                {allocationItems.map((item, idx) => {
                  const totalAllocated = item.allocations.reduce((sum, a) => sum + a.qtyToPick, 0);
                  const isPerfectAllocation = totalAllocated === item.requestedQty && !item.error;
                  
                  return (
                    <div 
                      key={`${item.skuId}-${idx}`}
                      className={`p-3.5 border rounded-xl shadow-3xs relative bg-white transition-all ${
                        isPerfectAllocation 
                          ? 'border-slate-200' 
                          : 'border-pink-200 bg-pink-50/5'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-slate-900 text-emerald-400 font-mono font-black text-[10px] rounded border border-slate-800 uppercase shadow-3xs">
                            {item.skuId}
                          </span>
                          <span className="text-[10px] font-black text-slate-700 truncate max-w-[180px]" title={item.skuName}>
                            {item.skuName}
                          </span>
                          <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                            {item.brand}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-700">
                            Diminta: <strong className="text-slate-900 text-[11px]">{item.requestedQty}</strong> pcs
                          </span>
                          {isPerfectAllocation ? (
                            <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-black flex items-center gap-0.5 shrink-0">
                              ✓ Alokasi Lolos
                            </span>
                          ) : (
                            <span className="text-[9px] bg-pink-50 text-pink-600 border border-pink-100 px-2 py-0.5 rounded-full font-black flex items-center gap-0.5 shrink-0" title={item.error}>
                              ⚠️ {item.error || 'Ada Masalah'}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveSkoRow(item.skuId)}
                            className="text-slate-400 hover:text-pink-600 p-0.5 rounded transition-all cursor-pointer"
                            title="Hapus SKU ini"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Allocations location select cards list */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-wider">
                          <span>LOKASI PENGAMBILAN TERPILIH (RUTE PICKER):</span>
                          <button
                            type="button"
                            onClick={() => handleAddSplitLocation(item.skuId)}
                            className="text-[9px] text-pink-600 hover:text-pink-700 font-bold flex items-center gap-0.5"
                          >
                            + Tambah Lokasi
                          </button>
                        </div>

                        {item.allocations.map((alloc, aIdx) => {
                          const matchingInv = inventory.filter(i => i.skuId.toUpperCase() === item.skuId.toUpperCase() && i.qty > 0);
                          
                          return (
                            <div key={alloc.id} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                              {/* Selection dropdown */}
                              <div className="flex-1">
                                <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">PILIH LOKASI & EXP:</span>
                                <select
                                  value={alloc.inventoryItemId}
                                  onChange={(e) => handleLocationChange(item.skuId, alloc.id, e.target.value)}
                                  className="w-full p-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-pink-500"
                                >
                                  <option value="">-- Pilih Lokasi Stok --</option>
                                  {matchingInv.map(inv => (
                                    <option key={inv.id} value={inv.id}>
                                      Rak {inv.location} (Exp: {inv.expiredDate}) — Stok: {inv.qty} pcs {inv.batchNumber ? `[Batch: ${inv.batchNumber}]` : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Quantity and action row */}
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right">
                                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">QTY AMBIL:</span>
                                  <div className="flex items-center bg-white border border-slate-200 rounded">
                                    <button
                                      type="button"
                                      onClick={() => handleQtyChange(item.skuId, alloc.id, alloc.qtyToPick - 1)}
                                      className="px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 font-bold text-xs"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      value={alloc.qtyToPick}
                                      onChange={(e) => handleQtyChange(item.skuId, alloc.id, parseInt(e.target.value, 10) || 0)}
                                      className="w-8 text-center text-[10px] font-bold text-slate-700 outline-none font-mono"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleQtyChange(item.skuId, alloc.id, alloc.qtyToPick + 1)}
                                      className="px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 font-bold text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 self-end mb-1">pcs</span>

                                {item.allocations.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSplitRow(item.skuId, alloc.id)}
                                    className="p-1 hover:bg-pink-50 text-slate-400 hover:text-pink-600 rounded mt-3 cursor-pointer self-end mb-1"
                                    title="Hapus rute split ini"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Core submit button footer area */}
          <div className="border-t border-slate-100 pt-4 space-y-3 mt-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-black uppercase tracking-wider text-[9px]">Total Target Outbound:</span>
              <strong className="text-pink-600 font-mono text-base font-black">
                {allocationItems.reduce((acc, curr) => acc + curr.requestedQty, 0).toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-400">pcs</span>
              </strong>
            </div>

            <button
              type="button"
              onClick={handleSubmitOrder}
              disabled={allocationItems.length === 0 || allocationItems.some(i => !!i.error)}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 text-white font-extrabold text-xs rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="h-4 w-4" />
              PROSES MASSAL OUTBOUND ({allocationItems.length} SKU)
            </button>
            
            <p className="text-[9px] text-slate-400 text-center leading-tight">
              Dengan mengonfirmasi, stok fisik di rak akan langsung ditandai sebagai <strong>RESERVED (Teralokasi)</strong> dan tugas rute picking otomatis didistribusikan ke antrean operator.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
