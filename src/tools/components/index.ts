export { JsonFormatter } from './JsonFormatter';
export { JwtDecoder } from './JwtDecoder';
export { Base64Tool } from './Base64Tool';
export { UrlEncodeTool } from './UrlEncodeTool';
export { HashGenerator } from './HashGenerator';
export { UuidGenerator } from './UuidGenerator';
export { RegexTester } from './RegexTester';
export { CronHelper } from './CronHelper';
export { HtmlEntityTool } from './HtmlEntityTool';
export { TextCaseConverter } from './TextCaseConverter';
export { DiffChecker } from './DiffChecker';
export { MarkdownPreview } from './MarkdownPreview';
export { SqlFormatter } from './SqlFormatter';
export { CssMinifier } from './CssMinifier';
export { JsonToTypescript } from './JsonToTypescript';

export const toolComponentMap: Record<string, React.ComponentType> = {
  'json-formatter': require('./JsonFormatter').JsonFormatter,
  'jwt-decoder': require('./JwtDecoder').JwtDecoder,
  'base64-encode-decode': require('./Base64Tool').Base64Tool,
  'url-encode-decode': require('./UrlEncodeTool').UrlEncodeTool,
  'hash-generator': require('./HashGenerator').HashGenerator,
  'uuid-generator': require('./UuidGenerator').UuidGenerator,
  'regex-tester': require('./RegexTester').RegexTester,
  'cron-helper': require('./CronHelper').CronHelper,
  'html-entity-encode-decode': require('./HtmlEntityTool').HtmlEntityTool,
  'text-case-converter': require('./TextCaseConverter').TextCaseConverter,
  'diff-checker': require('./DiffChecker').DiffChecker,
  'markdown-preview': require('./MarkdownPreview').MarkdownPreview,
  'sql-formatter': require('./SqlFormatter').SqlFormatter,
  'css-minifier': require('./CssMinifier').CssMinifier,
  'json-to-typescript': require('./JsonToTypescript').JsonToTypescript,
};
