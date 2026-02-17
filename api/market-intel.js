import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const MAX_REPORTS = 20;
const LOCAL_FILE_CANDIDATES = [
  'src/data/market-intel.json',
  'src/data/market_intel_reports.json',
  'saved/market-intel.json',
  'saved/market_intel_reports.json',
  'public/market-intel.json',
  'public/market_intel_reports.json',
];

const LOCAL_DIRECTORY_CANDIDATES = [
  'market-intel',
  'saved/market-intel',
  'saved/market_intel',
  'src/data/market-intel',
  'src/data/market_intel',
  'public/market-intel',
  'public/market_intel',
];

const resolveSupabaseUrl = () => {
  return process.env.VITE_SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env.SUPABASE_URL
    || '';
};

const toTimestamp = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeSources = (rawSources) => {
  if (!rawSources) return [];

  if (Array.isArray(rawSources)) {
    return rawSources
      .map((source) => (typeof source === 'string' ? source : source?.name || source?.source || ''))
      .map((source) => String(source).trim())
      .filter(Boolean);
  }

  if (typeof rawSources === 'string') {
    const trimmed = rawSources.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeSources(parsed);
      if (parsed && typeof parsed === 'object') return normalizeSources(Object.values(parsed));
    } catch {}

    return trimmed
      .split(/[|,]/)
      .map((source) => source.trim())
      .filter(Boolean);
  }

  if (typeof rawSources === 'object') {
    return normalizeSources(Object.values(rawSources));
  }

  return [];
};

const normalizeReport = (report = {}, fallbackId = '') => {
  const reportContent = String(report.report_content || report.content || '').trim();
  const headlineFromContent = reportContent
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^#{1,3}\s+/, '')
    ?.slice(0, 140);

  const createdAt = report.created_at
    || report.createdAt
    || report.timestamp
    || report.date
    || new Date().toISOString();

  return {
    id: report.id || fallbackId,
    headline: String(report.headline || report.title || headlineFromContent || 'Market Intel Update').trim(),
    report_content: reportContent,
    sources: normalizeSources(report.sources),
    created_at: new Date(toTimestamp(createdAt) || Date.now()).toISOString(),
  };
};

const extractDateFromFileName = (fileName = '') => {
  const normalizedName = String(fileName || '');

  const isoMatch = normalizedName.match(/(20\d{2})[-_](\d{2})[-_](\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00.000Z`;
  }

  const dmyMatch = normalizedName.match(/(\d{2})[-_](\d{2})[-_](20\d{2})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}T00:00:00.000Z`;
  }

  return null;
};

const collectLocalFiles = async (rootDir, depth = 0) => {
  if (depth > 3) return [];

  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const collected = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const nestedFiles = await collectLocalFiles(absolutePath, depth + 1);
      collected.push(...nestedFiles);
      continue;
    }

    if (/\.(json|md|markdown|txt)$/i.test(entry.name)) {
      collected.push(absolutePath);
    }
  }

  return collected;
};

const parseLocalJsonFile = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.reports)
      ? parsed.reports
      : [];

  return rows.map((row, index) => normalizeReport(row, `${path.basename(filePath)}-${index}`));
};

const parseLocalTextFile = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf8');
  const stats = await fs.stat(filePath);

  const headline = content
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^#{1,3}\s+/, '')
    ?.slice(0, 140);

  const inferredCreatedAt = extractDateFromFileName(path.basename(filePath)) || stats.mtime.toISOString();

  return [normalizeReport({
    id: path.basename(filePath),
    headline: headline || path.basename(filePath),
    report_content: content,
    created_at: inferredCreatedAt,
    sources: ['Local Archive'],
  }, path.basename(filePath))];
};

const readLocalReports = async () => {
  const cwd = process.cwd();
  const reports = [];

  for (const relativePath of LOCAL_FILE_CANDIDATES) {
    const absolutePath = path.join(cwd, relativePath);

    try {
      await fs.access(absolutePath);
    } catch {
      continue;
    }

    try {
      const parsedReports = await parseLocalJsonFile(absolutePath);
      reports.push(...parsedReports);
    } catch (error) {
      console.error(`Failed parsing local market intel file ${absolutePath}:`, error);
    }
  }

  for (const relativeDir of LOCAL_DIRECTORY_CANDIDATES) {
    const absoluteDir = path.join(cwd, relativeDir);
    let files = [];

    try {
      files = await collectLocalFiles(absoluteDir);
    } catch {
      continue;
    }

    for (const filePath of files) {
      try {
        if (/\.json$/i.test(filePath)) {
          const parsedReports = await parseLocalJsonFile(filePath);
          reports.push(...parsedReports);
        } else {
          const parsedReports = await parseLocalTextFile(filePath);
          reports.push(...parsedReports);
        }
      } catch (error) {
        console.error(`Failed parsing local market intel report ${filePath}:`, error);
      }
    }
  }

  const deduped = [];
  const seen = new Set();

  for (const report of reports) {
    const key = `${report.id}::${report.created_at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(report);
  }

  deduped.sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at));
  return deduped.slice(0, MAX_REPORTS);
};

const readSupabaseReports = async () => {
  const supabaseUrl = resolveSupabaseUrl();
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase credentials are missing');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('market_intel_reports')
    .select('id, headline, report_content, sources, created_at')
    .order('created_at', { ascending: false })
    .limit(MAX_REPORTS);

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row, index) => normalizeReport(row, `supabase-market-intel-${index}`));
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let reports = [];

  try {
    reports = await readSupabaseReports();
  } catch (error) {
    console.error('Failed loading market intel from Supabase:', error);
  }

  if (!reports.length) {
    try {
      reports = await readLocalReports();
    } catch (error) {
      console.error('Failed loading market intel local fallback:', error);
    }
  }

  res.status(200).json(reports.slice(0, MAX_REPORTS).map((report) => ({
    id: report.id,
    headline: report.headline,
    report_content: report.report_content,
    sources: report.sources,
    created_at: report.created_at,
  })));
}
