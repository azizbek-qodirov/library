import { Icon } from './Icon';
import { setLanguage, useI18n } from './i18n';
import type { Language } from './i18n';
import './language-select.css';

export function LanguageSelect() {
  const { locale, t } = useI18n();
  return (
    <label className="library-language" title={t('Interface language')}>
      <Icon name="globe" size={18} />
      <span aria-hidden="true">{locale.toUpperCase()}</span>
      <select aria-label={t('Interface language')} value={locale}
        onChange={event => setLanguage(event.currentTarget.value as Language)}>
        <option value="uz" lang="uz">O‘zbekcha</option>
        <option value="en" lang="en">English</option>
        <option value="ru" lang="ru">Русский</option>
      </select>
    </label>
  );
}
