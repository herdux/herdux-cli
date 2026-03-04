import { PostgresEngine } from "./postgres/postgres.engine.js";
import { MysqlEngine } from "./mysql/mysql.engine.js";
import { SqliteEngine } from "./sqlite/sqlite.engine.js";
import { MongodbEngine } from "./mongodb/mongodb.engine.js";
import type {
  IDatabaseEngine,
  EngineType,
} from "../../core/interfaces/database-engine.interface.js";

export function createEngine(type?: EngineType): IDatabaseEngine {
  switch (type) {
    case "mysql":
      return new MysqlEngine();
    case "sqlite":
      return new SqliteEngine();
    case "mongodb":
      return new MongodbEngine();
    case "postgres":
    default:
      return new PostgresEngine();
  }
}
