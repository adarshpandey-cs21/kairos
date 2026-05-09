// Logs to stderr only — stdout is reserved for MCP stdio transport.
const ts = () => new Date().toISOString();
const fmt = (level: string, msg: string, meta?: object) =>
  `${ts()} ${level} ${msg}${meta ? ` ${JSON.stringify(meta)}` : ""}\n`;

export const logger = {
  info: (msg: string, meta?: object) => process.stderr.write(fmt("INFO ", msg, meta)),
  warn: (msg: string, meta?: object) => process.stderr.write(fmt("WARN ", msg, meta)),
  error: (msg: string, meta?: object) => process.stderr.write(fmt("ERROR", msg, meta)),
};
