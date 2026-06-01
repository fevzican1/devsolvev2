/**
 * Error-code & library knowledge base ("Hub-Page" pool).
 * ------------------------------------------------------
 * Instead of producing thin variations of an empty tool, every page in this
 * pool is a genuinely unique, language-specific solution to a real error from
 * a real library at a real version. Each entry ships with:
 *
 *   - a language-specific REPRODUCTION snippet (the "input" the bot sees),
 *   - the exact error MESSAGE the runtime emits,
 *   - the root CAUSE,
 *   - a language-specific FIX snippet (the "output"),
 *   - an EXPLANATION and PREVENTION guidance.
 *
 * Because each (language, library, version, error) tuple maps to a real,
 * distinct failure mode, no two pages share the same input/output — this is
 * what makes the content genuinely unique rather than a boilerplate tool
 * wrapper. The slug shape is:
 *
 *     /fix/{language}-{library}-{version}-{errorSlug}
 *
 * e.g. /fix/python-requests-2-31-0-jsondecodeerror
 */

export type LanguageId =
  | 'python'
  | 'javascript'
  | 'java'
  | 'go'
  | 'php'
  | 'ruby';

export interface LanguageMeta {
  id: LanguageId;
  label: string;
  /** Display name of the package manager / ecosystem. */
  ecosystem: string;
  /** Highlight hint used by <pre> blocks. */
  codeLang: string;
}

export const languages: Record<LanguageId, LanguageMeta> = {
  python: { id: 'python', label: 'Python', ecosystem: 'PyPI / pip', codeLang: 'python' },
  javascript: { id: 'javascript', label: 'JavaScript (Node.js)', ecosystem: 'npm', codeLang: 'javascript' },
  java: { id: 'java', label: 'Java', ecosystem: 'Maven Central', codeLang: 'java' },
  go: { id: 'go', label: 'Go', ecosystem: 'Go Modules', codeLang: 'go' },
  php: { id: 'php', label: 'PHP', ecosystem: 'Composer / Packagist', codeLang: 'php' },
  ruby: { id: 'ruby', label: 'Ruby', ecosystem: 'RubyGems', codeLang: 'ruby' },
};

export interface ErrorEntry {
  /** kebab-case identifier, unique within the library. */
  errorSlug: string;
  /** Human-readable error name (as it appears in tracebacks/logs). */
  errorName: string;
  /** The exact message string the runtime emits. */
  message: string;
  /** One-line summary of what went wrong. */
  summary: string;
  /** Root cause, 1-2 sentences. */
  cause: string;
  /** Language-specific snippet that REPRODUCES the error. */
  reproduce: string;
  /** Language-specific snippet that FIXES the error. */
  fix: string;
  /** Deeper explanation of why the fix works. */
  explanation: string;
  /** How to stop the error recurring. */
  prevention: string;
  /** Related DevSolve tool slug that helps diagnose this class of error. */
  relatedTool: string;
}

export interface LibraryEntry {
  /** kebab-case package name. */
  pkg: string;
  /** Display name. */
  name: string;
  language: LanguageId;
  /** Concrete version this guide targets, e.g. "2.31.0". */
  version: string;
  /** One-line description of what the library does. */
  description: string;
  errors: ErrorEntry[];
}

/* ------------------------------------------------------------------ */
/*  Curated catalog — real libraries, real versions, real errors       */
/* ------------------------------------------------------------------ */
export const libraryCatalog: LibraryEntry[] = [
  {
    pkg: 'requests',
    name: 'requests',
    language: 'python',
    version: '2.31.0',
    description: 'The most widely used HTTP client for Python.',
    errors: [
      {
        errorSlug: 'jsondecodeerror',
        errorName: 'requests.exceptions.JSONDecodeError',
        message: 'Expecting value: line 1 column 1 (char 0)',
        summary: 'Calling response.json() on a response that is empty or not JSON.',
        cause:
          'The server returned an empty body, an HTML error page, or a non-JSON content type, but the code called response.json() unconditionally.',
        reproduce: `import requests

resp = requests.get("https://httpbin.org/status/204")
# 204 No Content -> body is empty
data = resp.json()  # raises requests.exceptions.JSONDecodeError
print(data)`,
        fix: `import requests

resp = requests.get("https://httpbin.org/status/204")

if resp.status_code != 204 and resp.headers.get("content-type", "").startswith("application/json"):
    try:
        data = resp.json()
    except requests.exceptions.JSONDecodeError:
        data = None
else:
    data = None

print(data)  # None instead of crashing`,
        explanation:
          'response.json() runs json.loads() on the raw body. An empty string is not valid JSON, so the parser fails on the first character. Guarding on the status code and Content-Type header, then catching JSONDecodeError, keeps the call safe even when an upstream service misbehaves.',
        prevention:
          'Always check Content-Type and handle the empty-body case before parsing. Paste a sample response into the JSON Formatter to confirm it is valid JSON before wiring it into code.',
        relatedTool: 'json-formatter',
      },
      {
        errorSlug: 'sslerror-certificate-verify-failed',
        errorName: 'requests.exceptions.SSLError',
        message: 'HTTPSConnectionPool(...): Max retries exceeded ... CERTIFICATE_VERIFY_FAILED',
        summary: 'TLS certificate validation failed when connecting over HTTPS.',
        cause:
          'The host presents a certificate that is self-signed, expired, or signed by a CA that is not in the local trust store (common behind corporate proxies).',
        reproduce: `import requests

# Fails when the corporate proxy injects its own root CA
resp = requests.get("https://internal.example.com/api")
print(resp.status_code)`,
        fix: `import requests
import certifi

# Point requests at the corporate CA bundle instead of disabling verification
resp = requests.get(
    "https://internal.example.com/api",
    verify="/etc/ssl/certs/corp-root-ca.pem",  # or certifi.where()
)
print(resp.status_code)`,
        explanation:
          'requests validates the server certificate chain against a CA bundle. When the chain terminates in a CA the bundle does not contain, validation fails. Supplying the correct CA bundle via verify= restores security without the dangerous verify=False shortcut.',
        prevention:
          'Never ship verify=False to production. Export the corporate root CA once and reference it through the REQUESTS_CA_BUNDLE environment variable so every service inherits it.',
        relatedTool: 'hash-generator',
      },
      {
        errorSlug: 'missingschema-invalid-url',
        errorName: 'requests.exceptions.MissingSchema',
        message: "Invalid URL 'example.com/api': No scheme supplied. Perhaps you meant https://example.com/api?",
        summary: 'A URL was passed without the http:// or https:// scheme.',
        cause:
          'A configuration value or string concatenation produced a URL missing its scheme, often because a base URL was stored without the protocol.',
        reproduce: `import requests

base = "api.example.com"  # scheme accidentally dropped
resp = requests.get(f"{base}/users")  # raises MissingSchema`,
        fix: `import requests
from urllib.parse import urlparse

base = "api.example.com"
if not urlparse(base).scheme:
    base = f"https://{base}"

resp = requests.get(f"{base}/users")
print(resp.status_code)`,
        explanation:
          'requests refuses to guess the transport. urlparse(...).scheme is empty when no protocol is present, so normalising the base URL once before building requests guarantees every call is well-formed.',
        prevention:
          'Validate configured base URLs at startup. Run candidate URLs through the URL Encode/Decode tool to confirm the scheme and path survive encoding.',
        relatedTool: 'url-encode-decode',
      },
    ],
  },
  {
    pkg: 'pandas',
    name: 'pandas',
    language: 'python',
    version: '2.2.0',
    description: 'The de-facto data-analysis library for Python.',
    errors: [
      {
        errorSlug: 'settingwithcopywarning',
        errorName: 'SettingWithCopyWarning',
        message: 'A value is trying to be set on a copy of a slice from a DataFrame',
        summary: 'Assigning to a chained selection that may be a copy, not a view.',
        cause:
          'Chained indexing (df[mask][col] = ...) operates on an intermediate object whose copy/view status is undefined, so the write may silently target a temporary.',
        reproduce: `import pandas as pd

df = pd.DataFrame({"price": [10, 20, 30], "tier": ["a", "b", "a"]})
# Chained assignment -> SettingWithCopyWarning, change may be lost
df[df["tier"] == "a"]["price"] = 99
print(df)`,
        fix: `import pandas as pd

df = pd.DataFrame({"price": [10, 20, 30], "tier": ["a", "b", "a"]})
# Single .loc call selects rows and column in one operation
df.loc[df["tier"] == "a", "price"] = 99
print(df)`,
        explanation:
          'df[mask] returns a new object; assigning into a further [] on top of it is ambiguous. .loc[rows, cols] addresses the original frame directly, so the assignment is guaranteed to land where you intend.',
        prevention:
          'Adopt .loc/.iloc for every conditional assignment and enable pd.options.mode.copy_on_write = True in pandas 2.x to make the semantics explicit.',
        relatedTool: 'diff-checker',
      },
      {
        errorSlug: 'keyerror-column',
        errorName: 'KeyError',
        message: "KeyError: 'amount'",
        summary: 'Referencing a column that does not exist in the DataFrame.',
        cause:
          'The column name has different casing, trailing whitespace, or was renamed during ingestion, so the lookup misses.',
        reproduce: `import pandas as pd

df = pd.read_csv("orders.csv")  # header is " Amount" with a leading space
total = df["amount"].sum()  # raises KeyError: 'amount'`,
        fix: `import pandas as pd

df = pd.read_csv("orders.csv")
df.columns = df.columns.str.strip().str.lower()  # normalise headers

total = df["amount"].sum()
print(total)`,
        explanation:
          'CSV headers frequently carry invisible whitespace or inconsistent casing. Normalising df.columns once after load makes every downstream lookup deterministic regardless of the source file.',
        prevention:
          'Standardise column names immediately after every read_* call. Use the Text Case Converter to decide on a single canonical casing convention for your schema.',
        relatedTool: 'text-case-converter',
      },
    ],
  },
  {
    pkg: 'axios',
    name: 'axios',
    language: 'javascript',
    version: '1.6.0',
    description: 'Promise-based HTTP client for the browser and Node.js.',
    errors: [
      {
        errorSlug: 'err-bad-request-400',
        errorName: 'AxiosError [ERR_BAD_REQUEST]',
        message: 'Request failed with status code 400',
        summary: 'The server rejected the request body or query parameters.',
        cause:
          'The payload was sent with the wrong Content-Type, or a required field was missing/mis-encoded, so the API returned 400.',
        reproduce: `import axios from "axios";

// Sends a string but labels it JSON incorrectly
await axios.post("https://api.example.com/users", "name=jane", {
  headers: { "Content-Type": "application/json" },
}); // AxiosError: Request failed with status code 400`,
        fix: `import axios from "axios";

try {
  await axios.post(
    "https://api.example.com/users",
    { name: "jane" }, // object -> axios serialises to JSON
    { headers: { "Content-Type": "application/json" } },
  );
} catch (err) {
  if (axios.isAxiosError(err)) {
    console.error("Validation errors:", err.response?.data);
  }
  throw err;
}`,
        explanation:
          'When you pass a plain object as the body, axios JSON-encodes it and the declared Content-Type matches the actual payload. Inspecting err.response.data surfaces the field-level validation messages the API returns alongside the 400.',
        prevention:
          'Let axios serialise objects rather than hand-building bodies, and always read err.response.data on failure. Validate the JSON shape in the JSON Formatter before sending.',
        relatedTool: 'json-formatter',
      },
      {
        errorSlug: 'econnaborted-timeout',
        errorName: 'AxiosError [ECONNABORTED]',
        message: 'timeout of 0ms exceeded',
        summary: 'The request hung and was aborted because no timeout was configured.',
        cause:
          'axios has no default timeout, so a slow or unresponsive upstream leaves the request open until the socket dies, surfacing as ECONNABORTED.',
        reproduce: `import axios from "axios";

// No timeout: a hung upstream blocks indefinitely, then aborts
await axios.get("https://api.example.com/slow-report");`,
        fix: `import axios from "axios";

const client = axios.create({ timeout: 5000 }); // 5s ceiling

try {
  await client.get("https://api.example.com/slow-report");
} catch (err) {
  if (axios.isAxiosError(err) && err.code === "ECONNABORTED") {
    console.error("Upstream too slow, retry with backoff");
  }
  throw err;
}`,
        explanation:
          'A bounded timeout converts an indefinite hang into a fast, catchable failure so retries and circuit breakers can engage. Creating a configured instance applies the ceiling to every call consistently.',
        prevention:
          'Centralise a configured axios instance with sensible timeouts and retry/backoff logic instead of calling the bare axios default.',
        relatedTool: 'cron-helper',
      },
    ],
  },
  {
    pkg: 'jackson-databind',
    name: 'Jackson Databind',
    language: 'java',
    version: '2.16.0',
    description: 'JSON serialization/deserialization for the Java ecosystem.',
    errors: [
      {
        errorSlug: 'unrecognizedpropertyexception',
        errorName: 'com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException',
        message: 'Unrecognized field "createdAt" (class com.example.User), not marked as ignorable',
        summary: 'The JSON contains a field the target Java class does not declare.',
        cause:
          'By default Jackson fails on unknown properties, so any field the API adds that the POJO has not modelled aborts deserialization.',
        reproduce: `ObjectMapper mapper = new ObjectMapper();
String json = "{\\"id\\":1,\\"name\\":\\"Jane\\",\\"createdAt\\":\\"2024-01-01\\"}";

// User has no createdAt field -> UnrecognizedPropertyException
User user = mapper.readValue(json, User.class);`,
        fix: `ObjectMapper mapper = new ObjectMapper()
    .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

String json = "{\\"id\\":1,\\"name\\":\\"Jane\\",\\"createdAt\\":\\"2024-01-01\\"}";
User user = mapper.readValue(json, User.class); // extra fields ignored`,
        explanation:
          'Disabling FAIL_ON_UNKNOWN_PROPERTIES tells Jackson to skip fields with no matching setter rather than throwing. This decouples your POJO from additive, backward-compatible API changes. For per-class control, annotate the type with @JsonIgnoreProperties(ignoreUnknown = true).',
        prevention:
          'Treat APIs as forward-compatible: configure the mapper once at startup. Paste new payloads into the JSON to TypeScript / JSON Formatter to spot fields your model has not adopted yet.',
        relatedTool: 'json-to-typescript',
      },
      {
        errorSlug: 'mismatchedinputexception-no-content',
        errorName: 'com.fasterxml.jackson.databind.exc.MismatchedInputException',
        message: 'No content to map due to end-of-input',
        summary: 'readValue() received an empty or fully-consumed input stream.',
        cause:
          'The HTTP body was empty (204/empty 200) or the InputStream had already been read once, leaving nothing for Jackson to parse.',
        reproduce: `ObjectMapper mapper = new ObjectMapper();
InputStream body = response.getEntity().getContent();
String first = new String(body.readAllBytes());  // stream consumed here
User user = mapper.readValue(body, User.class);   // No content to map`,
        fix: `ObjectMapper mapper = new ObjectMapper();
byte[] bytes = response.getEntity().getContent().readAllBytes();

if (bytes.length == 0) {
    return Optional.empty();
}
User user = mapper.readValue(bytes, User.class);`,
        explanation:
          'An InputStream can only be read once. Buffering the body into a byte[] lets you check for emptiness and parse from a re-readable source, eliminating both the double-read and the empty-body failure modes.',
        prevention:
          'Buffer response bodies before parsing and explicitly handle the empty case. Confirm the upstream actually returns a body for the status codes you expect.',
        relatedTool: 'json-formatter',
      },
    ],
  },
  {
    pkg: 'encoding-json',
    name: 'encoding/json',
    language: 'go',
    version: 'go1.22',
    description: "Go's standard-library JSON encoder/decoder.",
    errors: [
      {
        errorSlug: 'unmarshal-cannot-unmarshal-string-into-int',
        errorName: 'json.UnmarshalTypeError',
        message: 'json: cannot unmarshal string into Go struct field Order.total of type int',
        summary: 'A JSON string value was decoded into a numeric Go field.',
        cause:
          'The API returns the number as a quoted string ("total":"42") but the struct field is typed as int, so the decoder cannot coerce it.',
        reproduce: `type Order struct {
    Total int \`json:"total"\`
}

data := []byte(\`{"total":"42"}\`) // total arrives as a string
var o Order
err := json.Unmarshal(data, &o) // UnmarshalTypeError`,
        fix: `import "encoding/json"

type Order struct {
    // json.Number accepts both 42 and "42"
    Total json.Number \`json:"total"\`
}

var o Order
if err := json.Unmarshal([]byte(\`{"total":"42"}\`), &o); err != nil {
    return err
}
total, _ := o.Total.Int64()`,
        explanation:
          'json.Number stores the raw token and lets you convert it explicitly with Int64()/Float64(), which tolerates upstream services that quote their numbers. Alternatively, use ,string in the struct tag for fields that are always stringified.',
        prevention:
          'Model fields after the wire format, not the ideal type. Inspect real payloads in the JSON Formatter to see whether numbers arrive quoted.',
        relatedTool: 'json-formatter',
      },
    ],
  },
  {
    pkg: 'express',
    name: 'Express',
    language: 'javascript',
    version: '4.18.2',
    description: 'Minimal and flexible Node.js web framework.',
    errors: [
      {
        errorSlug: 'cannot-set-headers-after-sent',
        errorName: 'Error [ERR_HTTP_HEADERS_SENT]',
        message: "Cannot set headers after they are sent to the client",
        summary: 'The response was written twice in the same request handler.',
        cause:
          'A handler calls res.send()/res.json() and then continues executing (no return), reaching a second write — often inside a callback or after an awaited branch.',
        reproduce: `app.get("/user/:id", async (req, res) => {
  const user = await db.find(req.params.id);
  if (!user) res.status(404).send("Not found"); // missing return
  res.json(user); // runs even when user is null -> headers already sent
});`,
        fix: `app.get("/user/:id", async (req, res) => {
  const user = await db.find(req.params.id);
  if (!user) {
    return res.status(404).send("Not found"); // return ends the handler
  }
  res.json(user);
});`,
        explanation:
          'Express writes the HTTP head on the first send. Without an explicit return, control falls through to the second write and Node rejects the duplicate. Returning the first response guarantees exactly one write per request path.',
        prevention:
          'Always return res.* calls in branching handlers, and lint with no-fallthrough rules. Centralise error/404 handling in dedicated middleware.',
        relatedTool: 'diff-checker',
      },
    ],
  },
  {
    pkg: 'guzzlehttp',
    name: 'Guzzle',
    language: 'php',
    version: '7.8.0',
    description: 'PHP HTTP client used across the Composer ecosystem.',
    errors: [
      {
        errorSlug: 'clientexception-404',
        errorName: 'GuzzleHttp\\Exception\\ClientException',
        message: 'Client error: `GET https://api.example.com/v1/users/0` resulted in a `404 Not Found`',
        summary: 'Guzzle throws on 4xx responses unless http_errors is handled.',
        cause:
          'By default Guzzle treats 4xx/5xx as exceptions, so an expected 404 (missing resource) crashes the flow instead of returning a value.',
        reproduce: `$client = new GuzzleHttp\\Client();
// Throws ClientException on 404 instead of letting you branch
$response = $client->get("https://api.example.com/v1/users/0");`,
        fix: `use GuzzleHttp\\Exception\\ClientException;

$client = new GuzzleHttp\\Client();
try {
    $response = $client->get("https://api.example.com/v1/users/0");
    $user = json_decode((string) $response->getBody(), true);
} catch (ClientException $e) {
    if ($e->getResponse()->getStatusCode() === 404) {
        $user = null; // expected: resource simply does not exist
    } else {
        throw $e;
    }
}`,
        explanation:
          'Catching ClientException and inspecting the status code lets you distinguish an expected "not found" from a genuine failure. For bulk read paths you can also pass ["http_errors" => false] and branch on getStatusCode() directly.',
        prevention:
          'Decide per endpoint whether a 4xx is exceptional or expected, and handle the expected ones explicitly rather than letting them bubble up as 500s.',
        relatedTool: 'json-formatter',
      },
    ],
  },
  {
    pkg: 'nokogiri',
    name: 'Nokogiri',
    language: 'ruby',
    version: '1.16.0',
    description: 'HTML/XML parser for Ruby.',
    errors: [
      {
        errorSlug: 'syntaxerror-invalid-xml',
        errorName: 'Nokogiri::XML::SyntaxError',
        message: 'Premature end of data in tag item line 1',
        summary: 'Parsing truncated or malformed XML in strict mode.',
        cause:
          'The XML payload was cut off mid-stream or contains unclosed tags, and Nokogiri.XML uses strict parsing by default which aborts on the first structural error.',
        reproduce: `require "nokogiri"

xml = "<feed><item>partial"  # truncated, unclosed tags
doc = Nokogiri.XML(xml) { |c| c.strict }  # raises SyntaxError`,
        fix: `require "nokogiri"

xml = "<feed><item>partial"
doc = Nokogiri.XML(xml) { |config| config.recover } # tolerant parse

if doc.errors.any?
  warn "Recovered from #{doc.errors.size} XML error(s)"
end`,
        explanation:
          'The recover option switches libxml2 into tolerant mode: it builds the best-effort tree and records problems in doc.errors instead of throwing. You then decide whether the recovered document is usable rather than losing the whole payload to one bad byte.',
        prevention:
          'Validate that upstream feeds are complete before parsing, and log doc.errors so silent truncation is visible in monitoring.',
        relatedTool: 'diff-checker',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Slug helpers                                                       */
/* ------------------------------------------------------------------ */
function versionToSlug(version: string): string {
  return version.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function buildFixSlug(library: LibraryEntry, error: ErrorEntry): string {
  return [library.language, library.pkg, versionToSlug(library.version), error.errorSlug]
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

export interface ResolvedFix {
  slug: string;
  language: LanguageMeta;
  library: LibraryEntry;
  error: ErrorEntry;
}

let _index: Map<string, ResolvedFix> | null = null;

function getIndex(): Map<string, ResolvedFix> {
  if (_index) return _index;
  const map = new Map<string, ResolvedFix>();
  for (const library of libraryCatalog) {
    for (const error of library.errors) {
      const slug = buildFixSlug(library, error);
      map.set(slug, {
        slug,
        language: languages[library.language],
        library,
        error,
      });
    }
  }
  _index = map;
  return map;
}

export function getAllFixSlugs(): string[] {
  return Array.from(getIndex().keys());
}

export function getAllFixes(): ResolvedFix[] {
  return Array.from(getIndex().values());
}

export function resolveFixBySlug(slug: string): ResolvedFix | undefined {
  return getIndex().get(slug);
}

export function getFixCount(): number {
  return getIndex().size;
}

/** Deterministic related fixes: prefer same language, then same library. */
export function getRelatedFixes(slug: string, limit = 6): ResolvedFix[] {
  const current = resolveFixBySlug(slug);
  if (!current) return [];
  const all = getAllFixes().filter((f) => f.slug !== slug);

  const sameLibrary = all.filter((f) => f.library.pkg === current.library.pkg);
  const sameLanguage = all.filter(
    (f) => f.library.language === current.library.language && f.library.pkg !== current.library.pkg,
  );
  const others = all.filter((f) => f.library.language !== current.library.language);

  return [...sameLibrary, ...sameLanguage, ...others].slice(0, limit);
}
