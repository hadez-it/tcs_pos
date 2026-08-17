import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { generateSalesReportWorkbook, exportSalesReportToXlsx } from './excelExport';
import { SaleWithItems } from '../types';

const mockSales: SaleWithItems[] = [
  {
    id: 'sale-1',
    created_at: '2026-08-17T10:00:00.000Z',
    branch_id: 'branch-1',
    branch_name: 'Downtown Branch',
    cashier_id: 'cashier-1',
    cashier_name: 'John Cashier',
    customer_name: 'Aung Aung',
    customer_phone: '0912345678',
    payment_method: 'cash',
    discount: 500,
    total_amount: 15000,
    items: [
      {
        id: 'item-1',
        sale_id: 'sale-1',
        product_id: 'prod-1',
        product_name: 'Coffee Mug',
        quantity: 2,
        unit_price: 5000,
        unit_cost: 3000,
        total: 10000
      },
      {
        id: 'item-2',
        sale_id: 'sale-1',
        product_id: 'prod-2',
        product_name: 'Arabica Coffee Beans 250g',
        quantity: 1,
        unit_price: 5500,
        unit_cost: 4000,
        total: 5500
      }
    ]
  },
  {
    id: 'sale-2',
    created_at: '2026-08-17T11:30:00.000Z',
    branch_id: 'branch-2',
    branch_name: 'Uptown Branch',
    cashier_id: 'cashier-2',
    cashier_name: 'Su Su',
    customer_name: '',
    customer_phone: '',
    payment_method: 'mobile',
    discount: 0,
    total_amount: 8000,
    items: [
      {
        id: 'item-3',
        sale_id: 'sale-2',
        product_id: 'prod-3',
        product_name: 'Green Tea Box',
        quantity: 2,
        unit_price: 4000,
        unit_cost: 2500,
        total: 8000
      }
    ]
  }
];

describe('excelExport', () => {
  it('should generate workbook with Summary, Sales Transactions, and Sale Items sheets', () => {
    const wb = generateSalesReportWorkbook(mockSales);
    expect(wb.SheetNames).toEqual(['Summary', 'Sales Transactions', 'Sale Items Detail']);

    const summarySheet = wb.Sheets['Summary'];
    const summaryData = XLSX.utils.sheet_to_json(summarySheet, { header: 1 });
    expect(summaryData.length).toBeGreaterThan(0);

    const salesSheet = wb.Sheets['Sales Transactions'];
    const salesData = XLSX.utils.sheet_to_json<any>(salesSheet);
    expect(salesData.length).toBe(2);
    expect(salesData[0]['Sale ID']).toBe('sale-1');
    expect(salesData[0]['Customer Name']).toBe('Aung Aung');
    expect(salesData[0]['Total Amount (Ks)']).toBe(15000);

    const itemsSheet = wb.Sheets['Sale Items Detail'];
    const itemsData = XLSX.utils.sheet_to_json<any>(itemsSheet);
    expect(itemsData.length).toBe(3);
    expect(itemsData[0]['Product Name']).toBe('Coffee Mug');
    expect(itemsData[1]['Product Name']).toBe('Arabica Coffee Beans 250g');
    expect(itemsData[2]['Product Name']).toBe('Green Tea Box');
  });

  it('should handle empty sales array cleanly', () => {
    const wb = generateSalesReportWorkbook([]);
    expect(wb.SheetNames).toEqual(['Summary', 'Sales Transactions', 'Sale Items Detail']);

    const salesSheet = wb.Sheets['Sales Transactions'];
    const salesData = XLSX.utils.sheet_to_json(salesSheet);
    expect(salesData.length).toBe(0);
  });

  it('should trigger browser download link in exportSalesReportToXlsx', () => {
    const createElementSpy = vi.spyOn(document, 'createElement');
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');

    exportSalesReportToXlsx(mockSales, 'test_export.xlsx');

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
  });
});
