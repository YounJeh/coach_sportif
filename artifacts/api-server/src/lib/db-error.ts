type DbFailureKind =
  | "db-connection"
  | "db-auth"
  | "db-schema"
  | "db-constraint"
  | "db-data"
  | "db-query"
  | "unknown";

interface QueryDetails {
  sql?: string;
  params?: string;
}

interface DriverDetails {
  code?: string;
  severity?: string;
  detail?: string;
  hint?: string;
  schema?: string;
  table?: string;
  column?: string;
  constraint?: string;
  where?: string;
  position?: string;
  routine?: string;
}

export interface NormalizedDbError {
  kind: DbFailureKind;
  code?: string;
  message: string;
  query?: QueryDetails;
  driver?: DriverDetails;
}

const CONNECTION_CODES = new Set([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  "53300",
  "57P01",
  "57P02",
  "57P03",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "ETIMEDOUT",
  "ENOTFOUND",
]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function getString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseDrizzleQuery(message: string): QueryDetails | undefined {
  const match = message.match(/^Failed query:\s*([\s\S]*?)\nparams:\s*([\s\S]*)$/m);
  if (!match) {
    return undefined;
  }

  return {
    sql: match[1]?.trim(),
    params: match[2]?.trim(),
  };
}

function classify(code: string | undefined, message: string, query: QueryDetails | undefined): DbFailureKind {
  if (code && CONNECTION_CODES.has(code)) {
    return "db-connection";
  }

  if (code?.startsWith("08")) {
    return "db-connection";
  }

  if (code?.startsWith("28")) {
    return "db-auth";
  }

  if (code?.startsWith("42")) {
    return "db-schema";
  }

  if (code?.startsWith("23")) {
    return "db-constraint";
  }

  if (code?.startsWith("22")) {
    return "db-data";
  }

  if (query?.sql || message.startsWith("Failed query:")) {
    return "db-query";
  }

  return "unknown";
}

function clientMessage(kind: DbFailureKind): string {
  if (kind === "db-connection") {
    return "Database connection failed";
  }

  if (kind === "db-auth") {
    return "Database authentication failed";
  }

  return "Database request failed";
}

export function normalizeDbError(error: unknown): NormalizedDbError | undefined {
  const root = asRecord(error);
  const cause = asRecord(root?.cause);
  const topMessage = error instanceof Error ? error.message : undefined;
  const causeMessage = getString(cause, "message");
  const message = topMessage ?? causeMessage;

  if (!message) {
    return undefined;
  }

  const query = parseDrizzleQuery(message);
  const code = getString(cause, "code") ?? getString(root, "code");
  const kind = classify(code, message, query);

  const driver: DriverDetails | undefined = cause
    ? {
        code,
        severity: getString(cause, "severity"),
        detail: getString(cause, "detail"),
        hint: getString(cause, "hint"),
        schema: getString(cause, "schema"),
        table: getString(cause, "table"),
        column: getString(cause, "column"),
        constraint: getString(cause, "constraint"),
        where: getString(cause, "where"),
        position: getString(cause, "position"),
        routine: getString(cause, "routine"),
      }
    : undefined;

  return {
    kind,
    code,
    message,
    query,
    driver,
  };
}

export function dbErrorHttpStatus(kind: DbFailureKind): number {
  if (kind === "db-connection") {
    return 503;
  }
  return 500;
}

export function dbErrorClientMessage(kind: DbFailureKind): string {
  return clientMessage(kind);
}