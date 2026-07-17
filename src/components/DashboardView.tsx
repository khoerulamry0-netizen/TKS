import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  ArrowUpRight, 
  ShieldAlert, 
  CheckCircle, 
  Layers, 
  ArrowRight,
  Sparkles,
  Calendar,
  MapPin,
  Tag
} from 'lucide-react';
import { InventoryItem, OrderRecord, InboundRecord, ReturnRecord, TransactionTask, MenuType } from '../types';

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

interface DashboardViewProps {
  inventory: InventoryItem[];
  orders: OrderRecord[];
  inbounds: InboundRecord[];
  returns: ReturnRecord[];
  tasks: TransactionTask[];
  onReplenish: (skuId: string, amount: number) => void;
  setCurrentMenu: (menu: MenuType) => void;
}

export default function DashboardView({
  inventory,
  orders,
  inbounds,
  returns,
  tasks,
  onReplenish,
  setCurrentMenu,
}: DashboardViewProps) {
  
  // Calculate analytics
  const totalUniqueSkus = new Set(inventory.map(item => item.skuId.toUpperCase())).size;
  const totalStockRows = inventory.length;
  const totalStockQty = inventory.reduce((acc, curr) => acc + curr.qty, 0);
  const lowStockItems = inventory.filter(item => item.qty <= item.lowStockThreshold);
  const pendingInbounds = inbounds.filter(item => item.status === 'PENDING').length;
  const activeReturns = returns.filter(item => item.status === 'PENDING').length;
  const pendingOutbounds = orders.filter(item => item.status === 'NEW' || item.status === 'PROCESSING').length;

  // 1. Volume stok berdasarkan brand
  const brandStock: Record<string, number> = {};
  inventory.forEach(item => {
    const brand = item.brand ? String(item.brand).trim() : 'Tanpa Merek';
    brandStock[brand] = (brandStock[brand] || 0) + item.qty;
  });
  const brandVolumeList = Object.entries(brandStock)
    .map(([name, qty]) => ({
      name,
      qty,
      percentage: totalStockQty > 0 ? Math.round((qty / totalStockQty) * 100) : 0
    }))
    .sort((a, b) => b.qty - a.qty);

  // 2. Distribusi stok per lokasi (Top 5 Lokasi Rak)
  const locationStock: Record<string, number> = {};
  inventory.forEach(item => {
    const loc = item.location ? String(item.location).trim().toUpperCase() : 'BELUM DIATUR';
    locationStock[loc] = (locationStock[loc] || 0) + item.qty;
  });
  const locationVolumeList = Object.entries(locationStock)
    .map(([name, qty]) => ({
      name,
      qty,
      percentage: totalStockQty > 0 ? Math.round((qty / totalStockQty) * 100) : 0
    }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // 3. Rasio kualitas stok dan masa kadaluarsa
  let qtyAman = 0;
  let qtyWarning = 0;
  let qtyExpired = 0;
  inventory.forEach(item => {
    const status = getExpiredStatus(item.expiredDate);
    if (status === 'expired') qtyExpired += item.qty;
    else if (status === 'under <18bln') qtyWarning += item.qty;
    else qtyAman += item.qty;
  });
  const totalQualityQty = qtyAman + qtyWarning + qtyExpired;
  const pctAman = totalQualityQty > 0 ? (qtyAman / totalQualityQty) * 100 : 0;
  const pctWarning = totalQualityQty > 0 ? (qtyWarning / totalQualityQty) * 100 : 0;
  const pctExpired = totalQualityQty > 0 ? (qtyExpired / totalQualityQty) * 100 : 0;

  // Capacity calculation based on mock maxima
  const warehouseCapacities = [
    { 
      name: 'Gudang AC', 
      desc: 'Penyimpanan Suhu Dingin (Skincare Premium)', 
      current: inventory.filter(i => i.warehouse === 'Gudang AC').reduce((sum, i) => sum + i.qty, 0),
      max: 500,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-700'
    },
    { 
      name: 'Gudang Utama', 
      desc: 'Penyimpanan Umum (Kardus & Bulk)', 
      current: inventory.filter(i => i.warehouse === 'Gudang Utama').reduce((sum, i) => sum + i.qty, 0),
      max: 1000,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-700'
    },
    { 
      name: 'Gudang Rak', 
      desc: 'Penyimpanan Rak Tingkat (Kosmetik & Lipstik)', 
      current: inventory.filter(i => i.warehouse === 'Gudang Rak').reduce((sum, i) => sum + i.qty, 0),
      max: 800,
      color: 'bg-rose-500',
      textColor: 'text-rose-700'
    }
  ];

  // Operator Logs aggregated from all tasks
  const recentLogs = tasks
    .flatMap(task => task.operatorLogs.map(log => ({
      ...log,
      taskType: task.type,
      skuName: task.skuName,
      taskId: task.id
    })))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Top Welcome Alert Banner - High Density Style */}
      <div className="bg-slate-900 text-slate-100 rounded border border-slate-800 p-4 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="p-0.5 bg-pink-500 text-white rounded-full text-[10px]">
              <Sparkles className="h-3 w-3" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 font-mono">Overview Gudang Utama</span>
          </div>
          <h2 className="text-base font-black tracking-tight mt-1 text-white">WAREHOUSE TKS — Sistem Manajemen Inventaris</h2>
          <p className="text-xs text-slate-400 mt-0.5">Pantau tingkat persediaan, validasi inbound, jalankan order picking dan packing, serta kelola mutasi antar rak dengan lancar.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button 
            onClick={() => setCurrentMenu('INPUT_ORDER')}
            className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded transition-all flex items-center gap-1 shadow-xs cursor-pointer"
          >
            Input Order Baru
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Widgets Grid - High Density Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total SKU Card */}
        <div className="bg-white p-3.5 rounded border border-slate-200 shadow-2xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tipe SKU</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">{totalUniqueSkus} <span className="text-xs font-normal text-slate-500">SKU</span></h3>
              <span className="text-[9px] text-slate-500 font-mono flex flex-col gap-0.5 mt-1">
                <span className="text-emerald-600 font-bold">✓ {totalStockRows} Baris Data Stok</span>
              </span>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-100 rounded text-slate-600">
              <Layers className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Total Stock Qty Card */}
        <div className="bg-white p-3.5 rounded border border-slate-200 shadow-2xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Qty Stok</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">{totalStockQty} <span className="text-xs font-normal text-slate-500">pcs</span></h3>
              <span className="text-[9px] text-slate-500 font-mono flex items-center gap-0.5 mt-1.5">
                Tersebar di 3 lokasi rak
              </span>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-100 rounded text-slate-600">
              <Package className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Low Stock Items Card */}
        <div className="bg-white p-3.5 rounded border border-slate-200 shadow-2xs relative overflow-hidden">
          {lowStockItems.length > 0 && (
            <div className="absolute top-0 right-0 w-1.5 h-full bg-pink-500" />
          )}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SKU Stok Tipis</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">{lowStockItems.length}</h3>
              <span className={`text-[9px] font-mono flex items-center gap-0.5 mt-1.5 ${lowStockItems.length > 0 ? 'text-pink-600 font-bold' : 'text-slate-500'}`}>
                <AlertTriangle className="h-2.5 w-2.5 inline" /> {lowStockItems.length > 0 ? 'Segera restock' : 'Semua aman'}
              </span>
            </div>
            <div className={`p-2 border rounded ${lowStockItems.length > 0 ? 'bg-pink-50 border-pink-100 text-pink-600' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Pending Activity Cards */}
        <div className="bg-white p-3.5 rounded border border-slate-200 shadow-2xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Antrean Transaksi</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-black text-slate-900">{pendingOutbounds + pendingInbounds}</span>
                <span className="text-slate-500 text-[10px] font-mono">({pendingOutbounds} Out / {pendingInbounds} In)</span>
              </div>
              <span className="text-[9px] text-slate-500 font-mono flex items-center gap-0.5 mt-1.5">
                Menunggu Picker/Packer
              </span>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-100 rounded text-slate-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Analisis Statistik & Visualisasi */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Brand Stock Volume */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Tag className="h-4 w-4 text-pink-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Volume Stok per Brand</h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-3.5">Distribusi total kuantitas stok kosmetik berdasarkan merek</p>
            
            {brandVolumeList.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic py-6 text-center">Tidak ada data brand</p>
            ) : (
              <div className="space-y-3.5">
                {brandVolumeList.slice(0, 5).map((brand, idx) => {
                  const colors = ['bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-sky-500', 'bg-slate-500'];
                  const barColor = colors[idx % colors.length];
                  return (
                    <div key={brand.name} className="space-y-1">
                      <div className="flex justify-between items-baseline text-[11px]">
                        <span className="font-semibold text-slate-700 truncate max-w-[140px]">{brand.name}</span>
                        <span className="font-mono text-slate-600 font-bold">
                          {brand.qty.toLocaleString('id-ID')} <span className="text-[9px] font-normal text-slate-400">pcs</span> ({brand.percentage}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${barColor}`} 
                          style={{ width: `${brand.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {brandVolumeList.length > 5 && (
                  <p className="text-[9px] text-slate-400 text-right italic font-mono pt-1">
                    + {brandVolumeList.length - 5} brand lainnya
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 mt-4 pt-2 flex justify-between items-center text-[10px] text-slate-400">
            <span>Total Merek: {brandVolumeList.length} Merek</span>
            <span className="font-mono font-bold text-slate-700">{totalStockQty.toLocaleString('id-ID')} pcs</span>
          </div>
        </div>

        {/* Location Stock Distribution */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <MapPin className="h-4 w-4 text-pink-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Distribusi Stok per Lokasi</h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-3.5">Kepadatan stok berdasarkan kode bin rak penyimpanan</p>

            {locationVolumeList.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic py-6 text-center">Tidak ada data lokasi</p>
            ) : (
              <div className="space-y-3.5">
                {locationVolumeList.map((loc) => (
                  <div key={loc.name} className="space-y-1">
                    <div className="flex justify-between items-baseline text-[11px]">
                      <span className="font-mono font-bold text-slate-700 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
                        {loc.name}
                      </span>
                      <span className="font-mono text-slate-600 font-bold">
                        {loc.qty.toLocaleString('id-ID')} <span className="text-[9px] font-normal text-slate-400">pcs</span> ({loc.percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-pink-500/80" 
                        style={{ width: `${loc.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 mt-4 pt-2 flex justify-between items-center text-[10px] text-slate-400">
            <span>Menampilkan 5 Rak Terpadat</span>
            <button 
              onClick={() => setCurrentMenu('STOK_BARANG')}
              className="text-pink-600 font-bold text-[9px] hover:underline"
            >
              Lihat Semua &rarr;
            </button>
          </div>
        </div>

        {/* Expiry Quality Ratio */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Calendar className="h-4 w-4 text-pink-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Rasio Kualitas & Kadaluarsa</h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-3.5">Analisis kesegaran barang kosmetik berdasarkan tanggal kedaluwarsa</p>

            <div className="space-y-3.5">
              {/* Stacked bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono text-slate-400">
                  <span>Segmen Rasio</span>
                  <span>{totalQualityQty.toLocaleString('id-ID')} pcs</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/50">
                  {qtyAman > 0 && (
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-500 first:rounded-l-full last:rounded-r-full" 
                      style={{ width: `${pctAman}%` }} 
                      title={`Aman: ${pctAman.toFixed(1)}%`}
                    />
                  )}
                  {qtyWarning > 0 && (
                    <div 
                      className="h-full bg-amber-500 transition-all duration-500 first:rounded-l-full last:rounded-r-full" 
                      style={{ width: `${pctWarning}%` }} 
                      title={`Under <18 Bln: ${pctWarning.toFixed(1)}%`}
                    />
                  )}
                  {qtyExpired > 0 && (
                    <div 
                      className="h-full bg-rose-500 transition-all duration-500 first:rounded-l-full last:rounded-r-full animate-pulse" 
                      style={{ width: `${pctExpired}%` }} 
                      title={`Expired: ${pctExpired.toFixed(1)}%`}
                    />
                  )}
                </div>
              </div>

              {/* Status List */}
              <div className="space-y-2 mt-2 pt-1">
                {/* Safe */}
                <div className="flex justify-between items-center text-[11px] pb-1.5 border-b border-slate-100/50">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    <div>
                      <p className="font-bold text-slate-700 leading-none">Aman</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Expired &gt;18 bulan</p>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <p className="font-bold text-slate-800">{qtyAman.toLocaleString('id-ID')} pcs</p>
                    <p className="text-[9px] text-emerald-600 font-bold">{Math.round(pctAman)}%</p>
                  </div>
                </div>

                {/* Under 18 Months */}
                <div className="flex justify-between items-center text-[11px] pb-1.5 border-b border-slate-100/50">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    <div>
                      <p className="font-bold text-slate-700 leading-none">Under &lt;18 Bln</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Mendekati kedaluwarsa</p>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <p className="font-bold text-slate-800">{qtyWarning.toLocaleString('id-ID')} pcs</p>
                    <p className="text-[9px] text-amber-600 font-bold">{Math.round(pctWarning)}%</p>
                  </div>
                </div>

                {/* Expired */}
                <div className="flex justify-between items-center text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                    <div>
                      <p className="font-bold text-slate-700 leading-none">Expired</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Melewati masa simpan</p>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <p className="font-bold text-slate-800">{qtyExpired.toLocaleString('id-ID')} pcs</p>
                    <p className="text-[9px] text-rose-600 font-bold">{Math.round(pctExpired)}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 mt-4 pt-2 flex justify-between items-center text-[10px] text-slate-400">
            <span>Standar Kualitas WMS</span>
            <span className="font-mono text-emerald-600 font-bold">100% Terpantau</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Operator Log & Action Panel */}
      <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-0.5">Aktivitas Operator Terkini</h3>
          <p className="text-[11px] text-slate-500 mb-3">Log real-time aksi Picker, Packer, dan Admin</p>
          
          {recentLogs.length === 0 ? (
            <div className="h-36 flex flex-col items-center justify-center text-slate-400 text-[11px] border border-dashed border-slate-200 rounded bg-slate-50/50 p-4">
              <Layers className="h-6 w-6 text-slate-300 mb-1" />
              <p className="text-center font-medium">Belum ada aktivitas yang tercatat hari ini.</p>
              <p className="text-center text-[9px] mt-0.5">Jalankan proses picking atau packing untuk mengisi log.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[220px] overflow-y-auto pr-1">
              {recentLogs.map((log, idx) => (
                <div key={idx} className="text-[11px] flex gap-2.5 pb-2.5 border-b border-slate-100 last:border-0 md:[&:nth-last-child(-n+2)]:border-0 lg:[&:nth-last-child(-n+3)]:border-0">
                  <div className="mt-0.5 shrink-0">
                    {log.role === 'ADMIN' ? (
                      <span className="w-2 h-2 rounded-full bg-pink-500 block" title="Admin" />
                    ) : log.role === 'PICKER' ? (
                      <span className="w-2 h-2 rounded-full bg-amber-500 block" title="Picker" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-sky-500 block" title="Packer" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-slate-700 truncate">{log.operatorName}</span>
                      <span className="text-[9px] font-mono text-slate-400 shrink-0 ml-1">{new Date(log.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <p className="text-slate-600 mt-0.5 text-[10px] leading-tight">
                      {log.action} <span className="font-mono text-[8px] bg-slate-100 text-slate-600 px-1 rounded inline-block">{log.taskId.slice(-6)}</span>
                    </p>
                    <p className="text-[9px] text-slate-400 italic truncate mt-0.5">{log.skuName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-between items-center text-[10px]">
          <span className="font-mono text-slate-400">Total Log: {recentLogs.length} Entri</span>
          <button 
            onClick={() => setCurrentMenu('AKUN')}
            className="text-pink-600 hover:text-pink-700 font-bold"
          >
            Ganti Operator &rarr;
          </button>
        </div>
      </div>

    </div>
  );
}
