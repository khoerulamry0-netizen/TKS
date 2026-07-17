import { InventoryItem } from '../types';

export const rawInventoryTsv = `brand	barcode	sku id	sku name	Expired date	location	qty
Skintific	810114871201	SKI121	Skintific Retinol Skin Renewal Serum	09/09/2029	AC-02-01-01	35
Skintific	4897147690739	SKI201	Skintific Radiance Boost Serum Spray	22/12/2029	AC-02-01-01	96
Skintific	810114870402	SKI217	Skintific Msh Niacinamide Brightening Moisture Gel 6 gr	24/12/2029	AC-02-02-01	152
Anua	8809640731792	ANU001	Anua Heartleaf 77% Soothing Toner 40Ml	19/11/2027	AC-03-02-03	15
Avoskin	8997239323357	AVO002	Avoskin Miraculous Refining Toner (100 Ml)	01/11/2027	RK-03-02-01	24
Soulyu	710497670142	SOU026	Soulyu Fluffy Haze Lip Velvet - 06 Rum Raisin	08/05/2028	AC-06-02-04	14
Fss	5524411232218	FSS020	Fss Salicylic Acid Toner 2% with Succinic Acid 100ml	01/07/2028	AC-04-01-01	168
Finally Found You	8994464410111	FIN028	Finally Found You Triple Vitamin B-Arrier + Peach + Snail Mucin Intensive Soothing Essence Toner	01/02/2028	AC-06-01-01	29
Brighty	8993883100009	BRI003	Brighty Glowing Underarm Gel 30 Ml		FL-06-05-01	1028
Beautyinu	8994461990029	BEA002	Beautyinu Kefir Collagen Soap Bar 60 Gr	09/01/2027	AC-01-01-01	80
Mlen Diary	100101195	MLE051	Mlen Diary Magnetic Eyelashes-Manga Falsies-21	12/01/2028	AC-01-01-01	9
Blink Charm	8997031660070	BLI019	Blink Charm Sensl Curls#1-1 Pair Lem 1Ml	05/01/2027	AC-01-01-02	44
Glowfx	8994465580011	GLO002	Glowfx Glow Bomb Serum 20Ml	12/01/2027	AC-01-01-04	55
Hanasui	8998824552398	HAN028	Hanasui Collagen Water Sunscreen Spf30 With Renew Hangtag 30Gr X 48	02/01/2029	AC-01-01-04	28
Raecca	8997236031590	RAE010	Raecca Swipe To Glow Work	01/02/2029	FL-02-03-02	291
Jejuby	8994460180032	JEJ002	Jejuby Gluta Rice Clay Mask 50g	01/03/2029	FL-04-01-01	551
Kime	8994467420162	KIM001	Kime Luminizing Jeju Brightening Soap		FL-03-04-03	3762
Rintik	8994452170010	RIN002	Rintik Stretch Mark Cream 200Ml	01/10/2027	FL-06-02-01	627
Buttered	8997724496986	BUT047	Buttered Lip Scrub Bubble Gum	01/07/2028	FL-06-03-01	74
Ciara	8993883100122	CIA005	Ciara Liquid Serum For Stretch Marks 30 Ml	01/02/2028	FL-06-04-01	127
Skin1004	8809576261110	SKI075	Skin1004 Madagascar Centella Light Cleansing Oil 200Ml	13/01/2029	FL-06-03-02	108
Implora	8993883801135	IMP249	Imp Essential Sheet Mask (Brightening) (48X12X25Gr)	17/12/2028	FL-02-04-01	96
Perfect White	(90)NA18221901080(91)250406-1	PER001	Perfect White Aha Body Serum (100Ml)	01/03/2028	FL-02-03-01	1895
Mykonos	3475932544781	MYK032	Mykonos Monaco Royale 50Ml	01/06/2029	FL-01-01-02	72`;

export function parseTsvToInventory(tsv: string): InventoryItem[] {
  const lines = tsv.trim().split('\n');
  if (lines.length <= 1) return [];

  const headers = lines[0].toLowerCase().split('\t').map(h => h.trim());
  const items: InventoryItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split('\t').map(c => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] || '';
    });

    const brand = row['brand'] || 'Tanpa Merek';
    const barcode = row['barcode'] || String(Math.floor(Math.random() * 9000000000000) + 1000000000000);
    const skuId = (row['sku id'] || '').toUpperCase();
    const skuName = row['sku name'] || '';
    const expiredDateRaw = row['expired date'] || '';
    const location = row['location'] || 'UT-01-01-01';
    const qtyStr = row['qty'] || '0';

    if (!skuId || !skuName) continue;

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

    // Clean quantity
    let cleanQtyStr = qtyStr.replace(/,/g, '');
    if (cleanQtyStr.includes('.') && cleanQtyStr.split('.')[1]?.length === 3) {
      cleanQtyStr = cleanQtyStr.replace(/\./g, '');
    }
    const qty = Math.max(0, parseInt(cleanQtyStr) || 0);

    items.push({
      id: `STK-INI-${String(i).padStart(3, '0')}`,
      brand,
      barcode,
      skuId,
      skuName,
      expiredDate,
      location,
      warehouse,
      qty,
      lowStockThreshold: 20,
      batchNumber: `BCH-${skuId}-${100 + i}`
    });
  }

  return items;
}

export const initialInventoryFromTsv = parseTsvToInventory(rawInventoryTsv);
