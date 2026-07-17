import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { 
  History, 
  Search, 
  ChevronRight, 
  MapPin, 
  Truck, 
  Calendar, 
  CheckCircle2, 
  ArrowRight,
  PackageCheck,
  CircleDot,
  Trash2,
  Download,
  Printer,
  FileSpreadsheet,
  Sliders,
  Save,
  Eye
} from 'lucide-react';
import { OrderRecord, OrderStatus, InventoryItem, User } from '../types';

interface OrderHistoryViewProps {
  orders: OrderRecord[];
  inventory: InventoryItem[];
  currentUser: User;
  onDeleteOrder?: (orderId: string) => void;
}

export default function OrderHistoryView({
  orders,
  inventory,
  currentUser,
  onDeleteOrder,
}: OrderHistoryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(orders[0] || null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [printOrder, setPrintOrder] = useState<OrderRecord | null>(null);

  // Customizable Document Settings for Outbound DN (Surat Jalan)
  const [companyName, setCompanyName] = useState(() => localStorage.getItem('wms_dn_company_name') || 'Toko Kosmetik Sehat (TKS)');
  const [companyAddress, setCompanyAddress] = useState(() => localStorage.getItem('wms_dn_company_address') || 'Kawasan Pergudangan Logistik Blok B-12\nTangerang, Banten, Indonesia\nTelp: +62 21-555-8888');
  const [docTitle, setDocTitle] = useState(() => localStorage.getItem('wms_dn_doc_title') || 'SURAT JALAN & SLIP PENGEMASAN');
  const [showBrand, setShowBrand] = useState(() => localStorage.getItem('wms_dn_show_brand') !== 'false');
  const [showLocation, setShowLocation] = useState(() => localStorage.getItem('wms_dn_show_location') !== 'false');
  const [docFootnote, setDocFootnote] = useState(() => localStorage.getItem('wms_dn_doc_footnote') || 'Harap periksa kondisi fisik kosmetik sebelum menandatangani surat penerimaan ini.');
  const [sigName, setSigName] = useState(() => localStorage.getItem('wms_dn_sig_name') || 'Checker Gudang');
  const [sigManager, setSigManager] = useState(() => localStorage.getItem('wms_dn_sig_manager') || 'Kepala Gudang');

  const saveDocSettings = () => {
    localStorage.setItem('wms_dn_company_name', companyName);
    localStorage.setItem('wms_dn_company_address', companyAddress);
    localStorage.setItem('wms_dn_doc_title', docTitle);
    localStorage.setItem('wms_dn_show_brand', String(showBrand));
    localStorage.setItem('wms_dn_show_location', String(showLocation));
    localStorage.setItem('wms_dn_doc_footnote', docFootnote);
    localStorage.setItem('wms_dn_sig_name', sigName);
    localStorage.setItem('wms_dn_sig_manager', sigManager);
    toast.success('Konfigurasi surat jalan berhasil disimpan!');
  };

  const filteredOrders = orders.filter(order => 
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) return;
    
    // Define CSV Headers
    const headers = [
      'ID Order',
      'Nomor Invoice',
      'Penerima / Toko',
      'Tanggal Masuk',
      'Status Order',
      'Total Item (pcs)',
      'Detail Barang SKU',
      'Alamat Pengiriman',
      'Notes / Keterangan',
      'Petugas Pemroses'
    ];
    
    // Map filtered orders to CSV rows
    const rows = filteredOrders.map(order => {
      const itemsDetail = order.items.map(it => `${it.skuName} (${it.qty}pcs)`).join('; ');
      const totalQty = order.items.reduce((sum, it) => sum + it.qty, 0);
      
      return [
        order.id,
        order.orderNumber,
        `"${order.customer.replace(/"/g, '""')}"`,
        order.date,
        order.status,
        totalQty.toString(),
        `"${itemsDetail.replace(/"/g, '""')}"`,
        `"${(order.shippingAddress || '').replace(/"/g, '""')}"`,
        `"${(order.notes || '').replace(/"/g, '""')}"`,
        `"${(order.processedBy || '').replace(/"/g, '""')}"`
      ];
    });
    
    // Prefix UTF-8 BOM so MS Excel renders Indonesian accents and formatting correctly
    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Laporan_Order_BeautyWMS_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Auto-select first order if none is selected or if the selected one is no longer in the list
  React.useEffect(() => {
    if (filteredOrders.length > 0) {
      const isStillAvailable = filteredOrders.some(o => o.id === selectedOrder?.id);
      if (!isStillAvailable) {
        setSelectedOrder(filteredOrders[0]);
      }
    } else {
      setSelectedOrder(null);
    }
  }, [filteredOrders, selectedOrder]);

  React.useEffect(() => {
    setShowDeleteConfirm(false);
  }, [selectedOrder]);

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'NEW':
        return <span className="px-2 py-0.5 bg-pink-50 text-pink-600 border border-pink-100 text-[9px] font-bold rounded">Baru (New)</span>;
      case 'PROCESSING':
        return <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-bold rounded">Diproses</span>;
      case 'PICKING':
        return <span className="px-2 py-0.5 bg-orange-50 text-orange-600 border border-orange-200 text-[9px] font-bold rounded">Sedang Pick</span>;
      case 'PACKED':
        return <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 text-[9px] font-bold rounded">Selesai Pack</span>;
      case 'SHIPPED':
        return <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-200 text-[9px] font-bold rounded">Dikirim</span>;
      case 'COMPLETED':
        return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[9px] font-bold rounded">Selesai (Done)</span>;
    }
  };

  // Determine stage levels for timeline (0 to 4)
  const getTimelineStage = (status: OrderStatus) => {
    switch (status) {
      case 'NEW': return 1;
      case 'PROCESSING': return 2;
      case 'PICKING': return 2;
      case 'PACKED': return 3;
      case 'SHIPPED': return 4;
      case 'COMPLETED': return 4;
      default: return 1;
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider">Riwayat & Status Order (Outbound)</h2>
          <p className="text-[11px] text-slate-500">Pantau proses pemenuhan pesanan dari pembentukan invoice awal hingga pengiriman akhir.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider rounded shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="Ekspor seluruh daftar transaksi yang terfilter ke Excel/CSV"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Ekspor CSV
          </button>
          <div className="text-[10px] font-mono bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded text-slate-600">
            Total Order: {orders.length} Transaksi
          </div>
        </div>
      </div>

      {/* Search Order bar */}
      <div className="bg-white p-3 rounded border border-slate-200 relative">
        <span className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-400">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="text"
          placeholder="Cari nomor order atau nama toko penerima..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-pink-500 focus:border-pink-500 outline-none text-slate-700 bg-slate-50/50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left column: Order items card list */}
        <div className="lg:col-span-2 space-y-2.5">
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-white border border-slate-200 rounded">
              <History className="h-8 w-8 text-slate-300 mx-auto mb-1" />
              <p className="font-bold text-slate-700">Order Tidak Ditemukan</p>
              <p className="text-[10px] mt-0.5">Coba cari dengan nomor invoice atau nama toko lain.</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div 
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`p-3 rounded border bg-white transition-all cursor-pointer flex justify-between items-center ${
                  selectedOrder?.id === order.id 
                    ? 'border-pink-500 ring-1 ring-pink-500/15 shadow-2xs' 
                    : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-xs text-slate-800">{order.orderNumber}</span>
                    {getStatusBadge(order.status)}
                  </div>
                  <p className="text-xs font-bold text-slate-700 mt-1.5 truncate max-w-[240px] sm:max-w-xs">{order.customer}</p>
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-450" /> Tanggal Masuk: {order.date}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold border border-slate-200/50">
                      {order.items.reduce((sum, item) => sum + item.qty, 0)} pcs ({order.items.length} SKU)
                    </span>
                    <p className="text-[9px] text-slate-400 mt-1">Oleh: {order.processedBy}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right column: Interactive Tracker timeline */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs h-fit sticky top-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
            <h3 className="font-bold uppercase tracking-wider text-slate-800 text-xs">Visual Order Tracker</h3>
            <span className="text-[9px] bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded font-mono font-extrabold border border-pink-100/50">Live RFID</span>
          </div>

          {!selectedOrder ? (
            <div className="py-10 text-center text-slate-400 border border-dashed border-slate-200 rounded bg-slate-50/50">
              <History className="h-6 w-6 text-slate-300 mx-auto mb-1" />
              <p className="text-xs font-semibold text-slate-600">Pilih Tiket Order</p>
              <p className="text-[9px] px-2 mt-0.5">Pilih salah satu order di sebelah kiri untuk melihat histori timeline real-time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Core detail summary */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs space-y-0.5 relative">
                <div className="flex justify-between items-start gap-1">
                  <div>
                    <p className="font-mono text-[9px] text-slate-400">INVOICE: {selectedOrder.orderNumber}</p>
                    <p className="font-bold text-slate-800">{selectedOrder.customer}</p>
                  </div>
                  <button
                    onClick={() => setPrintOrder(selectedOrder)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 text-[9px] font-bold text-slate-700 rounded shadow-3xs flex items-center gap-1 cursor-pointer transition-all shrink-0"
                    title="Cetak Surat Jalan / Slip Pengemasan"
                  >
                    <Printer className="h-3 w-3 text-pink-500" />
                    Cetak
                  </button>
                </div>
                <p className="text-slate-500 text-[10px] flex items-center gap-1 pt-1">
                  <MapPin className="h-3 w-3 text-pink-500 shrink-0" />
                  <span className="truncate" title={selectedOrder.shippingAddress}>{selectedOrder.shippingAddress}</span>
                </p>
                {selectedOrder.notes && (
                  <p className="text-[9px] text-slate-400 italic mt-1.5 bg-white p-1.5 rounded border border-slate-100">Keterangan: {selectedOrder.notes}</p>
                )}
              </div>

              {/* Items listing */}
              <div>
                <span className="text-[9px] font-bold text-slate-450 uppercase block tracking-wider mb-1.5">Item Belanja ({selectedOrder.items.length})</span>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {selectedOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2 rounded text-xs">
                      <div className="truncate pr-2">
                        <span className="font-semibold text-slate-700 block truncate text-[11px]">{it.skuName}</span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          Rak: {it.location} | Brand: {it.brand}
                          {it.boxNumber && <span className="ml-1.5 px-1 py-0.2 bg-pink-100 text-pink-700 rounded font-black text-[8px] uppercase">Box #{it.boxNumber}</span>}
                        </span>
                      </div>
                      <strong className="text-slate-800 font-mono shrink-0 text-[10px]">{it.qty} pcs</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Graphical vertical progress timeline */}
              <div className="space-y-3.5">
                <span className="text-[9px] font-bold text-slate-450 uppercase block tracking-wider">Status Perjalanan Paket</span>
                
                <div className="relative pl-4 space-y-4 border-l-2 border-slate-100">
                  {/* Stage 1: Order Entered */}
                  <div className="relative">
                    <div className="absolute -left-[22px] top-0.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 bg-white" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Order Terdaftar</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Invoice baru masuk. Menunggu alokasi dan picking.</p>
                    </div>
                  </div>

                  {/* Stage 2: Picking */}
                  <div className="relative">
                    <div className="absolute -left-[22px] top-0.5">
                      {getTimelineStage(selectedOrder.status) >= 2 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 bg-white" />
                      ) : (
                        <CircleDot className="h-4 w-4 text-slate-300 bg-white" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Barang Selesai Diambil (Picked)</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Picker telah mengambil barang di rak lokasi sesuai rute FIFO.</p>
                    </div>
                  </div>

                  {/* Stage 3: Packaging */}
                  <div className="relative">
                    <div className="absolute -left-[22px] top-0.5">
                      {getTimelineStage(selectedOrder.status) >= 3 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 bg-white" />
                      ) : (
                        <CircleDot className="h-4 w-4 text-slate-300 bg-white" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Selesai QC & Packing</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Kemasan terbungkus bubblewrap. Segel karton dan label resi tercetak.</p>
                    </div>
                  </div>

                  {/* Stage 4: Out to dispatch */}
                  <div className="relative">
                    <div className="absolute -left-[22px] top-0.5">
                      {getTimelineStage(selectedOrder.status) >= 4 ? (
                        <Truck className="h-4 w-4 text-emerald-600 bg-white" />
                      ) : (
                        <CircleDot className="h-4 w-4 text-slate-300 bg-white" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Diserahkan ke Kurir Ekspedisi</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Paket berada di loading dock outbound. Truk kurir melakukan pickup jalan.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Admin Deletion Action */}
              {currentUser.role === 'ADMIN' && (
                <div className="pt-4 border-t border-slate-150">
                  <span className="text-[9px] font-extrabold text-pink-600 uppercase tracking-wider block mb-2">Panel Kontrol Admin</span>
                  
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300 font-bold text-xs rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Batal & Hapus Order (Kembalikan Stok)
                    </button>
                  ) : (
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-xs space-y-2.5 animate-fadeIn">
                      <p className="font-bold text-red-800 flex items-center gap-1">
                        ⚠️ Konfirmasi Pembatalan
                      </p>
                      <p className="text-[10px] text-red-700 leading-relaxed">
                        Apakah Anda yakin ingin membatalkan & menghapus order <strong>{selectedOrder.orderNumber}</strong>? 
                        Seluruh item sebanyak <strong>{selectedOrder.items.reduce((sum, item) => sum + item.qty, 0)} pcs</strong> akan otomatis dikembalikan ke lokasi penyimpanan di rak semula (FIFO reversal).
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            onDeleteOrder?.(selectedOrder.id);
                            setShowDeleteConfirm(false);
                          }}
                          className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] rounded transition-all cursor-pointer shadow-2xs"
                        >
                          Ya, Hapus & Restock
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10px] rounded transition-all cursor-pointer shadow-2xs"
                        >
                          Kembali
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Printable Surat Jalan / Invoice Modal Overlay */}
      {printOrder && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          {/* Inject print-specific styles to hide main app during browser print dialog */}
          <style dangerouslySetInnerHTML={{__html: `
            @page {
              size: A4 portrait;
              margin: 10mm 15mm 10mm 15mm;
            }
            @media print {
              /* Hide main React app layout completely */
              #root {
                display: none !important;
              }
              
              /* Reset body styles for clean standard print layout */
              body {
                background: white !important;
                color: black !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
              }

              /* Reset portal wrapper element to block & static */
              body > div:not(#root) {
                display: block !important;
                position: static !important;
                background: white !important;
                color: black !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
              }

              /* Hide configurator, preview controls and buttons */
              .no-print {
                display: none !important;
              }

              /* Reset absolute & fixed overlay positions for printer rendering */
              .fixed.inset-0 {
                position: static !important;
                display: block !important;
                background: transparent !important;
                padding: 0 !important;
                margin: 0 !important;
                overflow: visible !important;
                width: auto !important;
                height: auto !important;
              }

              .max-w-5xl {
                max-width: none !important;
                width: 100% !important;
                box-shadow: none !important;
                border: none !important;
                background: white !important;
                display: block !important;
                height: auto !important;
                overflow: visible !important;
              }

              .bg-slate-100 {
                background: white !important;
              }

              .flex-1 {
                flex: none !important;
                display: block !important;
                height: auto !important;
                overflow: visible !important;
              }

              .no-print-padding {
                padding: 0 !important;
                margin: 0 !important;
                background: white !important;
                overflow: visible !important;
                display: block !important;
                height: auto !important;
              }

              #printable-invoice-area {
                position: static !important;
                width: 100% !important;
                max-width: 100% !important;
                padding: 1cm !important;
                margin: 0 !important;
                box-shadow: none !important;
                border: none !important;
                background: white !important;
                color: black !important;
                display: block !important;
                overflow: visible !important;
                height: auto !important;
              }
            }
          `}} />

          <div className="bg-slate-100 rounded-xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col md:flex-row h-[85vh]">
            
            {/* Left Column: Live Configurator Form (no-print) */}
            <div className="w-full md:w-80 bg-slate-900 text-white p-5 flex flex-col justify-between overflow-y-auto border-r border-slate-800 shrink-0 no-print">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Sliders className="h-4 w-4 text-pink-400 animate-spin" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider">Konfig Surat Jalan</h3>
                    <p className="text-[9px] text-slate-400">Atur kop & footer cetakan secara live</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Judul Dokumen</label>
                    <input 
                      type="text" 
                      value={docTitle} 
                      onChange={(e) => setDocTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-pink-500 transition-all font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Nama Pengirim (Perusahaan)</label>
                    <input 
                      type="text" 
                      value={companyName} 
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-pink-500 transition-all font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Alamat Pengirim</label>
                    <textarea 
                      rows={3}
                      value={companyAddress} 
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-pink-500 transition-all font-mono leading-tight"
                    />
                  </div>

                  <div className="space-y-1.5 py-1 border-t border-b border-slate-800/80 my-2">
                    <label className="flex items-center gap-2 cursor-pointer py-0.5">
                      <input 
                        type="checkbox" 
                        checked={showBrand} 
                        onChange={(e) => setShowBrand(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-800 text-pink-500 focus:ring-0"
                      />
                      <span className="text-[10px] text-slate-300 font-medium">Tampilkan Kolom Brand</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer py-0.5">
                      <input 
                        type="checkbox" 
                        checked={showLocation} 
                        onChange={(e) => setShowLocation(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-800 text-pink-500 focus:ring-0"
                      />
                      <span className="text-[10px] text-slate-300 font-medium">Tampilkan Kolom Lokasi Rak</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Catatan Kaki (Footnote)</label>
                    <textarea 
                      rows={2}
                      value={docFootnote} 
                      onChange={(e) => setDocFootnote(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-pink-500 transition-all italic leading-tight"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Nama Checker (QC)</label>
                    <input 
                      type="text" 
                      value={sigName} 
                      onChange={(e) => setSigName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-pink-500 transition-all font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Jabatan Pimpinan</label>
                    <input 
                      type="text" 
                      value={sigManager} 
                      onChange={(e) => setSigManager(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-pink-500 transition-all font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={saveDocSettings}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg active:scale-97"
                >
                  <Save className="h-3.5 w-3.5" />
                  Simpan Jadi Default
                </button>
              </div>
            </div>

            {/* Right Column: Preview Area & Actions */}
            <div className="flex-1 flex flex-col bg-white overflow-hidden">
              
              {/* Header controls bar (will not print) */}
              <div className="bg-slate-850 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between text-slate-800 no-print">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700">Preview Kertas Cetakan</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-1.5 bg-pink-600 hover:bg-pink-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-md flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Cetak Surat Jalan
                  </button>
                  <button
                    onClick={() => setPrintOrder(null)}
                    className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] uppercase tracking-wider rounded-md cursor-pointer transition-all"
                  >
                    Tutup Preview
                  </button>
                </div>
              </div>

              {/* Printable Area content (simulated paper sheet inside previewer, fills whole area on real print) */}
              <div className="flex-1 overflow-y-auto bg-slate-200 p-6 md:p-10 no-print-padding">
                <div className="w-[210mm] max-w-full min-h-[297mm] mx-auto bg-white p-8 md:p-12 shadow-xl border border-slate-300 rounded-sm" id="printable-invoice-area">
                  
                  {/* Slip Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
                    <div>
                      <h1 className="text-lg font-black tracking-tight text-slate-950 uppercase leading-snug">{docTitle}</h1>
                      <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mt-1">BEAUTYWMS.ID - {companyName}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Sistem Manajemen Logistik Kosmetik & Skincare Sehat</p>
                    </div>
                    <div className="text-right">
                      {/* Pseudo Barcode block */}
                      <div className="inline-block p-1 bg-slate-100 border border-slate-300 rounded mb-1">
                        <div className="flex gap-[1.5px] items-stretch h-6 w-32 bg-slate-950">
                          <div className="w-[1px] bg-white h-full" />
                          <div className="w-[3px] bg-white h-full" />
                          <div className="w-[2px] bg-white h-full" />
                          <div className="w-[4px] bg-white h-full" />
                          <div className="w-[1px] bg-white h-full" />
                          <div className="w-[2px] bg-white h-full" />
                          <div className="w-[3px] bg-white h-full" />
                          <div className="w-[1px] bg-white h-full" />
                          <div className="w-[2px] bg-white h-full" />
                          <div className="w-[4px] bg-white h-full" />
                          <div className="w-[1px] bg-white h-full" />
                        </div>
                        <span className="block text-[8px] font-mono text-slate-600 tracking-widest text-center mt-0.5">{printOrder.orderNumber}</span>
                      </div>
                    </div>
                  </div>

                  {/* Sender & Receiver Info columns */}
                  <div className="grid grid-cols-2 gap-6 py-4 text-xs border-b border-slate-200">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Pengirim:</span>
                      <p className="font-extrabold text-slate-800">{companyName}</p>
                      <p className="text-slate-500 text-[10px] leading-relaxed whitespace-pre-line">
                        {companyAddress}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Tujuan Pengiriman / Penerima:</span>
                      <p className="font-extrabold text-slate-800">{printOrder.customer}</p>
                      <p className="text-slate-500 text-[10px] leading-relaxed whitespace-pre-line">
                        {printOrder.shippingAddress || 'Alamat tidak tertera.'}
                      </p>
                    </div>
                  </div>

                  {/* Metadata details list */}
                  <div className="grid grid-cols-3 gap-4 py-3 bg-slate-50 border border-slate-200/60 rounded-lg p-3 text-xs my-4">
                    <div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">No. Invoice / Resi</span>
                      <span className="font-mono font-extrabold text-slate-800">{printOrder.orderNumber}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Tanggal Order</span>
                      <span className="font-semibold text-slate-700">{printOrder.date}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Petugas Pemroses</span>
                      <span className="font-semibold text-slate-700">{printOrder.processedBy || 'Sistem'}</span>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="mt-4">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b-2 border-slate-800 text-[10px] font-bold uppercase text-slate-500">
                          <th className="py-2 pl-1 w-8 text-center">No</th>
                          <th className="py-2">Deskripsi SKU Kosmetik</th>
                          {showLocation && <th className="py-2 text-center w-24">Lokasi Rak</th>}
                          {showBrand && <th className="py-2 text-center w-24">Brand</th>}
                          <th className="py-2 text-center w-16">Qty</th>
                          <th className="py-2 text-center w-12">QC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printOrder.items.map((item, index) => (
                          <tr key={index} className="border-b border-slate-200 hover:bg-slate-50/50">
                            <td className="py-2.5 text-center font-mono text-slate-400">{index + 1}</td>
                            <td className="py-2.5">
                              <span className="font-bold text-slate-800 block">{item.skuName}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] text-slate-400 font-mono">SKU: {item.skuId}</span>
                                {item.boxNumber && (
                                  <span className="bg-pink-100 text-pink-700 px-1 py-0.5 rounded font-black text-[7px] uppercase tracking-wider">
                                    BOX #{item.boxNumber}
                                  </span>
                                )}
                              </div>
                            </td>
                            {showLocation && <td className="py-2.5 text-center font-mono font-bold text-slate-700 bg-slate-50/50">{item.location}</td>}
                            {showBrand && <td className="py-2.5 text-center text-slate-500 font-medium">{item.brand}</td>}
                            <td className="py-2.5 text-center font-mono font-black text-slate-800">{item.qty} pcs</td>
                            <td className="py-2.5 text-center">
                              <div className="w-4 h-4 border border-slate-400 rounded-sm mx-auto" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Total Summary */}
                  <div className="flex justify-between items-start mt-6 pt-4 border-t-2 border-slate-800">
                    <div className="text-[10px] text-slate-400 space-y-2 max-w-md">
                      {printOrder.notes && (
                        <p className="italic bg-slate-50 p-2 rounded border border-slate-100">
                          Keterangan / Pesan: {printOrder.notes}
                        </p>
                      )}
                      {docFootnote && (
                        <p className="text-slate-500 leading-normal italic font-semibold">
                          * {docFootnote}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs shrink-0 pl-4">
                      <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Total Kuantitas:</span>
                      <p className="text-lg font-black text-slate-900 font-mono">
                        {printOrder.items.reduce((sum, item) => sum + item.qty, 0)} Pcs
                      </p>
                    </div>
                  </div>

                  {/* Signatures Footer */}
                  <div className="grid grid-cols-3 gap-4 text-center text-xs mt-12 pt-8 border-t border-slate-100">
                    <div className="space-y-12">
                      <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Diserahkan Oleh (Driver/Kurir)</span>
                      <div className="border-b border-slate-300 w-32 mx-auto" />
                      <span className="text-slate-500 font-medium block">(........................................)</span>
                    </div>
                    <div className="space-y-12">
                      <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Dicheck Oleh ({sigName})</span>
                      <div className="border-b border-slate-300 w-32 mx-auto" />
                      <span className="text-slate-500 font-medium block">({printOrder.processedBy || sigName})</span>
                    </div>
                    <div className="space-y-12">
                      <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Mengetahui ({sigManager})</span>
                      <div className="border-b border-slate-300 w-32 mx-auto" />
                      <span className="text-slate-500 font-medium block">(Admin Utama)</span>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
