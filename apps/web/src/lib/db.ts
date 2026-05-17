import { getDb } from '@accessiblewebsite/db';
import { env } from '../env';

// Force the db singleton to read from our validated env, not raw process.env.
let _initialised = false;
export function db() {
  if (!_initialised) {
    _initialised = true;
    return getDb(env().DATABASE_URL);
  }
  return getDb();
}
