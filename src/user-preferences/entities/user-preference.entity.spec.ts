import { getMetadataArgsStorage } from 'typeorm';
import { UserPreference } from './user-preference.entity';

describe('UserPreference entity - schema drift (#1206)', () => {
  const columns = getMetadataArgsStorage().filterColumns(UserPreference);
  const columnByProperty = (property: string) =>
    columns.find((column) => column.propertyName === property);

  it('declares a currency column matching the AddTimezoneLocalePreferences migration', () => {
    const currencyColumn = columnByProperty('currency');

    expect(currencyColumn).toBeDefined();
    expect(currencyColumn?.options.type).toBe('varchar');
    expect(currencyColumn?.options.default).toBe('USD');
    expect(currencyColumn?.options.nullable).toBe(true);
  });

  it('still declares the locale and timezone columns added by the same migration', () => {
    expect(columnByProperty('locale')).toBeDefined();
    expect(columnByProperty('timezone')).toBeDefined();
  });

  it('reads a currency value assigned on the entity instance', () => {
    const preference = new UserPreference();
    preference.currency = 'NGN';

    expect(preference.currency).toBe('NGN');
  });
});
