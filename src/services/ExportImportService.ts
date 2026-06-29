import { Transaction } from '../models/types';

export class ExportImportService {
  private static downloadFile(content: string, mimeType: string, filename: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static exportToCSV(transactions: Transaction[]) {
    const headers = ['ID', 'Fecha', 'Hora', 'Tipo', 'Monto', 'Categoría', 'Cuenta', 'Notas', 'Etiquetas', 'Favorito'];
    const rows = transactions.map(tx => [
      tx.id,
      tx.date,
      tx.time,
      tx.type === 'income' ? 'Ingreso' : 'Gasto',
      tx.amount.toString(),
      tx.categoryId.replace('cat_', ''),
      tx.account,
      tx.notes || '',
      (tx.tags || []).join(';'),
      tx.favorite ? 'Sí' : 'No'
    ]);

    // CSV format with UTF-8 BOM for Excel compatibility
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    this.downloadFile(csvContent, 'text/csv;charset=utf-8;', `finanlist_movimientos_${new Date().toISOString().slice(0,10)}.csv`);
  }

  static exportToExcel(transactions: Transaction[]) {
    // Excel supports HTML tables named as .xls. It renders them beautifully.
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          table { border-collapse: collapse; }
          th { background-color: #6366f1; color: white; font-weight: bold; }
          th, td { border: 1px solid #e4e4e7; padding: 8px; font-family: sans-serif; text-align: left; }
          .income { color: #22c55e; }
          .expense { color: #ef4444; }
        </style>
      </head>
      <body>
        <h2>Reporte de Movimientos - Finanlist</h2>
        <p>Exportado el: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Tipo</th>
              <th>Categoría</th>
              <th>Cuenta</th>
              <th>Monto</th>
              <th>Notas</th>
              <th>Etiquetas</th>
            </tr>
          </thead>
          <tbody>
    `;

    transactions.forEach(tx => {
      const isIncome = tx.type === 'income';
      html += `
        <tr>
          <td>${tx.date}</td>
          <td>${tx.time}</td>
          <td class="${isIncome ? 'income' : 'expense'}">${isIncome ? 'Ingreso' : 'Gasto'}</td>
          <td>${tx.categoryId.replace('cat_', '')}</td>
          <td>${tx.account}</td>
          <td><b>${tx.amount.toFixed(2)}</b></td>
          <td>${tx.notes || ''}</td>
          <td>${(tx.tags || []).join(', ')}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    this.downloadFile(html, 'application/vnd.ms-excel', `finanlist_reporte_${new Date().toISOString().slice(0,10)}.xls`);
  }

  static exportToPDF(transactions: Transaction[], currency: string = '$') {
    // Generate a printable window containing a styled premium invoice/statement list.
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permite las ventanas emergentes para exportar en PDF.');
      return;
    }
    // Sort transactions by date desc
    const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const balance = totalIncome - totalExpense;

    printWindow.document.write(`
      <html>
      <head>
        <title>Finanlist - Estado de Cuenta</title>
        <style>
          body {
            font-family: 'Inter', sans-serif;
            color: #18181b;
            padding: 40px;
            margin: 0;
            background-color: #ffffff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #e4e4e7;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: 800;
            color: #6366f1;
            letter-spacing: -0.5px;
          }
          .title {
            text-align: right;
          }
          .title h1 {
            margin: 0;
            font-size: 20px;
            color: #18181b;
          }
          .title p {
            margin: 5px 0 0 0;
            font-size: 12px;
            color: #71717a;
          }
          .summary-cards {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 40px;
          }
          .card {
            border: 1px solid #e4e4e7;
            border-radius: 12px;
            padding: 16px;
            background-color: #fcfcfd;
          }
          .card-label {
            font-size: 12px;
            color: #71717a;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .card-value {
            font-size: 20px;
            font-weight: 700;
          }
          .card-value.income { color: #16a34a; }
          .card-value.expense { color: #dc2626; }
          .table-container {
            margin-top: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th {
            text-align: left;
            padding: 12px 8px;
            border-bottom: 2px solid #e4e4e7;
            color: #71717a;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td {
            padding: 14px 8px;
            border-bottom: 1px solid #e4e4e7;
            font-size: 13px;
          }
          tr:last-child td {
            border-bottom: none;
          }
          .amount {
            font-weight: 600;
          }
          .amount.income { color: #16a34a; }
          .amount.expense { color: #dc2626; }
          .tag {
            background-color: #f4f4f5;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            color: #71717a;
            margin-right: 4px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🪙 finanlist</div>
          <div class="title">
            <h1>Estado de Cuenta Personal</h1>
            <p>Generado el: ${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}</p>
          </div>
        </div>

        <div class="summary-cards">
          <div class="card">
            <div class="card-label">Total Ingresos</div>
            <div class="card-value income">${currency}${totalIncome.toFixed(2)}</div>
          </div>
          <div class="card">
            <div class="card-label">Total Gastos</div>
            <div class="card-value expense">${currency}${totalExpense.toFixed(2)}</div>
          </div>
          <div class="card">
            <div class="card-label">Balance Neto</div>
            <div class="card-value">${currency}${balance.toFixed(2)}</div>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 12%">Fecha</th>
                <th style="width: 15%">Cuenta</th>
                <th style="width: 20%">Categoría</th>
                <th style="width: 35%">Notas / Etiquetas</th>
                <th style="text-align: right; width: 18%">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map(tx => `
                <tr>
                  <td>${tx.date}</td>
                  <td>${tx.account}</td>
                  <td>
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${tx.color}; margin-right:6px;"></span>
                    ${tx.categoryId.replace('cat_', '').replace(/^\w/, c => c.toUpperCase())}
                  </td>
                  <td>
                    ${tx.notes || '-'}
                    <div style="margin-top: 4px;">
                      ${(tx.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
                    </div>
                  </td>
                  <td style="text-align: right;" class="amount ${tx.type}">
                    ${tx.type === 'income' ? '+' : '-'}${currency}${tx.amount.toFixed(2)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <script>
          window.onload = function() {
            window.print();
            // Optional: close window after print dialog is closed
            // setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }
}
