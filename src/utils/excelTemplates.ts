import * as XLSX from 'xlsx';

export function downloadInventoryTemplate() {
  const headers = [
    ['Merek', 'Barcode', 'Kode SKU', 'Nama SKU', 'Tanggal Kedaluwarsa', 'Lokasi Rak', 'Stok Awal']
  ];
  const sampleData = [
    ['SK-II', '8991234567890', 'SKI001', 'SK-II Facial Treatment Essence', '31/12/2028', 'AC-02-01-01', '100'],
    ['Innisfree', '8999876543210', 'INF002', 'Innisfree Green Tea Seed Serum', '30/06/2027', 'RK-01-02-03', '50']
  ];
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Stok');
  XLSX.writeFile(wb, 'WMS_Template_Stok_Barang.xlsx');
}

export function downloadInboundTemplate() {
  const headers = [
    ['Supplier', 'Kode SKU', 'Nama SKU', 'Merek', 'Barcode', 'Qty Rencana', 'Lokasi Rak', 'Expired Date']
  ];
  const sampleData = [
    ['PT Procter & Gamble', 'SKI001', 'SK-II Facial Treatment Essence', 'SK-II', '8991234567890', '150', 'AC-02-01-01', '31/12/2028'],
    ['PT Cosmax Indonesia', 'INF002', 'Innisfree Green Tea Seed Serum', 'Innisfree', '8999876543210', '80', 'RK-01-02-03', '30/06/2027']
  ];
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Inbound');
  XLSX.writeFile(wb, 'WMS_Template_Rencana_Inbound.xlsx');
}

export function downloadOrderTemplate() {
  const headers = [
    ['Nama Pelanggan', 'Alamat Kirim', 'No Pesanan', 'No PO', 'Kode SKU', 'Qty']
  ];
  const sampleData = [
    ['Toko Cantik Jaya', 'Jl. Sudirman No. 45, Jakarta', 'ORD-2026-101', 'PO-A109', 'SKI001', '24'],
    ['Toko Cantik Jaya', 'Jl. Sudirman No. 45, Jakarta', 'ORD-2026-101', 'PO-A109', 'INF002', '12']
  ];
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Order');
  XLSX.writeFile(wb, 'WMS_Template_Order_Outbound.xlsx');
}

export function downloadReturnTemplate() {
  const headers = [
    ['Pelanggan / Pengirim', 'Alasan Retur', 'Kode SKU', 'Qty', 'Kondisi']
  ];
  const sampleData = [
    ['Toko Cantik Jaya', 'WRONG_ITEM', 'SKI001', '5', 'GOOD'],
    ['Personal Buyer A', 'DAMAGED', 'INF002', '2', 'DAMAGED']
  ];
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Retur');
  XLSX.writeFile(wb, 'WMS_Template_Retur_Pelanggan.xlsx');
}

export function downloadTransferTemplate() {
  const headers = [
    ['Kode SKU', 'Gudang Tujuan', 'Lokasi Tujuan', 'Qty']
  ];
  const sampleData = [
    ['SKI001', 'Gudang Utama', 'UT-02-01-01', '20'],
    ['INF002', 'Gudang AC', 'AC-01-02-03', '15']
  ];
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Transfer');
  XLSX.writeFile(wb, 'WMS_Template_Transfer_Stok.xlsx');
}

