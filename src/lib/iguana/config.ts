import type { ConnectorConfig } from './types';

/** Calendar arithmetic keeps midnight correct across month/year and DST changes. */
export function yesterdayMidnight(now = new Date()): string {
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${start.getFullYear()}/${two(start.getMonth() + 1)}/${two(start.getDate())} 00:00:00`;
}

export function initialConnectorConfig(now = new Date()): ConnectorConfig {
  return {
    serverUrl: 'http://iguanabalt01v:6543', username: 'admin', password: 'password',
    authMode: 'parameters', channel: 'MessageBroker', after: yesterdayMidnight(now),
    before: '', filter: '', limit: 1000,
  };
}
