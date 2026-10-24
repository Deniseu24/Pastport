import { useEffect, useState } from 'react';
import { getSelectableYears, getVirtualDate, offsetToYear, yearToOffset } from '@/core/clock';
import { enabledSetting, offsetSetting } from '@/core/settings';

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });

export default function App() {
  const [enabled, setEnabled] = useState(false);
  const [offset, setOffset] = useState<number | null>(null);

  useEffect(() => {
    enabledSetting.getValue().then(setEnabled);
    offsetSetting.getValue().then(setOffset);
  }, []);

  if (offset === null) return null;

  const toggle = async () => {
    await enabledSetting.setValue(!enabled);
    setEnabled(!enabled);
  };

  const changeYear = async (year: number) => {
    const next = yearToOffset(year);
    await offsetSetting.setValue(next);
    setOffset(next);
  };

  return (
    <main>
      <header>
        <h1>Pastport</h1>
        <p className="tagline">Experience the Past</p>
      </header>

      <label className="field">
        <span>Travel to</span>
        <select value={offsetToYear(offset)} onChange={(e) => changeYear(Number(e.target.value))}>
          {getSelectableYears().map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>

      <p className="date">
        {enabled ? 'It is now' : 'You would arrive on'}
        <strong>{dateFormat.format(getVirtualDate(offset))}</strong>
      </p>

      <button className={enabled ? 'active' : ''} onClick={toggle}>
        {enabled ? 'Back to the present' : 'Start traveling'}
      </button>
    </main>
  );
}
