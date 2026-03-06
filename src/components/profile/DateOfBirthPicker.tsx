import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MONTHS = [
  { value: '01', label: 'Jan' },
  { value: '02', label: 'Fev' },
  { value: '03', label: 'Mar' },
  { value: '04', label: 'Abr' },
  { value: '05', label: 'Mai' },
  { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' },
  { value: '08', label: 'Ago' },
  { value: '09', label: 'Set' },
  { value: '10', label: 'Out' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dez' },
];

function getDaysInMonth(month: number, year: number): number {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

function isValidDate(day: number, month: number, year: number): boolean {
  if (!day || !month || !year) return false;
  const maxDays = getDaysInMonth(month, year);
  return day <= maxDays;
}

interface DateOfBirthPickerProps {
  /** Value in YYYY-MM-DD format */
  value: string;
  /** Called with YYYY-MM-DD format */
  onChange: (value: string) => void;
}

export function DateOfBirthPicker({ value, onChange }: DateOfBirthPickerProps) {
  const currentYear = new Date().getFullYear();

  // Parse existing value (YYYY-MM-DD)
  let day = '';
  let month = '';
  let year = '';
  if (value) {
    const parts = value.split('-');
    if (parts.length === 3) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    }
  }

  const dayNum = parseInt(day) || 0;
  const monthNum = parseInt(month) || 0;
  const yearNum = parseInt(year) || 0;

  // Always show 31 days — validation happens in emitChange when all 3 fields are set
  const maxDays = 31;

  const emitChange = (d: string, m: string, y: string) => {
    const dN = parseInt(d) || 0;
    const mN = parseInt(m) || 0;
    const yN = parseInt(y) || 0;

    if (dN && mN && yN) {
      // Auto-correct day if exceeds max for month/year
      const maxD = getDaysInMonth(mN, yN);
      const correctedDay = Math.min(dN, maxD);
      onChange(`${y}-${m}-${String(correctedDay).padStart(2, '0')}`);
    } else if (d || m || y) {
      // Partial — store what we have
      const parts = [
        y || '0000',
        m || '00',
        d || '00',
      ];
      onChange(parts.join('-'));
    } else {
      onChange('');
    }
  };

  // Generate years from current year down to 1900
  const years: number[] = [];
  for (let y = currentYear; y >= 1900; y--) {
    years.push(y);
  }

  const days: number[] = [];
  for (let d = 1; d <= maxDays; d++) {
    days.push(d);
  }

  return (
    <div className="flex gap-2">
      <Select value={day} onValueChange={(v) => emitChange(v, month, year)}>
        <SelectTrigger className="flex-1 h-11 rounded-xl">
          <SelectValue placeholder="Dia" />
        </SelectTrigger>
        <SelectContent>
          {days.map((d) => (
            <SelectItem key={d} value={String(d).padStart(2, '0')}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={month} onValueChange={(v) => emitChange(day, v, year)}>
        <SelectTrigger className="flex-1 h-11 rounded-xl">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={year} onValueChange={(v) => emitChange(day, month, v)}>
        <SelectTrigger className="flex-[1.2] h-11 rounded-xl">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
