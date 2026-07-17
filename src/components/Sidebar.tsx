import { 
  LayoutDashboard, 
  Package, 
  Download, 
  Undo2, 
  PlusCircle, 
  ClipboardCheck, 
  Box, 
  History, 
  Shuffle, 
  UserCircle,
  Menu,
  X,
  Warehouse,
  LogOut,
  Cloud
} from 'lucide-react';
import { MenuType, User } from '../types';

interface SidebarProps {
  currentMenu: MenuType;
  setCurrentMenu: (menu: MenuType) => void;
  currentUser: User;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onLogout?: () => void;
}

export default function Sidebar({
  currentMenu,
  setCurrentMenu,
  currentUser,
  sidebarOpen,
  setSidebarOpen,
  onLogout,
}: SidebarProps) {
  
  const menuItems: { type: MenuType; label: string; icon: any; roles: string[] }[] = [
    { type: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'PICKER', 'PACKER', 'STAFF_WAREHOUSE'] },
    { type: 'STOK_BARANG', label: 'Stok Barang', icon: Package, roles: ['ADMIN', 'PICKER', 'PACKER', 'STAFF_WAREHOUSE'] },
    { type: 'INBOUND', label: 'Inbound (Masuk)', icon: Download, roles: ['ADMIN', 'STAFF_WAREHOUSE'] },
    { type: 'RETURN', label: 'Return Barang', icon: Undo2, roles: ['ADMIN', 'STAFF_WAREHOUSE'] },
    { type: 'INPUT_ORDER', label: 'Input Order (Out)', icon: PlusCircle, roles: ['ADMIN'] },
    { type: 'PROSES_PICKING', label: 'Proses Picking', icon: ClipboardCheck, roles: ['ADMIN', 'PICKER'] },
    { type: 'PROSES_PACKING', label: 'Proses Packing', icon: Box, roles: ['ADMIN', 'PACKER'] },
    { type: 'HISTORY_ORDER', label: 'History Order', icon: History, roles: ['ADMIN'] },
    { type: 'TRANSFER_STOK', label: 'Transfer Stok', icon: Shuffle, roles: ['ADMIN'] },
    { type: 'GOOGLE_WORKSPACE', label: 'Workspace Cloud', icon: Cloud, roles: ['ADMIN', 'STAFF_WAREHOUSE', 'PICKER', 'PACKER'] },
    { type: 'AKUN', label: 'Akun & Peran', icon: UserCircle, roles: ['ADMIN'] },
  ];

  const visibleMenuItems = menuItems.filter(item => {
    if (item.type === 'AKUN') {
      return currentUser.role === 'ADMIN';
    }
    return true;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-pink-500 text-white border-pink-600';
      case 'STAFF_WAREHOUSE': return 'bg-emerald-500 text-white border-emerald-600';
      case 'PICKER': return 'bg-amber-500 text-slate-900 border-amber-600';
      case 'PACKER': return 'bg-sky-500 text-white border-sky-600';
      default: return 'bg-slate-500 text-white border-slate-600';
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-200 border-r border-slate-800 z-50 flex flex-col justify-between transform transition-transform duration-300 ease-out lg:translate-x-0 lg:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header */}
        <div>
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950/50">
            <div className="flex items-center gap-2.5">
              {/* Animated modern logo badge */}
              <div className="logo-container w-9 h-9 bg-linear-to-tr from-pink-600 via-rose-500 to-amber-400 rounded-lg flex items-center justify-center text-white shadow-lg shadow-pink-500/25 relative overflow-hidden group border border-pink-400/30">
                {/* Scanner bar animation helper */}
                <div className="absolute inset-x-0 h-[2px] bg-white opacity-40 top-0 animate-bounce" />
                <span className="font-mono text-sm tracking-tighter font-extrabold uppercase select-none">
                  TKS
                </span>
              </div>
              
              <div>
                <h1 className="font-black text-xs sm:text-sm tracking-tight text-white leading-none uppercase flex items-center gap-1">
                  WAREHOUSE <span className="text-pink-500 logo-glow-text italic">TKS</span>
                </h1>
                <span className="text-[8px] text-slate-500 font-bold tracking-widest font-mono">SYSTEM MANAGEMENT</span>
              </div>
            </div>
            <button 
              className="lg:hidden p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* User Info Capsule */}
          <div className="p-3 mx-3 my-3 bg-slate-800/40 rounded border border-slate-800/80 flex items-center gap-2.5">
            <img 
              src={currentUser.avatar} 
              alt={currentUser.name} 
              className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-700"
              referrerPolicy="no-referrer"
            />
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate leading-tight">{currentUser.name}</p>
              <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[8px] font-extrabold tracking-wider border mt-1 leading-none ${getRoleBadgeColor(currentUser.role)}`}>
                {currentUser.role}
              </span>
            </div>
          </div>

          {/* Menu Navigation */}
          <nav className="px-3 space-y-1 overflow-y-auto max-h-[calc(100vh-250px)]">
            <div className="px-3 py-1 text-[9px] font-extrabold uppercase tracking-widest text-slate-500">
              Menu Navigasi
            </div>
            {visibleMenuItems.map((item) => {
              const IconComponent = item.icon;
              const isSelected = currentMenu === item.type;
              const hasPermission = item.roles.includes(currentUser.role);
              
              return (
                <button
                  key={item.type}
                  onClick={() => {
                    setCurrentMenu(item.type);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-all group duration-200 ${
                    isSelected
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  } ${!hasPermission ? 'opacity-35 cursor-not-allowed group' : ''}`}
                  disabled={false /* Enable clicking so they can see lack of permission with a nice modal or tip! */}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className={`h-4 w-4 ${isSelected ? 'text-pink-500' : 'text-slate-400 group-hover:text-slate-200'}`} />
                    <span>{item.label}</span>
                  </div>
                  {!hasPermission && (
                    <span className="text-[8px] bg-slate-800 text-slate-500 px-1 py-0.5 rounded border border-slate-700 font-mono">Locked</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Status Panel */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-2.5">
          <div className="text-center">
            <div className="text-[10px] text-slate-500">
              Masuk sebagai <strong className="text-slate-300">{currentUser.name}</strong>
            </div>
            <p className="text-[9px] text-slate-600 font-mono mt-1">Sistem Gudang Kosmetik Sehat</p>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full py-1.5 px-3 bg-red-600/10 hover:bg-red-600/20 active:scale-[0.98] border border-red-600/30 hover:border-red-600/50 text-red-400 font-bold text-[10px] uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Keluar Sistem
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
