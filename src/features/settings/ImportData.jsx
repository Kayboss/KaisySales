import { useMemo, useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  FileSpreadsheet,
  Upload,
  Download,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  RotateCcw,
  GitMerge,
  Copy,
} from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { getEntitiesForMode, getEntity, getField, getWritableFields } from '../../utils/import/schema';
import { parseDelimited } from '../../utils/import/csv';
import { matchHeaders } from '../../utils/import/headers';
import { validateRows } from '../../utils/import/validate';
import { suggestDayFirst } from '../../utils/import/coerce';
import { buildTemplate } from '../../utils/import/template';
import { findDuplicates } from '../../utils/import/duplicates';
import { importRows, undoImport, fetchExistingRows, ensureImportCategories } from '../../services/api';

const STEP_ORDER = ['entity', 'source', 'mapping', 'review', 'done'];
const STEP_LABELS = ['What', 'Data', 'Columns', 'Check', 'Done'];

const Shell = styled.div`
  max-width: 820px;
  margin: 0 auto;
  padding-bottom: calc(2rem + env(safe-area-inset-bottom));
`;

const Steps = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
`;

const StepDot = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: ${({ $state, theme }) => ($state === 'done' || $state === 'active' ? theme.colors.primary : theme.colors.text.muted)};
  font-size: 0.8rem;
  font-weight: 700;
`;

const Dot = styled.span`
  width: 26px;
  height: 26px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  background: ${({ $state, theme }) =>
    $state === 'done' ? theme.colors.tertiary : $state === 'active' ? theme.colors.primary : theme.colors.background.surfaceVariant};
  color: ${({ $state, theme }) => ($state === 'active' || $state === 'done' ? theme.colors.text.onPrimary : theme.colors.text.muted)};
`;

const StepSep = styled.span`
  width: 18px;
  height: 1px;
  background: ${({ theme }) => theme.colors.outlineVariant};
`;

const Card = styled.div`
  background: ${({ theme }) => theme.colors.background.surface};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.soft};
  padding: 2rem;
  margin-bottom: 1.25rem;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.fontSizes['2xl']};
  color: ${({ theme }) => theme.colors.text.main};
  margin: 0 0 0.25rem;
`;

const Subtitle = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  margin: 0 0 1.5rem;
  font-size: 0.95rem;
  line-height: 1.5;
`;

const EntityGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 1rem;
`;

const EntityCard = styled.button`
  text-align: left;
  background: ${({ theme }) => theme.colors.background.surface};
  border: 2px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 1.25rem;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }

  strong {
    display: block;
    color: ${({ theme }) => theme.colors.primary};
    font-size: 1rem;
    margin-bottom: 0.35rem;
  }

  span {
    display: block;
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: 0.82rem;
    line-height: 1.45;
  }
`;

const TemplateLink = styled.button`
  margin-top: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.secondary};
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0;

  &:hover {
    text-decoration: underline;
  }
`;

const DropZone = styled.label`
  display: block;
  border: 2px dashed ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 2.5rem 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};
  color: ${({ theme }) => theme.colors.text.muted};
  background: ${({ theme }) => theme.colors.background.main};
  margin-bottom: 1.25rem;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }

  strong {
    display: block;
    margin-top: 0.5rem;
    color: ${({ theme }) => theme.colors.primary};
  }

  small {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.8rem;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 200px;
  padding: 1rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-family: ${({ theme }) => theme.fonts.data};
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.text.main};
  background: ${({ theme }) => theme.colors.background.main};
  resize: vertical;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px rgba(111, 36, 10, 0.1);
  }
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1.5rem;
  flex-wrap: wrap;
`;

const PrimaryButton = styled.button`
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.text.onPrimary};
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: 700;
  font-size: 0.95rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    filter: brightness(1.12);
  }

  &:disabled {
    background: ${({ theme }) => theme.colors.border};
    cursor: not-allowed;
  }
`;

const GhostButton = styled.button`
  background: ${({ theme }) => theme.colors.background.surface};
  color: ${({ theme }) => theme.colors.text.main};
  padding: 0.8rem 1.5rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: 700;
  font-size: 0.95rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.background.main};
  }
`;

const Banner = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.9rem 1rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: 0.85rem;
  line-height: 1.45;
  margin-bottom: 1.25rem;
  background: ${({ $tone }) =>
    $tone === 'error'
      ? 'rgba(186, 26, 26, 0.08)'
      : $tone === 'warn'
        ? 'rgba(135, 82, 0, 0.1)'
        : 'rgba(37, 67, 47, 0.08)'};
  color: ${({ $tone, theme }) =>
    $tone === 'error' ? theme.colors.status.error : $tone === 'warn' ? theme.colors.status.warning : theme.colors.status.success};
`;

const Columns = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const ColumnRow = styled.div`
  display: grid;
  grid-template-columns: 2.25rem 1.1fr 1.2fr auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.7rem 0.85rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.background.main};

  @media (max-width: 600px) {
    grid-template-columns: 1fr auto;
  }
`;

const IndexBadge = styled.span`
  width: 26px;
  height: 26px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background: ${({ theme }) => theme.colors.background.surfaceVariant};
  color: ${({ theme }) => theme.colors.text.muted};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 700;

  @media (max-width: 600px) {
    display: none;
  }
`;

const HeaderText = styled.div`
  min-width: 0;

  strong {
    display: block;
    font-size: 0.9rem;
    color: ${({ theme }) => theme.colors.text.main};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: 0.75rem;
  }
`;

const FieldSelect = styled.select`
  padding: 0.55rem 0.6rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-family: inherit;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.text.main};
  background: ${({ theme }) => theme.colors.background.surface};
  max-width: 100%;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const StatusPill = styled.span`
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  white-space: nowrap;
  background: ${({ $tone }) => ($tone === 'good' ? 'rgba(37, 67, 47, 0.12)' : $tone === 'warn' ? 'rgba(135, 82, 0, 0.15)' : 'rgba(186, 26, 26, 0.1)')};
  color: ${({ $tone }) => ($tone === 'good' ? '#25432F' : $tone === 'warn' ? '#875200' : '#BA1A1A')};

  @media (max-width: 600px) {
    grid-column: 2;
  }
`;

const RadioRow = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 0.6rem;
  flex-wrap: wrap;
`;

const RadioLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.text.main};
  cursor: pointer;

  input {
    accent-color: ${({ theme }) => theme.colors.primary};
  }
`;

const Preview = styled.div`
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.text.muted};

  pre {
    margin: 0.5rem 0 0;
    font-family: ${({ theme }) => theme.fonts.data};
    font-size: 0.78rem;
    white-space: pre-wrap;
    word-break: break-all;
  }
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.25rem;
`;

const StatCard = styled.div`
  background: ${({ theme }) => theme.colors.background.main};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 1rem;
  text-align: center;

  div {
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: 700;
    color: ${({ $tone }) => $tone === 'good' ? '#25432F' : $tone === 'warn' ? '#875200' : $tone === 'bad' ? '#BA1A1A' : '#1C1C18'};
  }

  span {
    font-size: 0.78rem;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text.muted};
  }
`;

const IssueList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 0.25rem;
`;

const IssueRow = styled.div`
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  font-size: 0.82rem;
  line-height: 1.45;
  padding: 0.55rem 0.7rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: ${({ $tone }) => ($tone === 'bad' ? 'rgba(186, 26, 26, 0.06)' : 'rgba(135, 82, 0, 0.08)')};
  color: ${({ $tone }) => ($tone === 'bad' ? '#BA1A1A' : '#875200')};

  .row-no {
    font-weight: 700;
    flex-shrink: 0;
  }
`;

const DupCard = styled(Card)`
  border-color: ${({ theme }) => theme.colors.status.warning};
`;

const DupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: ${({ theme }) => theme.colors.status.warning};
  font-weight: 700;
  margin-bottom: 0.75rem;

  svg {
    flex-shrink: 0;
  }
`;

const ChoiceBlock = styled.div`
  margin-top: 1rem;
`;

const ChoiceTitle = styled.div`
  font-weight: 700;
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.text.main};
  margin-bottom: 0.25rem;

  span {
    color: ${({ theme }) => theme.colors.text.muted};
    font-weight: 400;
  }
`;

const MatchExamples = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0.5rem 0 0.65rem;
  padding: 0.6rem 0.8rem;
  background: ${({ theme }) => theme.colors.background.main};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.text.main};

  code {
    font-family: ${({ theme }) => theme.fonts.data};
    color: ${({ theme }) => theme.colors.secondary};
    font-size: 0.8rem;
  }
`;

const SuccessPanel = styled.div`
  text-align: center;
  padding: 1rem 0 0.5rem;

  svg {
    color: ${({ theme }) => theme.colors.tertiary};
  }

  h2 {
    color: ${({ theme }) => theme.colors.tertiary};
    margin: 0.75rem 0 0.25rem;
    font-size: 1.5rem;
  }

  p {
    color: ${({ theme }) => theme.colors.text.muted};
    margin: 0 0 1.25rem;
    line-height: 1.5;
  }
`;

const SmallNote = styled.p`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.text.muted};
  margin: 0.5rem 0 0;
  line-height: 1.5;
`;

const countPillTone = (confidence) => {
  if (confidence === 'exact') return 'good';
  if (confidence === 'duplicate') return 'bad';
  return 'warn';
};

const ImportData = () => {
  const { businessType } = useSettingsStore();
  const [step, setStep] = useState('entity');
  const [entityKey, setEntityKey] = useState(null);
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [columns, setColumns] = useState([]);
  const [dayFirst, setDayFirst] = useState(null);
  const [importing, setImporting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');
  const [existing, setExisting] = useState(null);
  const [existingError, setExistingError] = useState('');
  const [collision, setCollision] = useState('replace');
  const [near, setNear] = useState('merge');

  useEffect(() => {
    if (step !== 'review' || existing !== null) return undefined;
    let alive = true;
    fetchExistingRows(entityKey)
      .then((rows) => {
        if (alive) setExisting(rows);
      })
      .catch((error) => {
        if (alive) {
          setExisting([]);
          setExistingError(error.message || 'Could not check for existing records.');
        }
      });
    return () => {
      alive = false;
    };
  }, [step, entityKey, existing]);

  const entities = getEntitiesForMode(businessType);
  const entity = entityKey ? getEntity(entityKey) : null;

  const stepIndex = STEP_ORDER.indexOf(step);

  const mapping = useMemo(() => {
    const result = {};
    for (const column of columns) {
      if (column.field) result[column.index] = column.field;
    }
    return result;
  }, [columns]);

  const validation = useMemo(() => {
    if (!entity || !parsed) return null;
    return validateRows(entity, parsed.rows, mapping, { dayFirst });
  }, [entity, parsed, mapping, dayFirst]);

  const dateSuggestion = useMemo(() => {
    if (!entity || !parsed) return null;
    const indexes = columns
      .filter((column) => column.field && getField(entity, column.field)?.type === 'date')
      .map((column) => column.index);
    if (indexes.length === 0) return null;
    const samples = [];
    for (const row of parsed.rows.slice(0, 40)) {
      for (const index of indexes) samples.push(row[index]);
    }
    return suggestDayFirst(samples);
  }, [entity, parsed, columns]);

  const hasDateColumn = useMemo(
    () => Boolean(entity) && columns.some((column) => column.field && getField(entity, column.field)?.type === 'date'),
    [entity, columns]
  );

  const writableFields = entity ? getWritableFields(entity) : [];
  const requiredFields = entity ? entity.fields.filter((field) => field.required) : [];

  const readyCount = validation ? validation.summary.ready : 0;
  const blockedCount = validation ? validation.summary.blocked : 0;
  const emptyCount = validation ? validation.summary.empty : 0;
  const warnCount = validation ? validation.summary.withWarnings : 0;
  const ambiguousCount = validation
    ? validation.results.filter((row) => row.issues.some((issue) => issue.kind === 'ambiguous')).length
    : 0;

  const readyRecords = useMemo(
    () =>
      validation
        ? validation.results.filter((row) => !row.hasErrors && !row.isEmpty).map((row) => row.record)
        : [],
    [validation]
  );

  const duplicates = useMemo(() => {
    if (!entity || !existing) return { exact: [], near: [], unique: readyRecords.length };
    if (readyRecords.length === 0) return { exact: [], near: [], unique: 0 };
    return findDuplicates(entity, readyRecords, existing);
  }, [entity, existing, readyRecords]);

  const resetParse = () => {
    setRawText('');
    setFileName('');
    setParsed(null);
    setColumns([]);
    setDayFirst(null);
    setMessage('');
  };

  const parseText = (text) => {
    const fresh = parseDelimited(String(text || ''));
    setParsed(fresh);
    const matched = matchHeaders(fresh.headers, entity);
    setColumns(matched.columns);

    if (fresh.headers.length === 0) {
      setMessage('We could not find a header row in this text. Paste column headings on the first line.');
      return;
    }
    if (matched.needsReview) {
      setMessage('Some columns could not be matched exactly. Check the suggestions before importing.');
    }
    setStep('mapping');
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawText(String(reader.result || ''));
      setFileName(file.name);
      parseText(reader.result);
    };
    reader.readAsText(file);
  };

  const chooseEntity = (key) => {
    setEntityKey(key);
    resetParse();
    setStep('source');
  };

  const downloadTemplate = (key) => {
    const template = buildTemplate(key);
    if (!template) return;
    const blob = new Blob([template.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = template.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const setColumnField = (index, fieldKey) => {
    setColumns((prev) =>
      prev.map((column) =>
        column.index === index
          ? { ...column, field: fieldKey || null, confidence: fieldKey ? 'manual' : 'ignored' }
          : column
      )
    );
  };

  const goBack = () => {
    if (step === 'source') {
      resetParse();
      setEntityKey(null);
      setStep('entity');
    } else if (step === 'mapping') {
      setStep('source');
    } else if (step === 'review') {
      setStep('mapping');
    }
  };

  const runImport = async () => {
    if (!entity || !validation || readyRecords.length === 0) return;

    setImporting(true);
    setMessage('');
    setExistingError('');
    try {
      const categoryNames = readyRecords.map((record) => record.category).filter(Boolean);
      const cats = await ensureImportCategories(entityKey, categoryNames);
      const saved = await importRows(entityKey, readyRecords, {
        existing: existing || [],
        collision,
        near,
      });

      const applied = saved.inserted.length + saved.replaced.length + saved.merged.length;
      if (saved.success || applied > 0) {
        setResult({
          attempted: saved.attempted,
          inserted: saved.inserted,
          replaced: saved.replaced,
          merged: saved.merged,
          categoriesCreated: cats.success ? cats.created : 0,
          partially: Boolean(saved.partial),
          error: saved.error,
        });
        setStep('done');
      } else {
        setMessage(saved.error?.message || 'Nothing could be saved. Review the problems above and try again.');
      }
    } catch (error) {
      setMessage(error.message || 'The import failed unexpectedly.');
    } finally {
      setImporting(false);
    }
  };

  const handleUndo = async () => {
    const insertedIds = (result?.inserted || []).map((row) => row.id);
    const previous = [
      ...(result?.replaced || []).map((row) => row.previous),
      ...(result?.merged || []).map((row) => row.previous),
    ];
    if (insertedIds.length === 0 && previous.length === 0) return;

    setUndoing(true);
    const removed = await undoImport(entityKey, { insertedIds, previous });
    setUndoing(false);
    if (!removed.success) {
      setMessage(removed.error?.message || 'Could not undo the import.');
      return;
    }

    const restored = previous.length > 0 ? `${previous.length} existing row(s) were restored.` : '';
    setRawText('');
    setResult(null);
    setFileName('');
    setParsed(null);
    setColumns([]);
    setDayFirst(null);
    setExisting(null);
    setExistingError('');
    setMessage(
      `${insertedIds.length} row(s) you just added were removed. ${restored}`.trim()
    );
    setStep('source');
  };

  const startOver = () => {
    resetParse();
    setResult(null);
    setEntityKey(null);
    setExisting(null);
    setExistingError('');
    setCollision('replace');
    setNear('merge');
    setStep('entity');
  };

  const issueRows = validation
    ? validation.results
        .filter((row) => row.issues.length > 0)
        .map((row) => ({ row, first: row.issues[0], tone: row.hasErrors ? 'bad' : 'warn' }))
    : [];

  const recordLabel = (row) =>
    (entity && entity.matchedBy && row && row[entity.matchedBy]) ||
    (row && Object.values(row).find((value) => typeof value === 'string' && value.trim())) ||
    '(no name)';

  return (
    <Shell>
      <Steps>
        {STEP_ORDER.map((key, index) => {
          const state = index === stepIndex ? 'active' : index < stepIndex ? 'done' : 'todo';
          return (
            <span key={key} style={{ display: 'contents' }}>
              <StepDot $state={state}>
                <Dot $state={state}>{state === 'done' ? <Check size={14} /> : index + 1}</Dot>
                {STEP_LABELS[index]}
              </StepDot>
              {index < STEP_ORDER.length - 1 && <StepSep />}
            </span>
          );
        })}
      </Steps>

      {step === 'entity' && (
        <Card>
          <Title>What are you importing?</Title>
          <Subtitle>
            Pick what your file holds. Each file imports into one place — run it again for the next one.
          </Subtitle>
          <EntityGrid>
            {entities.map((item) => (
              <EntityCard key={item.key} onClick={() => chooseEntity(item.key)}>
                <FileSpreadsheet size={20} color="#6F240A" style={{ marginBottom: '0.5rem' }} />
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
                <TemplateLink onClick={(event) => { event.stopPropagation(); downloadTemplate(item.key); }}>
                  <Download size={13} /> Download a template
                </TemplateLink>
              </EntityCard>
            ))}
          </EntityGrid>
        </Card>
      )}

      {step === 'source' && entity && (
        <Card>
          <Title>Bring your data</Title>
          <Subtitle>
            {entity.label} — paste CSV below, or upload a .csv / .tsv / .txt file. Values in quotation marks and
            names with commas are fine.
          </Subtitle>

          <DropZone>
            <Upload size={26} />
            <strong>{fileName || 'Choose a CSV file'}</strong>
            <small>or drop a file here — first row is read as the column headings</small>
            <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values" onChange={handleFile} style={{ display: 'none' }} />
          </DropZone>

          <TextArea
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder={'Paste your data here, e.g.\n\nItem Name,Quantity,Selling Price\nWheat flour, 5, GHS 1000.00\nRice, 10, GHS 700.00'}
          />

          <SmallNote>Rows with all cells empty are skipped automatically. Anything that can&apos;t be read is reported, never silently changed to zero.</SmallNote>

          <ButtonRow>
            <GhostButton onClick={goBack}>
              <ArrowLeft size={16} /> Back
            </GhostButton>
            <PrimaryButton disabled={!rawText.trim()} onClick={() => parseText(rawText)}>
              Continue to columns <ArrowRight size={16} />
            </PrimaryButton>
          </ButtonRow>
        </Card>
      )}

      {step === 'mapping' && entity && parsed && (
        <Card>
          <Title>Match the columns</Title>
          <Subtitle>
            We matched most columns for you. Check anything highlighted and assign the rest before continuing.
          </Subtitle>

          {message && (
            <Banner $tone="warn">
              <Info size={18} />
              <span>{message}</span>
            </Banner>
          )}

          {requiredFields.length > 0 && (
            <Banner>
              <Info size={18} />
              <span>
                Needed for every row:{' '}
                {requiredFields.map((field) => field.label).join(', ')}. If a file is missing one, those rows will
                be flagged instead of guessed.
              </span>
            </Banner>
          )}

          {hasDateColumn && (
            <Banner $tone="warn">
              <AlertCircle size={18} />
              <span>
                How are dates written in this file?
                {dateSuggestion === true && ' Most dates look like day-first (DD/MM/YYYY).'}
                {dateSuggestion === false && ' Most dates look like month-first (MM/DD/YYYY).'}
                {dateSuggestion === null && ' We cannot tell which way around to read them yet.'}
              </span>
              <RadioRow>
                <RadioLabel>
                  <input type="radio" checked={dayFirst === true} onChange={() => setDayFirst(true)} />
                  Day first — 05/03/2026 = 5 March
                </RadioLabel>
                <RadioLabel>
                  <input type="radio" checked={dayFirst === false} onChange={() => setDayFirst(false)} />
                  Month first — 05/03/2026 = 3 May
                </RadioLabel>
              </RadioRow>
            </Banner>
          )}

          <Columns>
            {columns.map((column) => {
              const usedElsewhere = new Set(
                columns.filter((c) => c.index !== column.index && c.field).map((c) => c.field)
              );
              return (
                <ColumnRow key={column.index}>
                  <IndexBadge>{column.index + 1}</IndexBadge>
                  <HeaderText>
                    <strong>{column.header || '(blank column)'}</strong>
                    <small>
                      {column.candidates?.length > 1
                        ? `Could be: ${writableFields.filter((f) => column.candidates.includes(f.key)).map((f) => f.label).join(' or ')}`
                        : ''}
                    </small>
                  </HeaderText>
                  <FieldSelect value={column.field || ''} onChange={(event) => setColumnField(column.index, event.target.value)}>
                    <option value="">Don&apos;t import</option>
                    {writableFields.map((field) => (
                      <option key={field.key} value={field.key} disabled={usedElsewhere.has(field.key)}>
                        {field.label}
                      </option>
                    ))}
                  </FieldSelect>
                  <StatusPill $tone={countPillTone(column.confidence)}>
                    {column.confidence === 'exact' && 'Matched'}
                    {column.confidence === 'duplicate' && 'Duplicate'}
                    {column.confidence === 'fuzzy' && 'Check'}
                    {column.confidence === 'manual' && 'Manual'}
                    {column.confidence === 'ignored' && 'Ignored'}
                    {column.confidence === 'none' && 'Unmatched'}
                    {column.confidence === 'empty' && 'Blank'}
                  </StatusPill>
                </ColumnRow>
              );
            })}
          </Columns>

          {parsed.rows.length > 0 && (
            <Preview>
              Preview of the first {Math.min(3, parsed.rows.length)} row(s)
              <pre>
                {parsed.rows.slice(0, 3).map((row) => row.map((cell) => cell ?? '').join('  |  ')).join('\n')}
              </pre>
            </Preview>
          )}

          <ButtonRow>
            <GhostButton onClick={goBack}>
              <ArrowLeft size={16} /> Back
            </GhostButton>
            <PrimaryButton onClick={() => setStep('review')}>
              Review {parsed.rows.length} row(s) <ArrowRight size={16} />
            </PrimaryButton>
          </ButtonRow>
        </Card>
      )}

      {step === 'review' && entity && validation && (
        <Card>
          <Title>Check before you import</Title>
          <Subtitle>
            Nothing is saved yet. Rows with problems are left out unless you fix them in the columns step.
          </Subtitle>

          {ambiguousCount > 0 && dayFirst === null && (
            <Banner $tone="error">
              <AlertCircle size={18} />
              <span>
                {ambiguousCount} row(s) have a date that could be read either way. Pick a date format in the
                Columns step so they are not lost.
              </span>
            </Banner>
          )}

          {validation.summary.total === 0 && (
            <Banner $tone="warn">
              <Info size={18} />
              <span>This file has no data rows after the heading row.</span>
            </Banner>
          )}

          <StatGrid>
            <StatCard $tone="good">
              <div>{readyCount}</div>
              <span>READY TO IMPORT</span>
            </StatCard>
            <StatCard $tone="bad">
              <div>{blockedCount}</div>
              <span>PROBLEMS</span>
            </StatCard>
            {warnCount > 0 && (
              <StatCard $tone="warn">
                <div>{warnCount}</div>
                <span>WARNINGS</span>
              </StatCard>
            )}
            <StatCard>
              <div>{emptyCount}</div>
              <span>SKIPPED (EMPTY)</span>
            </StatCard>
          </StatGrid>

          {existing === null && (
            <Banner $tone="warn">
              <Info size={18} />
              <span>Checking your existing records for matches…</span>
            </Banner>
          )}

          {existing !== null && existingError && (
            <Banner $tone="warn">
              <AlertCircle size={18} />
              <span>{existingError} New rows will still be added as new.</span>
            </Banner>
          )}

          {existing !== null && (duplicates.exact.length > 0 || duplicates.near.length > 0) && (
            <DupCard>
              <DupHeader>
                <GitMerge size={18} />
                Found {duplicates.exact.length + duplicates.near.length} row(s) your records already hold
              </DupHeader>

              {duplicates.exact.length > 0 && (
                <ChoiceBlock>
                  <ChoiceTitle>
                    {duplicates.exact.length} exact match{duplicates.exact.length === 1 ? '' : 'es'}
                    <span> — the file and your book agree on the same {entity.matchedBy}.</span>
                  </ChoiceTitle>
                  <MatchExamples>
                    {duplicates.exact.slice(0, 3).map((entry, index) => (
                      <span key={index}>
                        <Copy size={12} /> <code>{recordLabel(entry.existing)}</code> already exists
                      </span>
                    ))}
                  </MatchExamples>
                  <RadioRow>
                    <RadioLabel>
                      <input type="radio" checked={collision === 'replace'} onChange={() => setCollision('replace')} />
                      Update the existing row with the file
                    </RadioLabel>
                    <RadioLabel>
                      <input type="radio" checked={collision === 'add'} onChange={() => setCollision('add')} />
                      Add as a new row anyway
                    </RadioLabel>
                  </RadioRow>
                </ChoiceBlock>
              )}

              {duplicates.near.length > 0 && (
                <ChoiceBlock>
                  <ChoiceTitle>
                    {duplicates.near.length} close match{duplicates.near.length === 1 ? '' : 'es'}
                    <span> — almost the same, but not identical.</span>
                  </ChoiceTitle>
                  <MatchExamples>
                    {duplicates.near.slice(0, 3).map((entry, index) => (
                      <span key={index}>
                        <GitMerge size={12} /> <code>{recordLabel(entry.existing)}</code> ↔ <code>{recordLabel(entry.record)}</code>
                      </span>
                    ))}
                  </MatchExamples>
                  <RadioRow>
                    <RadioLabel>
                      <input type="radio" checked={near === 'merge'} onChange={() => setNear('merge')} />
                      Merge into the existing row (fills gaps only)
                    </RadioLabel>
                    <RadioLabel>
                      <input type="radio" checked={near === 'add'} onChange={() => setNear('add')} />
                      Add as a new row
                    </RadioLabel>
                  </RadioRow>
                </ChoiceBlock>
              )}

              <SmallNote>Nothing is written until you press Import. Undo on the next screen restores any row this touched.</SmallNote>
            </DupCard>
          )}

          {validation.summary.total === 0 || blockedCount > 0 ? (
            issueRows.length > 0 && (
              <IssueList>
                {issueRows.slice(0, 12).map(({ row, first, tone }) => (
                  <IssueRow key={row.index} $tone={tone}>
                    {tone === 'bad' ? <AlertTriangle size={15} /> : <Info size={15} />}
                    <span className="row-no">Row {row.index + 2}</span>
                    <span>{first.message}</span>
                  </IssueRow>
                ))}
                {issueRows.length > 12 && (
                  <IssueRow $tone="warn">
                    <span>…and {issueRows.length - 12} more issue(s).</span>
                  </IssueRow>
                )}
              </IssueList>
            )
          ) : (
            <Banner>
              <CheckCircle2 size={18} />
              <span>Every row is ready to import.</span>
            </Banner>
          )}

          {message && (
            <Banner $tone="error">
              <AlertCircle size={18} />
              <span>{message}</span>
            </Banner>
          )}

          <ButtonRow>
            <GhostButton onClick={goBack}>
              <ArrowLeft size={16} /> Back
            </GhostButton>
            <GhostButton onClick={startOver}>
              <RotateCcw size={16} /> Start over
            </GhostButton>
            <PrimaryButton disabled={readyRecords.length === 0 || importing} onClick={runImport}>
              {importing ? 'Importing…' : `Import ${readyRecords.length} row${readyRecords.length === 1 ? '' : 's'}`}
              <ArrowRight size={16} />
            </PrimaryButton>
          </ButtonRow>
        </Card>
      )}

      {step === 'done' && entity && result && (
        <Card>
          <SuccessPanel>
            {result.partially ? <AlertTriangle size={44} /> : <CheckCircle2 size={44} />}
            <h2>{result.partially ? 'Some rows were saved' : 'Import complete'}</h2>
            <p>
              {result.inserted.length} new row{result.inserted.length === 1 ? '' : 's'} added
              {result.replaced.length > 0 &&
                `, ${result.replaced.length} existing row${result.replaced.length === 1 ? '' : 's'} updated from the file`}
              {result.merged.length > 0 &&
                `, ${result.merged.length} similar row${result.merged.length === 1 ? '' : 's'} merged into existing entries`}
              {'.'}
              {result.categoriesCreated > 0 &&
                ` ${result.categoriesCreated} new categor${result.categoriesCreated === 1 ? 'y' : 'ies'} were added to your lists.`}
            </p>
            {(result.inserted.length > 0 || result.replaced.length > 0 || result.merged.length > 0) && (
              <PrimaryButton style={{ marginRight: '0.75rem' }} disabled={undoing} onClick={handleUndo}>
                <RotateCcw size={16} />
                {undoing
                  ? 'Undoing…'
                  : `Undo (${[
                      result.inserted.length ? `${result.inserted.length} added` : '',
                      result.replaced.length || result.merged.length ? 'existing rows restored' : '',
                    ].filter(Boolean).join(', ')})`}
              </PrimaryButton>
            )}
            <PrimaryButton onClick={startOver}>
              Import something else <ArrowRight size={16} />
            </PrimaryButton>
            {result.error && (
              <SmallNote>
                A problem stopped the file part-way through, so there may be a few more rows further down that did
                not save. Undo above removes what did add and restores what it touched.
              </SmallNote>
            )}
          </SuccessPanel>
        </Card>
      )}
    </Shell>
  );
};

export default ImportData;