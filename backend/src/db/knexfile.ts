import type { Knex } from 'knex';
import path from 'path';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../..', 'database', 'database.sqlite');

const config: Knex.Config = {
  client: 'sqlite3',
  connection: {
    filename: dbPath,
  },
  useNullAsDefault: true,
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    extension: 'ts',
  },
  seeds: {
    directory: path.join(__dirname, 'seeds'),
    extension: 'ts',
  },
};

export default config;
module.exports = config;
