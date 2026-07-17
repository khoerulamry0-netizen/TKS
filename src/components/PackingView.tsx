import React, { useState } from 'react';
import { 
  Box, 
  Printer, 
  CheckCircle2, 
  Layers, 
  Sparkles, 
  AlertCircle,
  Truck,
  ArrowLeft,
  Check,
  Search,
  MapPin,
  Calendar,
  X,
  Barcode,
  Camera
} from 'lucide-react';
import { TransactionTask, OrderRecord, User, InventoryItem } from '../types';
import CameraScanner from './CameraScanner';
import { toast } from 'sonner';

interface PackingViewProps {
  tasks: TransactionTask[];
  orders: OrderRecord[];
  inventory: InventoryItem[];
  currentUser: User;
  onUpdateTask: (task: TransactionTask) => void;
  onUpdateOrder: (order: OrderRecord) => void;
}

export default function PackingView({
  tasks,
  orders,
  inventory,
  currentUser,
  onUpdateTask,
  onUpdateOrder,
}: PackingViewProps) {
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  
  // Packing configuration
  const [boxSize, setBoxSize] = useState<'Karton S' | 'Karton M' | 'Karton L'>('Karton M');
  const [boxNumber, setBoxNumber] = useState('1');
  const [useBubbleWrap, setUseBubbleWrap] = useState(true);
  const [printingLabel, setPrintingLabel] = useState(false);
  const [printedLabelData, setPrintedLabelData] = useState<any | null>(null);

  // Packer Scanner states
  const [packerScanText, setPackerScanText] = useState('');
  const [packerScanFeedback, setPackerScanFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sound effect helper
  const playBeep = (type: 'success' | 'error') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime); // Low buzz
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.25);
      }
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  // Track physical verification of items inside the selected PO (taskId -> boolean)
  const [verifiedItems, setVerifiedItems] = useState<Record<string, boolean>>({});
  // Track box number for each item inside the selected PO (taskId -> string)
  const [itemBoxNumbers, setItemBoxNumbers] = useState<Record<string, string>>({});

  // 1. Filter outbound tasks in 'CHECKING' status (picked, awaiting packing)
  const activePackingTasks = tasks.filter(task => 
    task.type === 'OUTBOUND' && task.status === 'CHECKING'
  );

  // 2. Group these active tasks by orderNumber
  const checkingTasksByOrder = activePackingTasks.reduce((acc, task) => {
    const orderNum = task.orderNumber || 'UNKNOWN';
    if (!acc[orderNum]) {
      acc[orderNum] = [];
    }
    acc[orderNum].push(task);
    return acc;
  }, {} as Record<string, TransactionTask[]>);

  const orderNumbersInQueue = Object.keys(checkingTasksByOrder);

  // 3. Handle selection of a PO/Order
  const handleSelectOrder = (orderNum: string) => {
    setSelectedOrderNumber(orderNum);
    setPrintedLabelData(null);
    setBoxNumber('1');
    
    // Initialize verification state: set all tasks of this order as unverified initially
    const orderTasks = checkingTasksByOrder[orderNum] || [];
    const newVerified: Record<string, boolean> = {};
    const newBoxNumbers: Record<string, string> = {};
    orderTasks.forEach(t => {
      newVerified[t.id] = false;
      newBoxNumbers[t.id] = '1';
    });
    setVerifiedItems(newVerified);
    setItemBoxNumbers(newBoxNumbers);
  };

  const handleToggleVerifyItem = (taskId: string) => {
    setVerifiedItems(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const handleVerifyAllItems = () => {
    if (!selectedOrderNumber) return;
    const orderTasks = checkingTasksByOrder[selectedOrderNumber] || [];
    const newVerified: Record<string, boolean> = {};
    orderTasks.forEach(t => {
      newVerified[t.id] = true;
    });
    setVerifiedItems(newVerified);
  };

  const verifyCode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    // Search product in inventory to see if it's a known SKU or Barcode
    const upperCode = trimmed.toUpperCase();
    const product = inventory.find(
      item => item.skuId.toUpperCase() === upperCode || item.barcode === trimmed
    );

    // Identify target SKU ID
    const targetSkuId = product ? product.skuId.toUpperCase() : upperCode;

    // Look for matching task inside the currently selected order's tasks
    const orderTasks = selectedOrderNumber ? (checkingTasksByOrder[selectedOrderNumber] || []) : [];
    const matchingTask = orderTasks.find(t => t.skuId.toUpperCase() === targetSkuId);

    if (matchingTask) {
      const isAlreadyVerified = !!verifiedItems[matchingTask.id];
      setVerifiedItems(prev => ({
        ...prev,
        [matchingTask.id]: true
      }));
      playBeep('success');
      setPackerScanFeedback({
        type: 'success',
        message: isAlreadyVerified
          ? `SKU "${matchingTask.skuId}" sudah terverifikasi sebelumnya.`
          : `SCAN BERHASIL: SKU "${matchingTask.skuId}" (${matchingTask.skuName}) Terverifikasi!`
      });
      toast.success(`QC OK: SKU ${matchingTask.skuId} terverifikasi`);
    } else {
      playBeep('error');
      setPackerScanFeedback({
        type: 'error',
        message: `SALAH BARANG! Kode "${trimmed}" tidak terdaftar dalam No. PO ini!`
      });
      toast.error(`SALAH BARANG: "${trimmed}" tidak terdaftar`);
    }
  };

  const handlePackerScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyCode(packerScanText);
    setPackerScanText('');
  };

  // 4. Handle complete packing and generate unified shipping label
  const handlePrintAndComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderNumber) return;

    const orderTasks = checkingTasksByOrder[selectedOrderNumber] || [];
    if (orderTasks.length === 0) return;

    setPrintingLabel(true);

    // Simulate printing label delay
    setTimeout(() => {
      setPrintingLabel(false);
      
      const parentOrder = orders.find(o => o.orderNumber === selectedOrderNumber);
      const customerName = parentOrder?.customer || orderTasks[0]?.customerOrSupplier || 'N/A';
      const shippingAddress = parentOrder?.shippingAddress || 'Gudang Utama';

      const label = {
        awb: `AWB-BEAUTY-${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        orderNumber: selectedOrderNumber,
        customer: customerName,
        address: shippingAddress,
        items: orderTasks.map(t => ({
          skuId: t.skuId,
          skuName: t.skuName,
          qty: t.qty,
          boxNumber: itemBoxNumbers[t.id] || '1'
        })),
        box: boxSize,
        boxNumber: boxNumber || '1',
        bubble: useBubbleWrap ? 'Ya (Double)' : 'Tidak',
        packer: currentUser.name,
        date: new Date().toLocaleDateString('id-ID'),
      };

      setPrintedLabelData(label);

      // A. Update all active tasks of this order to COMPLETED
      orderTasks.forEach(task => {
        const itemBox = itemBoxNumbers[task.id] || '1';
        const updatedTask: TransactionTask = {
          ...task,
          status: 'COMPLETED',
          assignedPackerId: currentUser.id,
          boxNumber: itemBox,
          operatorLogs: [
            ...task.operatorLogs,
            {
              role: currentUser.role,
              operatorName: currentUser.name,
              action: `Selesai QC & Packing PO ${selectedOrderNumber} dengan kemasan ${boxSize} (Item ${task.skuId} di Box ke-${itemBox}, Bubblewrap: ${useBubbleWrap ? 'Ya' : 'Tidak'}). Label cetak keluar.`,
              timestamp: new Date().toISOString()
            }
          ]
        };
        onUpdateTask(updatedTask);
      });

      // B. Update associated OrderRecord in history
      if (parentOrder) {
        // Find if there are other tasks for this order that are NOT completed yet
        const otherTasksNotCompleted = tasks.filter(t => 
          t.orderNumber === selectedOrderNumber && 
          t.status !== 'COMPLETED' && 
          !orderTasks.some(ot => ot.id === t.id)
        );
        const allDone = otherTasksNotCompleted.length === 0;

        const updatedOrderItems = parentOrder.items.map(item => {
          // Find matching task inside the orderTasks
          const matchedTask = orderTasks.find(t => t.skuId === item.skuId);
          if (matchedTask) {
            return {
              ...item,
              boxNumber: itemBoxNumbers[matchedTask.id] || '1'
            };
          }
          return item;
        });

        const updatedOrder: OrderRecord = {
          ...parentOrder,
          items: updatedOrderItems,
          status: allDone ? 'COMPLETED' : 'PACKED',
          processedBy: currentUser.name
        };
        onUpdateOrder(updatedOrder);
      }
    }, 1200);
  };

  // Get active items for currently selected order
  const currentOrderTasks = selectedOrderNumber ? (checkingTasksByOrder[selectedOrderNumber] || []) : [];
  const allVerified = currentOrderTasks.length > 0 && currentOrderTasks.every(t => !!verifiedItems[t.id]);
  
  // Find metadata of currently selected order
  const selectedOrderMeta = selectedOrderNumber ? orders.find(o => o.orderNumber === selectedOrderNumber) : null;
  const currentCustomerName = selectedOrderMeta?.customer || currentOrderTasks[0]?.customerOrSupplier || 'N/A';
  const currentShippingAddress = selectedOrderMeta?.shippingAddress || 'Gudang Utama';

  // Filtered order numbers in queue based on search
  const filteredOrderNumbers = orderNumbersInQueue.filter(orderNum => {
    const parent = orders.find(o => o.orderNumber === orderNum);
    const customerName = parent?.customer || checkingTasksByOrder[orderNum]?.[0]?.customerOrSupplier || '';
    
    return orderNum.toLowerCase().includes(searchQuery.toLowerCase()) || 
           customerName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Box className="h-5 w-5 text-pink-500" />
            Proses Pengemasan Masal (Packing by PO)
          </h2>
          <p className="text-[11px] text-slate-500 font-medium text-pink-600">Khusus Peran: PACKER / ADMIN</p>
        </div>
        <div className="text-[10px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
          Antrean PO Siap Kemas: {orderNumbersInQueue.length} PO
        </div>
      </div>

      {currentUser.role !== 'PACKER' && currentUser.role !== 'ADMIN' && (
        <div className="p-3 bg-amber-50 text-amber-900 rounded border border-amber-200 text-xs flex items-start gap-2">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 text-amber-600 mt-0.5" />
          <p className="leading-relaxed">
            Akses Terbatas: Anda login sebagai <strong>{currentUser.role}</strong>. Untuk memproses dan mensimulasikan tugas audit quality-control dan pencetakan label packing, silakan ganti peran menjadi <strong>PACKER</strong> atau <strong>ADMIN</strong> di menu <strong>Akun & Peran</strong>.
          </p>
        </div>
      )}

      {/* WORKSPACE LAYOUT */}
      {!selectedOrderNumber ? (
        /* ================= QUEUE VIEW ================= */
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded border border-slate-200 flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative w-full sm:max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-slate-400" />
              </span>
              <input
                type="text"
                placeholder="Cari berdasarkan No. PO atau nama Customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500/25 bg-white text-slate-800"
              />
            </div>
            <p className="text-[11px] text-slate-400 font-medium sm:ml-auto">
              Sistem mendeteksi item yang sudah lolos Picking dan siap di-QC dalam box tunggal per PO.
            </p>
          </div>

          {/* PO List Grid */}
          {filteredOrderNumbers.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <Box className="h-12 w-12 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">Tidak ada Antrean Packing</p>
              <p className="text-xs mt-1 text-slate-500">
                {searchQuery ? 'Tidak ada nomor PO yang cocok dengan pencarian Anda.' : 'Semua PO yang dipick sudah selesai dipack & dicap label kirim.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredOrderNumbers.map((orderNum) => {
                const orderTasks = checkingTasksByOrder[orderNum];
                const totalQty = orderTasks.reduce((sum, t) => sum + t.qty, 0);
                const parent = orders.find(o => o.orderNumber === orderNum);
                const customer = parent?.customer || orderTasks[0]?.customerOrSupplier || 'N/A';
                const address = parent?.shippingAddress || 'Gudang Utama';
                const orderDate = parent?.date || new Date().toLocaleDateString('id-ID');

                return (
                  <div 
                    key={orderNum}
                    className="bg-white border border-slate-200 rounded-xl hover:border-pink-500/50 hover:shadow-sm transition-all p-4 flex flex-col justify-between space-y-3.5 group"
                  >
                    <div>
                      {/* Top badges */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-0.5">
                          <span className="font-mono font-black text-xs text-slate-800 tracking-wider block">
                            {orderNum}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {orderDate}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 bg-pink-50 text-pink-600 border border-pink-100 text-[9px] font-bold rounded-full">
                          Siap Pack ({orderTasks.length} SKU)
                        </span>
                      </div>

                      {/* Customer Details */}
                      <div className="mt-3.5 space-y-1.5 border-t border-b border-slate-100 py-3">
                        <div className="text-xs">
                          <span className="text-slate-400 font-semibold block text-[10px] uppercase">CUSTOMER / RESELLER</span>
                          <span className="font-bold text-slate-800">{customer}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-slate-400 font-semibold block text-[10px] uppercase flex items-center gap-0.5"><MapPin className="h-3 w-3 inline text-slate-400" /> ALAMAT KIRIM</span>
                          <span className="text-slate-600 font-medium line-clamp-1 text-[11px]">{address}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Stats & Button */}
                    <div className="flex justify-between items-center pt-1.5">
                      <div className="text-xs">
                        <span className="text-slate-400 text-[10px] block font-medium">TOTAL BARANG</span>
                        <span className="font-black text-pink-600 text-sm font-mono">{totalQty} <span className="text-[10px] text-slate-500 font-normal">pcs</span></span>
                      </div>
                      
                      <button
                        onClick={() => handleSelectOrder(orderNum)}
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-pink-600 text-white font-extrabold text-xs rounded-lg shadow-2xs group-hover:bg-pink-500 transition-colors cursor-pointer"
                      >
                        Buka Meja Packing &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ================= PO PACKING WORKSPACE VIEW ================= */
        <div className="space-y-4">
          {/* Breadcrumb & Navigation */}
          <button
            onClick={() => setSelectedOrderNumber(null)}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-pink-600 font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Antrean PO
          </button>

          {/* Active PO Info Banner */}
          <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-950 shadow-sm flex flex-col md:flex-row justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold bg-pink-500 text-white px-2 py-0.5 rounded uppercase tracking-wider">Meja Packing Aktif</span>
              <h3 className="text-lg font-black font-mono tracking-wider">{selectedOrderNumber}</h3>
              <p className="text-xs text-slate-300 font-medium">
                Sistem QC & Packing Tunggal untuk seluruh barang dalam No. PO ini.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:border-l md:border-slate-800 md:pl-6">
              <div>
                <span className="text-slate-400 font-semibold block text-[10px]">PENERIMA / CUSTOMER</span>
                <span className="font-bold text-white text-[13px]">{currentCustomerName}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px]">TOTAL BARANG</span>
                <span className="font-mono font-black text-pink-400 text-[13px]">
                  {currentOrderTasks.reduce((sum, t) => sum + t.qty, 0)} pcs ({currentOrderTasks.length} SKU)
                </span>
              </div>
              <div className="col-span-2 mt-1">
                <span className="text-slate-400 font-semibold block text-[10px]">ALAMAT PENGIRIMAN</span>
                <span className="text-slate-300 font-medium text-[11px] line-clamp-1">{currentShippingAddress}</span>
              </div>
            </div>
          </div>

          {/* Packing Workspace Split Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            
            {/* Left: Interactive Item Checklist (2 Cols) */}
            <div className="lg:col-span-2 space-y-3.5">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Verifikasi Fisik & Quality Control</h4>
                    <p className="text-[10px] text-slate-500">Periksa fisik, jumlah pcs, dan scan/klik setiap item di bawah sebelum packing ditutup.</p>
                  </div>
                  <button
                    onClick={handleVerifyAllItems}
                    className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Check className="h-3 w-3" /> Verifikasi Semua
                  </button>
                </div>

                 {/* Barcode Scanner Input */}
                <div className="p-3 bg-slate-900 text-white rounded-lg border border-slate-950 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-inner">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      SCANNER VERIFIKASI AKTIF
                    </span>
                    <h5 className="text-[11px] font-bold text-slate-100">Pindai Barcode / SKU Produk</h5>
                    <p className="text-[9px] text-slate-400">Gunakan scanner gun atau klik tombol kamera.</p>
                  </div>
                  
                  <div className="flex items-center gap-2 max-w-xs w-full">
                    <form onSubmit={handlePackerScanSubmit} className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                        <Barcode className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        value={packerScanText}
                        onChange={(e) => setPackerScanText(e.target.value)}
                        placeholder="Tembak barcode / SKU..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 animate-none"
                      />
                    </form>
                    
                    <button
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 active:scale-95 text-white font-extrabold text-xs rounded flex items-center gap-1 cursor-pointer shadow-3xs transition-all shrink-0"
                      title="Gunakan Kamera HP"
                    >
                      <Camera className="h-4 w-4" /> Scan
                    </button>
                  </div>
                </div>

                {/* Scan Feedback Banner */}
                {packerScanFeedback && (
                  <div className={`p-2.5 rounded text-xs flex items-center gap-2 border font-medium ${
                    packerScanFeedback.type === 'success' 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    <AlertCircle className={`h-4 w-4 shrink-0 ${packerScanFeedback.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`} />
                    <span>{packerScanFeedback.message}</span>
                  </div>
                )}

                {/* Items loop */}
                <div className="divide-y divide-slate-100">
                  {currentOrderTasks.map((task) => {
                    const isVerified = !!verifiedItems[task.id];
                    return (
                      <div 
                        key={task.id}
                        className={`py-3.5 flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-colors ${
                          isVerified ? 'bg-emerald-50/20' : ''
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 text-[9px] font-bold font-mono rounded">
                              {task.skuId}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono">ID: {task.id}</span>
                            <span className="text-[9px] text-slate-400 font-mono">| Rak: {task.location}</span>
                            {task.expiredDate && (
                              <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-bold font-mono rounded flex items-center gap-1">
                                <Calendar className="h-3 w-3 shrink-0 text-rose-500" />
                                Exp: {task.expiredDate}
                              </span>
                            )}
                          </div>
                          
                          <h5 className="font-bold text-slate-800 text-xs leading-snug">{task.skuName}</h5>
                          <p className="text-[9px] text-slate-400 font-medium">Gudang Asal: {task.warehouse}</p>
                        </div>

                        {/* Qty & Verify Action Button */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2.5 sm:pt-0">
                          {/* Box Input */}
                          <div className="text-left">
                            <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">Box Ke-</span>
                            <input
                              type="text"
                              value={itemBoxNumbers[task.id] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItemBoxNumbers(prev => ({
                                  ...prev,
                                  [task.id]: val
                                }));
                              }}
                              placeholder="1"
                              className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-700 bg-white focus:border-pink-500 focus:ring-1 focus:ring-pink-500/25 outline-none text-center"
                            />
                          </div>

                          <div className="text-right sm:mr-1">
                            <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-1">DIAMBIL</span>
                            <span className="font-mono font-black text-slate-800 text-xs px-2 py-1 bg-slate-100 rounded-lg border border-slate-200 block text-center min-w-[50px]">
                              {task.qty} pcs
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleVerifyItem(task.id)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide flex items-center gap-1 cursor-pointer transition-all ${
                              isVerified 
                                ? 'bg-emerald-500 text-white shadow-2xs' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            {isVerified ? (
                              <>
                                <Check className="h-3 w-3 stroke-[3px]" />
                                Terverifikasi
                              </>
                            ) : (
                              'Verifikasi Item'
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Box Size, Options & Label Printing (1 Col) */}
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <Box className="h-4 w-4 text-pink-500" />
                  <h3 className="font-bold uppercase tracking-wider text-slate-800 text-xs">Opsi Pengemasan PO</h3>
                </div>

                {!printedLabelData ? (
                  <form onSubmit={handlePrintAndComplete} className="space-y-4">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Pilih Ukuran Karton Box</label>
                      <select
                        value={boxSize}
                        onChange={(e) => setBoxSize(e.target.value as any)}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white outline-none focus:border-pink-500"
                      >
                        <option value="Karton S">Karton S (Kecil — Lipstik/Serum)</option>
                        <option value="Karton M">Karton M (Sedang — Cleanser/Moisturizer)</option>
                        <option value="Karton L">Karton L (Besar — Paket Bulk Multi-brand)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nomor Box Ke-berapa</label>
                      <input
                        type="text"
                        value={boxNumber}
                        onChange={(e) => setBoxNumber(e.target.value)}
                        placeholder="Contoh: 1, 2, atau Box 1/2..."
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white outline-none focus:border-pink-500 font-semibold"
                        required
                      />
                    </div>

                    <div>
                      <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={useBubbleWrap}
                          onChange={(e) => setUseBubbleWrap(e.target.checked)}
                          className="rounded text-pink-500 focus:ring-pink-500/20 border-slate-300 mt-0.5"
                        />
                        <span className="font-semibold text-slate-700 text-[11px] leading-tight">
                          Tambahkan Double Bubble Wrap (Wajib untuk kosmetik cair / kaca)
                        </span>
                      </label>
                    </div>

                    {/* Status Alert for verification */}
                    {!allVerified ? (
                      <div className="p-2.5 bg-amber-50 text-amber-900 rounded-lg border border-amber-200 text-[10px] flex items-start gap-1.5">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="leading-snug">
                          <strong>Tombol Terkunci:</strong> Harap verifikasi semua item fisik dalam PO ini dengan mencentang / mengklik tombol "Verifikasi Item" di sebelah kiri sebelum menyelesaikan order.
                        </p>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-200 text-[10px] flex items-start gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="leading-snug">
                          <strong>Siap Packing!</strong> Seluruh item PO berhasil diverifikasi secara fisik. Silakan klik tombol cetak di bawah untuk menyelesaikan order.
                        </p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!allVerified || printingLabel || (currentUser.role !== 'PACKER' && currentUser.role !== 'ADMIN')}
                      className="w-full py-2.5 bg-pink-500 hover:bg-pink-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:shadow-none text-white font-black text-xs rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {printingLabel ? (
                        <>
                          <Printer className="h-4 w-4 animate-spin" />
                          Sedang Mencetak Label...
                        </>
                      ) : (
                        <>
                          <Printer className="h-4 w-4" />
                          Konfirmasi Kemas & Cetak Label PO
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  /* LABEL PREVIEW AFTER COMPLETE */
                  <div className="space-y-3">
                    <div className="p-4 bg-white border-2 border-slate-950 rounded-xl font-mono text-[9px] text-slate-800 space-y-2.5 relative overflow-hidden shadow-xs">
                      {/* Watermark badge */}
                      <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                        <div className="border-2 border-emerald-500 text-emerald-500 rounded font-black text-[8px] px-1 transform rotate-6 uppercase">
                          LULUS QC
                        </div>
                        <div className="bg-pink-100 text-pink-700 rounded font-black text-[8px] px-1.5 py-0.5 uppercase tracking-wider">
                          BOX #{printedLabelData.boxNumber || '1'}
                        </div>
                      </div>

                      <div className="text-center border-b border-slate-200 pb-1.5">
                        <p className="font-black text-[10px]">LABEL PENGIRIMAN</p>
                        <p className="text-[7px] text-slate-400">WMS BEAUTY STOCK SYSTEM</p>
                      </div>

                      <div className="space-y-1 text-[10px]">
                        <p><strong>PO NUMBER:</strong> <span className="font-black text-slate-950">{printedLabelData.orderNumber}</span></p>
                        <p><strong>AWB:</strong> {printedLabelData.awb}</p>
                        <p><strong>Penerima:</strong> <span className="font-bold text-slate-950">{printedLabelData.customer}</span></p>
                        <p className="line-clamp-2"><strong>Alamat:</strong> {printedLabelData.address}</p>
                        
                        <div className="border-t border-dashed border-slate-300 my-1.5 pt-1.5">
                          <p className="font-bold uppercase tracking-wider text-[8px] text-slate-400 mb-1">Daftar Isi Paket:</p>
                          <ul className="list-disc pl-3.5 space-y-0.5 text-[8px] text-slate-700">
                            {printedLabelData.items.map((it: any, idx: number) => (
                              <li key={idx}>
                                <span className="font-bold text-slate-900">{it.skuId}</span> - {it.skuName} <span className="font-black text-pink-600">({it.qty} pcs)</span> <span className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-bold text-[7px] ml-1">BOX #{it.boxNumber || '1'}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div className="border-t border-dashed border-slate-300 pt-1.5 flex justify-between text-[8px] text-slate-500">
                          <span><strong>Kemasan:</strong> {printedLabelData.box}</span>
                          <span><strong>Nomor Box:</strong> <span className="text-slate-950 font-bold">#{printedLabelData.boxNumber || '1'}</span></span>
                          <span><strong>Bubblewrap:</strong> {printedLabelData.bubble}</span>
                        </div>
                        
                        <p className="text-[8px] text-slate-500">
                          <strong>Packer:</strong> {printedLabelData.packer} | <strong>Tanggal:</strong> {printedLabelData.date}
                        </p>
                      </div>

                      {/* Simulated barcode */}
                      <div className="pt-1.5 text-center border-t border-slate-100">
                        <div className="h-8 bg-slate-900 mx-auto flex items-end justify-center py-1 gap-0.5">
                          {[2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 2, 1, 3, 1, 2].map((w, idx) => (
                            <div key={idx} className="bg-white h-full" style={{ width: `${w}px` }} />
                          ))}
                        </div>
                        <p className="text-[7px] tracking-widest mt-1 text-slate-500 font-bold">{printedLabelData.awb}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedOrderNumber(null);
                        setPrintedLabelData(null);
                      }}
                      className="w-full py-2 bg-slate-900 text-white hover:bg-slate-800 font-bold text-[11px] rounded-lg cursor-pointer flex items-center justify-center gap-1"
                    >
                      Selesaikan & Kembali ke Antrean
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {showScanner && (
        <CameraScanner 
          onScan={(code) => {
            verifyCode(code);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
          title={`Pindai QC Item PO: ${selectedOrderNumber}`}
        />
      )}
    </div>
  );
}
