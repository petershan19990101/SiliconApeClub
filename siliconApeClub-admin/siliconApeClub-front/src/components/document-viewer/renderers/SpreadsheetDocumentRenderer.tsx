import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Table2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DocumentRendererProps } from '../types';

type SheetRows = Array<Array<string | number | boolean | null>>;

interface SheetPreview {
  name: string;
  rows: SheetRows;
}

function normalizeCellValue(value: unknown) {
  if (value == null) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Excel/CSV 渲染器，支持工作表切换与表格浏览。
 */
export function SpreadsheetDocumentRenderer({ source }: DocumentRendererProps) {
  const [sheets, setSheets] = useState<SheetPreview[]>([]);
  const [activeSheetName, setActiveSheetName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkbook() {
      setLoading(true);
      setError(null);

      try {
        const buffer = await source.blob.arrayBuffer();
        const workbook = XLSX.read(buffer, {
          type: 'array',
          cellDates: true,
        });

        const nextSheets = workbook.SheetNames.map((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
            header: 1,
            raw: false,
            defval: '',
          });

          return {
            name: sheetName,
            rows,
          };
        });

        if (!cancelled) {
          setSheets(nextSheets);
          setActiveSheetName(nextSheets[0]?.name ?? '');
        }
      } catch {
        if (!cancelled) {
          setError('Excel 文件解析失败。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWorkbook();
    return () => {
      cancelled = true;
    };
  }, [source.blob]);

  const activeSheet = useMemo(
    () => sheets.find((sheet) => sheet.name === activeSheetName) ?? sheets[0],
    [activeSheetName, sheets]
  );

  const columnCount = useMemo(() => {
    if (!activeSheet) {
      return 0;
    }
    return activeSheet.rows.reduce((max, row) => Math.max(max, row.length), 0);
  }, [activeSheet]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        <Loader2 size={18} className="mr-2 animate-spin" />
        正在解析工作簿...
      </div>
    );
  }

  if (error) {
    return <div className="flex h-full items-center justify-center text-sm text-rose-600">{error}</div>;
  }

  if (!activeSheet) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        当前工作簿没有可展示的工作表。
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100/60">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <Table2 size={20} />
        </div>
        <div className="flex flex-wrap gap-2">
          {sheets.map((sheet) => (
            <button
              key={sheet.name}
              type="button"
              onClick={() => setActiveSheetName(sheet.name)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                sheet.name === activeSheet.name
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-auto p-6">
        <div className="inline-block min-w-full rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-center font-black text-slate-400">
                  #
                </th>
                {Array.from({ length: columnCount }).map((_, index) => (
                  <th
                    key={index}
                    className="border-b border-slate-200 px-4 py-3 text-left font-black text-slate-500"
                  >
                    {XLSX.utils.encode_col(index)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeSheet.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="odd:bg-white even:bg-slate-50/40">
                  <td className="sticky left-0 z-10 border-r border-slate-200 bg-inherit px-3 py-2 text-center font-bold text-slate-400">
                    {rowIndex + 1}
                  </td>
                  {Array.from({ length: columnCount }).map((_, columnIndex) => (
                    <td key={columnIndex} className="border-t border-slate-100 px-4 py-2 align-top text-slate-700">
                      {normalizeCellValue(row[columnIndex])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
