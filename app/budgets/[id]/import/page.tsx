'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getBudgetById, createTransaction, findOrCreateCategoryGroup, findOrCreateCategory, findOrCreateRecipient, getRecipientRules, applyRecipientRules, batchFindOrCreateCategoryGroups, batchFindOrCreateCategories, batchFindOrCreateRecipients, batchCreateTransactions } from '@/lib/db-helpers';
import type { Budget, RecipientRule } from '@/lib/database.types';
import { parseDanishDecimal, testDanishDecimalParser } from '@/lib/number-helpers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Stepper } from '@/components/ui/stepper';
import { Upload, FileSpreadsheet, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, ArrowLeft, ArrowRight, Settings, Check } from 'lucide-react';
import { toast } from 'sonner';
import { MerchantAdminDialog } from '@/components/merchant-admin-dialog';
import { supabase } from '@/lib/supabase';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ParsedRow {
  raw: string[];
  date?: string;
  text?: string;
  amount?: string;
  categoryGroup?: string;
  recipientName?: string;
  errors: string[];
}

interface ColumnMapping {
  date: number | null;
  text: number | null;
  amount: number | null;
  categoryGroup: number | null;
}

const STEPS = [
  { title: 'Upload', description: 'Vælg fil' },
  { title: 'Mapping', description: 'Kortlæg kolonner' },
  { title: 'Gem', description: 'Importer data' },
];

export default function ImportPage() {
  const router = useRouter();
  const params = useParams();
  const budgetId = params.id as string;

  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<string[][]>([]);

  function normalizeHeader(raw: string): string {
    return raw
      .replace(/[\uFEFF\u200B\u200C\u200D\u00AD\u2060]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  const normalizedHeaders = headers.map(normalizeHeader);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    date: null,
    text: null,
    amount: null,
    categoryGroup: null,
  });

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const [merchantDialogOpen, setMerchantDialogOpen] = useState(false);
  const [selectedMerchantText, setSelectedMerchantText] = useState('');
  const [selectedTransactionType, setSelectedTransactionType] = useState<'expense' | 'income'>('expense');
  const [recipientOverrides, setRecipientOverrides] = useState<Map<number, { name: string; id?: string; categoryId?: string }>>(new Map());
  const [recipientRules, setRecipientRules] = useState<RecipientRule[]>([]);
  const [mappingConfidence, setMappingConfidence] = useState<{ [key: string]: { confidence: number; method: string; header: string } }>({});
  const [mappingValidation, setMappingValidation] = useState<{ [key: string]: { valid: number; total: number; rate: number; header: string } }>({});
  const [rawCellValues, setRawCellValues] = useState<(string | number | null)[][]>([]);
  const [isXlsxFile, setIsXlsxFile] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [reviewedTexts, setReviewedTexts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();

    if (process.env.NODE_ENV === 'development') {
      testDanishDecimalParser();
    }
  }, [budgetId]);

  useEffect(() => {
    if (rawData.length === 0 || headers.length === 0) {
      setMappingValidation({});
      return;
    }

    const sampleSize = Math.min(50, rawData.length);
    const sampleData = rawData.slice(0, sampleSize);
    const validation: { [key: string]: { valid: number; total: number; rate: number; header: string } } = {};

    if (columnMapping.date !== null) {
      let validCount = 0;
      sampleData.forEach(row => {
        const value = row[columnMapping.date!];
        if (value && parseDate(String(value).trim())) {
          validCount++;
        }
      });
      validation.date = {
        valid: validCount,
        total: sampleData.length,
        rate: Math.round((validCount / sampleData.length) * 100),
        header: headers[columnMapping.date] || `Kolonne ${columnMapping.date + 1}`,
      };
    }

    if (columnMapping.amount !== null) {
      let validCount = 0;
      sampleData.forEach((_row, idx) => {
        if (resolveNumericValue(idx, columnMapping.amount!) !== null) {
          validCount++;
        }
      });
      validation.amount = {
        valid: validCount,
        total: sampleData.length,
        rate: Math.round((validCount / sampleData.length) * 100),
        header: headers[columnMapping.amount] || `Kolonne ${columnMapping.amount + 1}`,
      };
    }

    if (columnMapping.text !== null) {
      let validCount = 0;
      sampleData.forEach(row => {
        const value = row[columnMapping.text!];
        if (value && String(value).trim().length > 0) {
          validCount++;
        }
      });
      validation.text = {
        valid: validCount,
        total: sampleData.length,
        rate: Math.round((validCount / sampleData.length) * 100),
        header: headers[columnMapping.text] || `Kolonne ${columnMapping.text + 1}`,
      };
    }

    setMappingValidation(validation);
  }, [columnMapping, rawData, headers, rawCellValues, isXlsxFile]);

  const requiredValidationFailed =
    (mappingValidation.date ? mappingValidation.date.rate < 80 : false) ||
    (mappingValidation.amount ? mappingValidation.amount.rate < 80 : false) ||
    (mappingValidation.text ? mappingValidation.text.rate < 80 : false);

  async function loadData() {
    try {
      const budgetData = await getBudgetById(budgetId);

      if (!budgetData) {
        toast.error('Budget ikke fundet');
        router.push('/budgets');
        return;
      }

      setBudget(budgetData);

      const rules = await getRecipientRules();
      if (rules) {
        setRecipientRules(rules);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Kunne ikke indlæse data');
    } finally {
      setLoading(false);
    }
  }

  function convertExcelSerialToDate(serial: number): string {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + serial * 86400000);

    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${day}-${month}-${year}`;
    }
    return serial.toString();
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      (async () => {
        try {
          const data = event.target?.result;
          let parsedData: string[][] = [];
          let xlsxRawValues: (string | number | null)[][] = [];
          let fileIsXlsx = false;

          if (file.name.endsWith('.csv')) {
            const text = data as string;
            const lines = text.split('\n').filter(line => line.trim());
            parsedData = lines.map(line => {
              const matches = [];
              let current = '';
              let inQuotes = false;

              for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                  inQuotes = !inQuotes;
                } else if ((char === ',' || char === ';') && !inQuotes) {
                  matches.push(current.trim());
                  current = '';
                } else {
                  current += char;
                }
              }
              matches.push(current.trim());
              return matches;
            });
          } else {
            fileIsXlsx = true;
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(data, { type: 'binary', cellDates: false });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const ref = firstSheet['!ref'];
            if (!ref) {
              toast.error('Filen er tom');
              return;
            }
            const range = XLSX.utils.decode_range(ref);

            for (let r = range.s.r; r <= range.e.r; r++) {
              const displayRow: string[] = [];
              const rawRow: (string | number | null)[] = [];
              for (let c = range.s.c; c <= range.e.c; c++) {
                const addr = XLSX.utils.encode_cell({ r, c });
                const cell = firstSheet[addr];
                if (!cell) {
                  displayRow.push('');
                  rawRow.push(null);
                } else {
                  rawRow.push(cell.v ?? null);
                  displayRow.push(cell.w ?? (cell.v != null ? String(cell.v) : ''));
                }
              }
              if (displayRow.some(c => c)) {
                parsedData.push(displayRow);
                xlsxRawValues.push(rawRow);
              }
            }
          }

          if (parsedData.length === 0) {
            toast.error('Filen er tom');
            return;
          }

          const headerRow = parsedData[0];
          const dataRows = parsedData.slice(1);

          setHeaders(headerRow);
          setRawData(dataRows);
          setIsXlsxFile(fileIsXlsx);
          setRawCellValues(fileIsXlsx ? xlsxRawValues.slice(1) : []);

          autoDetectMapping(headerRow);
          setCurrentStep(1);
        } catch (error) {
          console.error('Error parsing file:', error);
          toast.error('Kunne ikke læse filen');
        }
      })();
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  }

  function autoDetectMapping(headerRow: string[]) {
    const mapping: ColumnMapping = {
      date: null,
      text: null,
      amount: null,
      categoryGroup: null,
    };

    const normalized = headerRow.map(normalizeHeader);

    const headerMap: { [key: string]: keyof ColumnMapping } = {
      'dato': 'date',
      'tekst': 'text',
      'beløb': 'amount',
    };

    normalized.forEach((nh, index) => {
      if (nh === 'saldo') return;

      const field = headerMap[nh];
      if (field && mapping[field] === null) {
        mapping[field] = index;
      }

      if ((nh === 'hovedkategori' || nh === 'kategori') && mapping.categoryGroup === null) {
        mapping.categoryGroup = index;
      }
    });

    setColumnMapping(mapping);
    setMappingConfidence({});
  }

  function resolveNumericValue(rowIdx: number, colIdx: number): number | null {
    if (isXlsxFile && rawCellValues[rowIdx]) {
      const raw = rawCellValues[rowIdx][colIdx];
      if (typeof raw === 'number') {
        return isFinite(raw) ? raw : null;
      }
    }
    const displayValue = rawData[rowIdx]?.[colIdx];
    if (displayValue == null) return null;
    return parseDanishDecimal(String(displayValue).trim());
  }

  function validateAndMapData() {
    const mapped: ParsedRow[] = rawData.map((row, rowIdx) => {
      const parsed: ParsedRow = {
        raw: row,
        errors: [],
      };

      if (columnMapping.date !== null) {
        const rawValue = row[columnMapping.date];
        let dateValue = rawValue !== null && rawValue !== undefined ? String(rawValue).trim() : '';

        let parsedDate: string | null = null;
        if (dateValue) {
          parsedDate = parseDate(dateValue);
        }
        if (!parsedDate && isXlsxFile && rawCellValues[rowIdx]) {
          const rawV = rawCellValues[rowIdx][columnMapping.date];
          if (typeof rawV === 'number' && rawV > 1000 && rawV < 200000) {
            const excelEpoch = new Date(1899, 11, 30);
            const d = new Date(excelEpoch.getTime() + rawV * 86400000);
            if (!isNaN(d.getTime())) {
              const y = d.getFullYear();
              const m = d.getMonth() + 1;
              const day = d.getDate();
              parsedDate = `${y}-${m.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            }
          }
        }

        if (parsedDate) {
          parsed.date = parsedDate;
        } else if (!dateValue) {
          parsed.errors.push('Mangler dato');
        } else {
          parsed.errors.push('Ugyldig dato');
        }
      } else {
        parsed.errors.push('Dato ikke kortlagt');
      }

      if (columnMapping.text !== null) {
        const rawValue = row[columnMapping.text];
        const textValue = rawValue !== null && rawValue !== undefined ? String(rawValue).trim() : '';
        if (textValue) {
          parsed.text = textValue;
          parsed.recipientName = textValue;
        } else {
          parsed.errors.push('Mangler tekst');
        }
      } else {
        parsed.errors.push('Tekst ikke kortlagt');
      }

      if (columnMapping.amount !== null) {
        const resolved = resolveNumericValue(rowIdx, columnMapping.amount);
        if (resolved !== null) {
          parsed.amount = resolved.toString();
        } else {
          const rawValue = row[columnMapping.amount];
          const amountValue = rawValue !== null && rawValue !== undefined ? String(rawValue).trim() : '';
          parsed.errors.push(amountValue ? 'Ugyldig beløb' : 'Mangler beløb');
        }
      } else {
        parsed.errors.push('Beløb ikke kortlagt');
      }

      if (columnMapping.categoryGroup !== null) {
        const rawValue = row[columnMapping.categoryGroup];
        parsed.categoryGroup = rawValue !== null && rawValue !== undefined ? String(rawValue).trim() || undefined : undefined;
      }

      return parsed;
    });

    mapped.forEach((row, index) => {
      if (recipientOverrides.has(index)) {
        const override = recipientOverrides.get(index);
        if (override) {
          row.recipientName = override.name;
        }
      }
    });

    setParsedRows(mapped);
    setCurrentStep(2);
  }

  function parseDate(value: string): string | null {
    const cleaned = value.trim();

    if (/,\d{1,2}$/.test(cleaned) || /^\d{1,3}\.\d{3}/.test(cleaned)) {
      return null;
    }

    if (/^-?\d+([.,]\d+)?$/.test(cleaned) && !/[\/\-]/.test(cleaned)) {
      const num = parseFloat(cleaned);
      if (!isNaN(num) && num > 1000 && num < 200000 && !cleaned.includes(',')) {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + num * 86400000);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const day = date.getDate();
          return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
      }
      return null;
    }

    const formats = [
      /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/,
      /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/,
      /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/,
    ];

    for (const format of formats) {
      const match = cleaned.match(format);
      if (match) {
        let day: number, month: number, year: number;

        if (format === formats[1]) {
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        } else {
          day = parseInt(match[1]);
          month = parseInt(match[2]);
          year = parseInt(match[3]);
          if (year < 100) {
            year += 2000;
          }
        }

        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
      }
    }

    return null;
  }

  function handleOpenMerchantAdmin(textValue: string, type: 'expense' | 'income') {
    setSelectedMerchantText(textValue);
    setSelectedTransactionType(type);
    setMerchantDialogOpen(true);
  }

  function hasRecipientRule(text: string): boolean {
    return recipientRules.some(rule => {
      if (!rule.text_match) return false;
      const textLower = text.toLowerCase();
      const matchLower = rule.text_match.toLowerCase();

      if (rule.match_type === 'exact') {
        return textLower === matchLower;
      } else {
        return textLower.includes(matchLower);
      }
    });
  }

  function toggleReviewedStatus(text: string) {
    setReviewedTexts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(text)) {
        newSet.delete(text);
      } else {
        newSet.add(text);
      }
      return newSet;
    });
  }

  function handleUpdateRecipientNames(updates: Map<number, { name: string; id?: string; categoryId?: string }>) {
    setRecipientOverrides(prev => {
      const newMap = new Map(prev);
      updates.forEach((value, key) => {
        newMap.set(key, value);
      });
      return newMap;
    });

    setParsedRows(prev => {
      const updated = [...prev];
      updates.forEach((value, index) => {
        if (updated[index]) {
          updated[index] = {
            ...updated[index],
            recipientName: value.name
          };
        }
      });
      return updated;
    });

    if (selectedMerchantText) {
      setReviewedTexts(prev => {
        const newSet = new Set(prev);
        newSet.add(selectedMerchantText);
        return newSet;
      });
    }

    toast.success('Modtagernavne opdateret');
  }

  async function handleSaveAsRule(textMatch: string, amountMatch: number | null, recipientId: string) {
    toast.success('Regel funktionalitet under udvikling');
  }

  async function clearBudgetPlans() {
    await supabase.from('budget_plans').delete().eq('budget_id', budgetId);
  }

  async function handleImport() {
    setImporting(true);
    const validRows = parsedRows.filter(row => row.errors.length === 0);
    setImportProgress({ current: 0, total: validRows.length });

    try {
      await clearBudgetPlans();

      const categoryGroupNames = validRows
        .map(row => row.categoryGroup)
        .filter((name): name is string => !!name);

      const categoryGroupMap = await batchFindOrCreateCategoryGroups(categoryGroupNames);
      setImportProgress({ current: Math.floor(validRows.length * 0.1), total: validRows.length });

      const recipientsToCreate = validRows
        .map((row, i) => {
          const rowIndex = parsedRows.indexOf(row);
          const override = recipientOverrides.get(rowIndex);
          const name = (override?.name || row.recipientName)?.trim();
          const categoryGroupId = row.categoryGroup ? categoryGroupMap.get(row.categoryGroup) || null : null;

          if (name && categoryGroupId) {
            return { name, categoryGroupId };
          }
          return null;
        })
        .filter((r): r is { name: string; categoryGroupId: string } => r !== null);

      const recipientMap = await batchFindOrCreateRecipients(recipientsToCreate);
      setImportProgress({ current: Math.floor(validRows.length * 0.3), total: validRows.length });

      const transactions = validRows.map((row, i) => {
        const rowIndex = parsedRows.indexOf(row);
        const recipientOverride = recipientOverrides.get(rowIndex);
        const effectiveRecipientName = (recipientOverride?.name || row.recipientName)?.trim();

        let categoryGroupId: string | null = null;

        if (row.categoryGroup) {
          categoryGroupId = categoryGroupMap.get(row.categoryGroup) || null;
        }

        const recipientKey = effectiveRecipientName && categoryGroupId ? `${effectiveRecipientName}|${categoryGroupId}` : null;
        const recipientId = recipientKey ? recipientMap.get(recipientKey) || null : null;

        return {
          budget_id: budgetId,
          date: row.date!,
          description: row.text!,
          recipient_name: effectiveRecipientName || null,
          recipient_id: recipientId,
          amount: parseFloat(row.amount!),
          category_group_id: categoryGroupId,
          sent_to_budget: false,
        };
      });

      setImportProgress({ current: Math.floor(validRows.length * 0.4), total: validRows.length });

      const BATCH_SIZE = 300;
      let totalInserted = 0;
      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        await batchCreateTransactions(batch);
        totalInserted += batch.length;
        setImportProgress({
          current: Math.floor(validRows.length * 0.4) + totalInserted,
          total: validRows.length
        });
      }

      setImporting(false);
      const recipientMsg = recipientsToCreate.length > 0 ? `, ${recipientsToCreate.length} modtagere oprettet` : '';
      toast.success(`Import gennemført: ${totalInserted} posteringer importeret${recipientMsg}`);
      router.push(`/budgets/${budgetId}/transactions`);
    } catch (error) {
      console.error('Error during import:', error);
      setImporting(false);
      toast.error('Kunne ikke importere posteringer');
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <p className="text-muted-foreground">Indlæser...</p>
        </div>
      </div>
    );
  }

  if (!budget) {
    return null;
  }

  const validRows = parsedRows.filter(row => row.errors.length === 0);
  const invalidRows = parsedRows.filter(row => row.errors.length > 0);
  const errorCounts = parsedRows.reduce((acc, row) => {
    row.errors.forEach(error => {
      acc[error] = (acc[error] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push(`/budgets/${budgetId}`)}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tilbage til plan
          </Button>
          <h1 className="text-4xl font-bold tracking-tight">Importer posteringer</h1>
          <p className="text-muted-foreground mt-1 text-base">Import er for dig der vil dykke ned i detaljerne.</p>
          <p className="text-muted-foreground text-base">Du kan sagtens planlægge uden.</p>
        </div>

        <Stepper steps={STEPS} currentStep={currentStep} />

        {currentStep === 0 && (
          <Card className="shadow-xl border-0 rounded-3xl">
            <CardHeader>
              <CardTitle className="text-2xl">Upload fil</CardTitle>
              <CardDescription className="text-base">
                Vælg en CSV eller Excel fil med dine posteringer
              </CardDescription>
            </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <Button asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    Vælg fil
                  </span>
                </Button>
              </Label>
              <Input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
              />
              <p className="text-sm text-muted-foreground mt-4">
                CSV eller Excel format (.csv, .xlsx, .xls)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Kortlæg kolonner</CardTitle>
            <CardDescription>
              {fileName} • {rawData.length} rækker
            </CardDescription>
            <p className="text-sm text-muted-foreground mt-4">
              Hjælp systemet med at forstå din fil ved at kortlægge kolonner til dato, beløb og tekst. Systemet foreslår automatisk de mest sandsynlige matches.
              Kontrollér at gyldighedsraten er mindst 80% før du fortsætter. Trin 2 tager 1-2 minutter.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.keys(mappingValidation).length > 0 && (
              <div className={`rounded-lg border p-4 text-sm ${requiredValidationFailed ? 'border-red-300 bg-red-50' : 'border-border bg-muted/30'}`}>
                <div className="font-semibold mb-3">Mapping status</div>
                <div className="space-y-2">
                  {mappingValidation.date && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium w-16">Dato:</span>
                        <span className="text-muted-foreground">&quot;{mappingValidation.date.header}&quot;</span>
                      </div>
                      <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                        mappingValidation.date.rate >= 80
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {mappingValidation.date.rate}% gyldig ({mappingValidation.date.valid}/{mappingValidation.date.total})
                      </span>
                    </div>
                  )}
                  {!mappingValidation.date && columnMapping.date === null && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-medium w-16">Dato:</span>
                      <span className="italic">Ikke valgt</span>
                    </div>
                  )}
                  {mappingValidation.amount && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium w-16">Beloeb:</span>
                        <span className="text-muted-foreground">&quot;{mappingValidation.amount.header}&quot;</span>
                      </div>
                      <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                        mappingValidation.amount.rate >= 80
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {mappingValidation.amount.rate}% gyldig ({mappingValidation.amount.valid}/{mappingValidation.amount.total})
                      </span>
                    </div>
                  )}
                  {!mappingValidation.amount && columnMapping.amount === null && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-medium w-16">Beloeb:</span>
                      <span className="italic">Ikke valgt</span>
                    </div>
                  )}
                  {mappingValidation.text && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium w-16">Modtagernavn:</span>
                        <span className="text-muted-foreground">&quot;{mappingValidation.text.header}&quot;</span>
                      </div>
                      <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                        mappingValidation.text.rate >= 80
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {mappingValidation.text.rate}% gyldig ({mappingValidation.text.valid}/{mappingValidation.text.total})
                      </span>
                    </div>
                  )}
                  {!mappingValidation.text && columnMapping.text === null && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-medium w-16">Modtagernavn:</span>
                      <span className="italic">Ikke valgt</span>
                    </div>
                  )}
                </div>
                {requiredValidationFailed && (
                  <div className="mt-3 flex items-center gap-2 text-red-600 font-medium text-xs">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    En eller flere påkrævede kolonner har for lav gyldighedsrate (&lt;80%). Vælg andre kolonner.
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dato (påkrævet)</Label>
                <Select
                  value={columnMapping.date !== null ? columnMapping.date.toString() : ''}
                  onValueChange={(value) => setColumnMapping({ ...columnMapping, date: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg kolonne" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((header, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        {header || `Kolonne ${idx + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {columnMapping.date !== null && (
                  <p className="text-label text-muted-foreground font-mono">norm: &quot;{normalizedHeaders[columnMapping.date]}&quot;</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Modtagernavn (påkrævet)</Label>
                <Select
                  value={columnMapping.text !== null ? columnMapping.text.toString() : ''}
                  onValueChange={(value) => setColumnMapping({ ...columnMapping, text: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg kolonne" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((header, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        {header || `Kolonne ${idx + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {columnMapping.text !== null && (
                  <p className="text-label text-muted-foreground font-mono">norm: &quot;{normalizedHeaders[columnMapping.text]}&quot;</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Beløb (påkrævet)</Label>
                <Select
                  value={columnMapping.amount !== null ? columnMapping.amount.toString() : ''}
                  onValueChange={(value) => setColumnMapping({ ...columnMapping, amount: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg kolonne" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((header, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        {header || `Kolonne ${idx + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {columnMapping.amount !== null && (
                  <p className="text-label text-muted-foreground font-mono">norm: &quot;{normalizedHeaders[columnMapping.amount]}&quot;</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Kategori (valgfri)</Label>
                <Select
                  value={columnMapping.categoryGroup !== null ? columnMapping.categoryGroup.toString() : 'none'}
                  onValueChange={(value) => setColumnMapping({ ...columnMapping, categoryGroup: value === 'none' ? null : parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg kolonne" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen</SelectItem>
                    {headers.map((header, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        {header || `Kolonne ${idx + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {columnMapping.categoryGroup !== null && (
                  <p className="text-label text-muted-foreground font-mono">norm: &quot;{normalizedHeaders[columnMapping.categoryGroup]}&quot;</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Forhåndsvisning ({Math.min(20, rawData.length)} af {rawData.length} rækker)</h3>
                {isXlsxFile && (
                  <Button variant="outline" size="sm" onClick={() => setDebugMode(d => !d)}>
                    {debugMode ? 'Skjul debug' : 'Vis debug'}
                  </Button>
                )}
              </div>
              {columnMapping.amount !== null && (() => {
                let pos = 0;
                let neg = 0;
                rawData.forEach((_row, idx) => {
                  const val = resolveNumericValue(idx, columnMapping.amount!);
                  if (val !== null) {
                    if (val >= 0) pos++;
                    else neg++;
                  }
                });
                if (pos > 0 && neg > 0) {
                  return (
                    <p className="text-sm text-muted-foreground mb-2">
                      Positive: {pos} rækker, Negative: {neg} rækker
                    </p>
                  );
                }
                return null;
              })()}
              <div className="border rounded-lg overflow-auto max-h-[32rem]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((header, idx) => (
                        <TableHead
                          key={idx}
                          className={
                            Object.values(columnMapping).includes(idx)
                              ? 'bg-primary/10 font-semibold'
                              : ''
                          }
                        >
                          {header || `Kolonne ${idx + 1}`}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawData.slice(0, 20).map((row, idx) => (
                      <TableRow key={idx}>
                        {row.map((cell, cellIdx) => {
                          const isMappedAmount = columnMapping.amount === cellIdx;
                          const parsed = isMappedAmount ? resolveNumericValue(idx, cellIdx) : null;
                          const rawV = isXlsxFile && rawCellValues[idx] ? rawCellValues[idx][cellIdx] : null;
                          return (
                            <TableCell
                              key={cellIdx}
                              className={
                                Object.values(columnMapping).includes(cellIdx)
                                  ? 'bg-primary/5'
                                  : ''
                              }
                            >
                              {isMappedAmount ? (
                                <div>
                                  <span className="whitespace-nowrap">
                                    {cell} <span className="text-muted-foreground mx-1">&rarr;</span> <span className={parsed !== null ? (parsed < 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium') : 'text-red-500 font-semibold uppercase'}>{parsed !== null ? parsed : 'UGYLDIGT'}</span>
                                  </span>
                                  {debugMode && idx < 10 && (
                                    <div className="text-xs text-muted-foreground font-mono mt-0.5 leading-tight">
                                      raw(v)={String(rawV)} | formatted(w)={cell} | parsed={String(parsed)}
                                    </div>
                                  )}
                                </div>
                              ) : cell}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(0)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Tilbage
              </Button>
              <Button
                onClick={validateAndMapData}
                disabled={columnMapping.date === null || columnMapping.text === null || columnMapping.amount === null || requiredValidationFailed}
              >
                Næste
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Klar til import</CardTitle>
            <CardDescription>
              Gennemse og bekræft import af posteringer
            </CardDescription>
            <p className="text-sm text-muted-foreground mt-4">
              Gennemgå gentagne tekster og opret regler for automatisk kategorisering. Dette sparer dig tid ved fremtidige importer.
              For {validRows.length} posteringer tager importen typisk {Math.ceil(validRows.length / 100)} {validRows.length <= 100 ? 'minut' : 'minutter'}.
              Klik &quot;Administrér&quot; på gentagne tekster for at oprette regler for automatisk modtager, kategori og hovedkategori.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total rækker</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{parsedRows.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Gyldige</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{validRows.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Ugyldige</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{invalidRows.length}</div>
                </CardContent>
              </Card>
            </div>

            {Object.keys(errorCounts).length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Valideringsfejl fundet:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {Object.entries(errorCounts).map(([error, count]) => (
                      <li key={error}>
                        {count} række{count !== 1 ? 'r' : ''}: {error}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 text-sm">
                    Ugyldige rækker vil blive sprunget over
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {validRows.length > 0 && (
              <>
                <div>
                  <h3 className="font-medium mb-2">Gentagne tekster</h3>
                  <Card>
                    <CardContent className="pt-6">
                      {(() => {
                        const expenseCounts: Record<string, number> = {};
                        const incomeCounts: Record<string, number> = {};

                        validRows.forEach(row => {
                          if (row.text && row.amount !== undefined) {
                            const amount = typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount;
                            if (!isNaN(amount)) {
                              if (amount < 0) {
                                expenseCounts[row.text] = (expenseCounts[row.text] || 0) + 1;
                              } else if (amount > 0) {
                                incomeCounts[row.text] = (incomeCounts[row.text] || 0) + 1;
                              }
                            }
                          }
                        });

                        const expenseTexts = Object.entries(expenseCounts)
                          .filter(([text, count]) => count >= 2)
                          .sort((a, b) => b[1] - a[1]);

                        const incomeTexts = Object.entries(incomeCounts)
                          .filter(([text, count]) => count >= 2)
                          .sort((a, b) => b[1] - a[1]);

                        const expenseTextSet = new Set(expenseTexts.map(([text]) => text));
                        const incomeTextSet = new Set(incomeTexts.map(([text]) => text));
                        const mixedTexts = new Set(
                          Array.from(expenseTextSet).filter(text => incomeTextSet.has(text))
                        );

                        const totalUniqueTexts = new Set([...Array.from(expenseTextSet), ...Array.from(incomeTextSet)]).size;
                        const allTexts = [...expenseTexts, ...incomeTexts];
                        const textsWithRules = allTexts.filter(([text]) => hasRecipientRule(text)).length;
                        const managedCount = allTexts.filter(([text]) => hasRecipientRule(text) || reviewedTexts.has(text)).length;

                        const renderTextList = (texts: [string, number][], title: string, type: 'expense' | 'income') => (
                          <div className="flex-1">
                            <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
                            <div className="max-h-[600px] overflow-y-auto border rounded-lg">
                              <div className="space-y-1 p-2">
                                {texts.length === 0 ? (
                                  <p className="text-sm text-muted-foreground text-center py-4">Ingen gentagne tekster</p>
                                ) : (
                                  texts.map(([text, count]) => {
                                    const hasRule = hasRecipientRule(text);
                                    const isReviewed = reviewedTexts.has(text);
                                    const isManaged = hasRule || isReviewed;
                                    const isMixed = mixedTexts.has(text);

                                    return (
                                      <div key={text} className="flex justify-between items-center text-sm py-1 px-2 hover:bg-secondary/50 rounded group">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <Checkbox
                                            checked={isReviewed || hasRule}
                                            onCheckedChange={() => !hasRule && toggleReviewedStatus(text)}
                                            disabled={hasRule}
                                            className="flex-shrink-0"
                                          />
                                          {hasRule && (
                                            <div className="flex-shrink-0 w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center" title="Har recipient regel">
                                              <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                                            </div>
                                          )}
                                          <span className={`truncate flex-1 ${isManaged ? 'text-muted-foreground' : ''}`}>{text}</span>
                                          {isMixed && (
                                            <span className="flex-shrink-0 text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                                              Blandet
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <span className="font-medium text-muted-foreground">{count}x</span>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleOpenMerchantAdmin(text, type)}
                                          >
                                            <Settings className="h-4 w-4 mr-1" />
                                            Administrér
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        );

                        return (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Gentagne tekster:</span>
                                <span className="ml-2 font-semibold">{totalUniqueTexts}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Total posteringer:</span>
                                <span className="ml-2 font-semibold">{validRows.length}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Med regler:</span>
                                <span className="ml-2 font-semibold text-green-600">{textsWithRules}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Gennemgået:</span>
                                <span className="ml-2 font-semibold">{managedCount}/{totalUniqueTexts}</span>
                              </div>
                            </div>
                            <div className="flex gap-4">
                              {renderTextList(expenseTexts, 'Udgifter (2+ posteringer)', 'expense')}
                              {renderTextList(incomeTexts, 'Indtægter (2+ posteringer)', 'income')}
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium">Estimater erstattes af faktiske tal</div>
                <div className="text-sm mt-1">
                  Når du importerer, slettes alle planlagte estimater i faste udgifter. Kortene på forsiden og faste udgifter vil herefter vise dine faktiske posteringer i stedet.
                </div>
              </AlertDescription>
            </Alert>

            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium">Auto-oprettelse aktiveret</div>
                <div className="text-sm mt-1">
                  Nye kategorier og hovedkategorier vil automatisk blive oprettet hvis de ikke findes
                </div>
              </AlertDescription>
            </Alert>


            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(1)} disabled={importing}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Tilbage
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || validRows.length === 0}
              >
                {importing ? 'Importerer...' : `Importer ${validRows.length} posteringer`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <MerchantAdminDialog
        open={merchantDialogOpen}
        onOpenChange={setMerchantDialogOpen}
        textValue={selectedMerchantText}
        transactions={parsedRows
          .map((row, originalIndex) => ({
            row,
            originalIndex,
          }))
          .filter(({ row }) => {
            if (row.errors.length !== 0 || row.text !== selectedMerchantText) {
              return false;
            }
            const amount = parseFloat(row.amount || '0');
            if (selectedTransactionType === 'expense') {
              return amount < 0;
            } else {
              return amount > 0;
            }
          })
          .map(({ row, originalIndex }) => ({
            date: row.date!,
            amount: row.amount!,
            recipientName: recipientOverrides.get(originalIndex)?.name || row.recipientName,
            recipientId: recipientOverrides.get(originalIndex)?.id,
            index: originalIndex,
          }))}
        onUpdateRecipientNames={handleUpdateRecipientNames}
        onSaveAsRule={handleSaveAsRule}
        isImportMode={true}
        transactionType={selectedTransactionType}
      />

      <Dialog open={importing && importProgress.total > 0} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" hideClose>
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <h3 className="text-xl font-semibold mb-2">Importerer posteringer...</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {importProgress.current} / {importProgress.total} færdig
            </p>
            <div className="w-full space-y-3">
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-600 transition-all duration-300"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-center text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                {Math.round((importProgress.current / importProgress.total) * 100)}%
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
