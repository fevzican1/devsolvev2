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

/** Operational severity of the failure mode in a production context. */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Practitioner skill level required to apply the fix confidently. */
export type ErrorDifficulty = 'beginner' | 'intermediate' | 'advanced';

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
  /** Operational severity. Optional — a default is derived when omitted. */
  severity?: ErrorSeverity;
  /** Skill level required for the fix. */
  difficulty?: ErrorDifficulty;
  /** Rough hands-on time to apply the fix, e.g. "5 min". */
  timeEstimate?: string;
  /** Free-form topic tags used for the knowledge-base index. */
  tags?: string[];
  /** Human description of which versions are affected, e.g. "<= 2.31.0". */
  affectedVersions?: string;
  /** Ordered verification checklist to confirm the fix landed. */
  verifySteps?: string[];
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
  /** Functional category used for grouping in the knowledge base. */
  category?: string;
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
    category: 'HTTP client',
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
        severity: 'high',
        difficulty: 'beginner',
        timeEstimate: '5 min',
        tags: ['http', 'json', 'parsing', 'error-handling'],
        affectedVersions: 'All 2.x releases',
        verifySteps: [
          'Reproduce with a 204/empty response and confirm the JSONDecodeError disappears.',
          'Confirm the Content-Type guard returns None instead of raising for an HTML error page.',
          'Add a regression test that feeds an empty body through the same code path.',
        ],
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
        severity: 'high',
        difficulty: 'intermediate',
        timeEstimate: '15 min',
        tags: ['tls', 'security', 'certificates', 'networking'],
        affectedVersions: 'All 2.x releases',
        verifySteps: [
          'Confirm the request succeeds with the explicit CA bundle path.',
          'Verify that removing verify=False did not break any working endpoint.',
          'Check REQUESTS_CA_BUNDLE is set in the deployment environment, not only locally.',
        ],
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
        severity: 'medium',
        difficulty: 'beginner',
        timeEstimate: '5 min',
        tags: ['url', 'configuration', 'validation'],
        affectedVersions: 'All 2.x releases',
        verifySteps: [
          'Confirm a scheme-less base URL is normalised to https:// before the request.',
          'Validate that an already-qualified URL is left unchanged.',
          'Add a startup assertion that every configured base URL parses with a scheme.',
        ],
      },
    ],
  },
  {
    pkg: 'pandas',
    name: 'pandas',
    language: 'python',
    version: '2.2.0',
    description: 'The de-facto data-analysis library for Python.',
    category: 'Data analysis',
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
        severity: 'medium',
        difficulty: 'intermediate',
        timeEstimate: '10 min',
        tags: ['dataframe', 'indexing', 'gotcha'],
        affectedVersions: '1.x and 2.x (pre copy-on-write)',
        verifySteps: [
          'Confirm the warning is gone after switching to a single .loc assignment.',
          'Verify the underlying DataFrame actually changed (print before/after).',
          'Enable copy_on_write and re-run the test suite for any silent regressions.',
        ],
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
        severity: 'medium',
        difficulty: 'beginner',
        timeEstimate: '5 min',
        tags: ['dataframe', 'csv', 'schema'],
        affectedVersions: 'All releases',
        verifySteps: [
          'Print df.columns.tolist() and confirm the expected name appears after normalising.',
          'Confirm the KeyError no longer raises on the lookup.',
          'Add header normalisation immediately after every ingestion read.',
        ],
      },
    ],
  },
  {
    pkg: 'sqlalchemy',
    name: 'SQLAlchemy',
    language: 'python',
    version: '2.0.25',
    description: 'The Python SQL toolkit and Object-Relational Mapper.',
    category: 'ORM / database',
    errors: [
      {
        errorSlug: 'detachedinstanceerror',
        errorName: 'sqlalchemy.orm.exc.DetachedInstanceError',
        message: 'Instance <User at 0x...> is not bound to a Session; attribute refresh operation cannot proceed',
        summary: 'Accessing a lazy-loaded attribute after the Session that loaded it has closed.',
        cause:
          'By default attributes expire on commit, and a relationship is lazy-loaded on first access. Once the Session closes (end of a with block or request), there is no Session to issue the refresh SQL, so the access fails.',
        reproduce: `from sqlalchemy.orm import Session

with Session(engine) as session:
    user = session.get(User, 1)

# Session is closed here; .orders triggers a lazy load with no Session
print(user.orders)  # DetachedInstanceError`,
        fix: `from sqlalchemy.orm import Session, selectinload

with Session(engine) as session:
    user = session.execute(
        select(User).where(User.id == 1).options(selectinload(User.orders))
    ).scalar_one()
    # .orders is eagerly loaded inside the Session

print(user.orders)  # works after the Session closes`,
        explanation:
          'selectinload eagerly fetches the relationship inside the active Session, so the data is already resident on the object when the Session closes. Alternatively, set expire_on_commit=False, or keep all attribute access inside the with block.',
        prevention:
          'Decide your loading strategy explicitly: eager-load relationships you will read after the Session closes, or return plain DTOs from the data layer so detached ORM objects never escape it.',
        relatedTool: 'json-formatter',
        severity: 'high',
        difficulty: 'intermediate',
        timeEstimate: '20 min',
        tags: ['orm', 'session', 'lazy-loading', 'database'],
        affectedVersions: '1.4 and 2.0',
        verifySteps: [
          'Confirm the relationship reads cleanly after the Session context exits.',
          'Verify no extra lazy-load SQL fires outside the Session (enable echo=True).',
          'Add a test that accesses the relationship after commit to lock the behaviour in.',
        ],
      },
    ],
  },
  {
    pkg: 'flask',
    name: 'Flask',
    language: 'python',
    version: '3.0.0',
    description: 'A lightweight WSGI web application framework for Python.',
    category: 'Web framework',
    errors: [
      {
        errorSlug: 'working-outside-of-application-context',
        errorName: 'RuntimeError',
        message: 'Working outside of application context.',
        summary: 'Touching current_app, g, or an extension before an app context is pushed.',
        cause:
          'Flask binds current_app and g to a context that only exists during a request or an explicit app_context(). Using them at import time or in a background thread has no context to read from.',
        reproduce: `from flask import current_app
from app import create_app

app = create_app()

# No request and no app context here -> RuntimeError
db_uri = current_app.config["SQLALCHEMY_DATABASE_URI"]`,
        fix: `from app import create_app

app = create_app()

with app.app_context():
    # current_app and extensions are bound inside this block
    db_uri = app.config["SQLALCHEMY_DATABASE_URI"]
    print(db_uri)`,
        explanation:
          'app.app_context() pushes an application context so current_app and g resolve correctly. Scripts, CLI commands, and background jobs must wrap context-dependent code this way because they run outside the request lifecycle.',
        prevention:
          'Never access current_app at module import time. For scheduled jobs and CLI tasks, always enter app.app_context() (or use the Flask CLI which pushes one for you).',
        relatedTool: 'cron-helper',
        severity: 'medium',
        difficulty: 'beginner',
        timeEstimate: '10 min',
        tags: ['flask', 'context', 'configuration'],
        affectedVersions: '2.x and 3.x',
        verifySteps: [
          'Confirm config access works inside the app_context() block.',
          'Verify the same code fails outside the block (proving the diagnosis).',
          'Audit background tasks and CLI entrypoints for missing app contexts.',
        ],
      },
    ],
  },
  {
    pkg: 'pydantic',
    name: 'Pydantic',
    language: 'python',
    version: '2.6.0',
    description: 'Data validation using Python type hints.',
    category: 'Validation',
    errors: [
      {
        errorSlug: 'validationerror-int-parsing',
        errorName: 'pydantic.ValidationError',
        message: 'Input should be a valid integer, unable to parse string as an integer [type=int_parsing]',
        summary: 'A field typed as int received a non-numeric string from the input payload.',
        cause:
          'Pydantic v2 validates strictly by type. An incoming JSON value like "" or "N/A" for an int field cannot be coerced, so a ValidationError is raised listing the field location.',
        reproduce: `from pydantic import BaseModel

class Order(BaseModel):
    id: int
    quantity: int

# quantity arrives as an empty string from a form/CSV
Order(**{"id": 1, "quantity": ""})  # pydantic.ValidationError`,
        fix: `from pydantic import BaseModel, field_validator

class Order(BaseModel):
    id: int
    quantity: int = 0

    @field_validator("quantity", mode="before")
    @classmethod
    def empty_to_zero(cls, v):
        if v in ("", None, "N/A"):
            return 0
        return v

Order(**{"id": 1, "quantity": ""})  # quantity coerced to 0`,
        explanation:
          'A mode="before" validator runs prior to type coercion, so you can map sentinel values ("", "N/A") to a real default before Pydantic enforces the int type. This keeps the model strict while tolerating messy upstream data.',
        prevention:
          'Normalise sentinel values at the boundary where untrusted data enters. Inspect a raw sample in the JSON Formatter to see exactly which fields arrive as strings before modelling them.',
        relatedTool: 'json-formatter',
        severity: 'medium',
        difficulty: 'intermediate',
        timeEstimate: '15 min',
        tags: ['validation', 'pydantic', 'type-coercion'],
        affectedVersions: '2.x (stricter than 1.x)',
        verifySteps: [
          'Confirm the empty string now coerces to the intended default.',
          'Verify a genuinely invalid value still raises (so you are not masking real errors).',
          'Add the messy input as a fixture in the model test suite.',
        ],
      },
    ],
  },
  {
    pkg: 'axios',
    name: 'axios',
    language: 'javascript',
    version: '1.6.0',
    description: 'Promise-based HTTP client for the browser and Node.js.',
    category: 'HTTP client',
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
        severity: 'medium',
        difficulty: 'beginner',
        timeEstimate: '10 min',
        tags: ['http', 'json', 'api', 'error-handling'],
        affectedVersions: '0.x and 1.x',
        verifySteps: [
          'Confirm the request now sends application/json with a real JSON body.',
          'Log err.response.data and confirm it explains the original 400.',
          'Add a contract test asserting the request body matches the API schema.',
        ],
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
        severity: 'high',
        difficulty: 'intermediate',
        timeEstimate: '15 min',
        tags: ['http', 'timeout', 'resilience'],
        affectedVersions: 'All releases (no default timeout)',
        verifySteps: [
          'Confirm a slow endpoint now aborts at the configured ceiling.',
          'Verify the ECONNABORTED branch is reached and logged.',
          'Check the shared client instance is used everywhere, not the bare axios default.',
        ],
      },
    ],
  },
  {
    pkg: 'react',
    name: 'React',
    language: 'javascript',
    version: '18.2.0',
    description: 'The library for building user interfaces.',
    category: 'UI framework',
    errors: [
      {
        errorSlug: 'too-many-re-renders',
        errorName: 'Error',
        message: 'Too many re-renders. React limits the number of renders to prevent an infinite loop.',
        summary: 'State is updated during render, which triggers another render, forever.',
        cause:
          'An event handler was invoked instead of passed: onClick={setOpen(true)} calls setOpen during render. Each render schedules a state update, which re-renders, which calls it again.',
        reproduce: `function Panel() {
  const [open, setOpen] = useState(false);

  // setOpen runs on EVERY render -> infinite loop
  return <button onClick={setOpen(true)}>Open</button>;
}`,
        fix: `function Panel() {
  const [open, setOpen] = useState(false);

  // Pass a function reference; it only runs on click
  return <button onClick={() => setOpen(true)}>Open</button>;
}`,
        explanation:
          'JSX evaluates expressions during render. onClick={setOpen(true)} executes the setter immediately and assigns its return value as the handler. Wrapping it in an arrow function defers execution until the click event fires.',
        prevention:
          'Pass handlers as references (onClick={handler}) or arrow wrappers (onClick={() => handler(arg)}). Never call a state setter directly in the render body or in unguarded effect bodies.',
        relatedTool: 'diff-checker',
        severity: 'high',
        difficulty: 'beginner',
        timeEstimate: '5 min',
        tags: ['react', 'hooks', 'state', 'render-loop'],
        affectedVersions: 'All React versions',
        verifySteps: [
          'Confirm the component renders once and the loop is gone.',
          'Verify the state only changes on the actual click.',
          'Add an ESLint rule (react-hooks) to catch setter-in-render patterns.',
        ],
      },
    ],
  },
  {
    pkg: 'next',
    name: 'Next.js',
    language: 'javascript',
    version: '14.1.0',
    description: 'The React framework for production web apps.',
    category: 'Web framework',
    errors: [
      {
        errorSlug: 'hydration-failed-text-content-mismatch',
        errorName: 'Error',
        message: "Text content does not match server-rendered HTML",
        summary: 'The server-rendered markup differs from the first client render.',
        cause:
          'Rendering non-deterministic values (Date.now(), Math.random(), localStorage, window) during render makes the server HTML and the client HTML disagree, so hydration mismatches.',
        reproduce: `export default function Clock() {
  // Runs on the server AND the client with different values
  return <p>Rendered at {new Date().toLocaleTimeString()}</p>;
}`,
        fix: `"use client";
import { useState, useEffect } from "react";

export default function Clock() {
  const [time, setTime] = useState<string | null>(null);

  // Effects run only on the client, after hydration
  useEffect(() => {
    setTime(new Date().toLocaleTimeString());
  }, []);

  return <p>{time ? \`Rendered at \${time}\` : "Loading..."}</p>;
}`,
        explanation:
          'The server has no access to the user clock or browser APIs, so any value that differs between environments must be produced after hydration inside useEffect. The initial render then matches on both sides and React hydrates cleanly.',
        prevention:
          'Keep render output deterministic. Move browser-only and time-dependent values into useEffect, or gate them behind a mounted flag. Use suppressHydrationWarning only for unavoidable cases like timestamps.',
        relatedTool: 'diff-checker',
        severity: 'medium',
        difficulty: 'intermediate',
        timeEstimate: '15 min',
        tags: ['nextjs', 'ssr', 'hydration', 'react'],
        affectedVersions: 'App Router 13+ and 14',
        verifySteps: [
          'Confirm the hydration warning is gone in the browser console.',
          'Verify the initial server HTML matches the first client paint.',
          'Diff the server vs client output for the component to confirm parity.',
        ],
      },
    ],
  },
  {
    pkg: 'prisma',
    name: 'Prisma',
    language: 'javascript',
    version: '5.9.0',
    description: 'Next-generation Node.js and TypeScript ORM.',
    category: 'ORM / database',
    errors: [
      {
        errorSlug: 'p2002-unique-constraint-failed',
        errorName: 'PrismaClientKnownRequestError',
        message: 'Unique constraint failed on the fields: (`email`)',
        summary: 'Inserting a row whose unique field already exists (error code P2002).',
        cause:
          'A create() targets a column with a unique constraint, but a row with that value is already present, so the database rejects the insert and Prisma surfaces P2002.',
        reproduce: `import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Second call with the same email throws P2002
await prisma.user.create({ data: { email: "jane@example.com" } });
await prisma.user.create({ data: { email: "jane@example.com" } });`,
        fix: `import { Prisma, PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

try {
  await prisma.user.create({ data: { email: "jane@example.com" } });
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    // Idempotent path: the user already exists
    await prisma.user.update({
      where: { email: "jane@example.com" },
      data: {},
    });
  } else {
    throw e;
  }
}`,
        explanation:
          'P2002 is a typed, recoverable error. Checking e.code lets you implement an idempotent upsert path instead of crashing. For a single field you can also use prisma.user.upsert() to collapse the create/update into one atomic call.',
        prevention:
          'Use upsert() for naturally idempotent writes, and always branch on e.code for known request errors rather than treating every failure as fatal.',
        relatedTool: 'json-formatter',
        severity: 'medium',
        difficulty: 'intermediate',
        timeEstimate: '15 min',
        tags: ['prisma', 'database', 'constraints', 'idempotency'],
        affectedVersions: '4.x and 5.x',
        verifySteps: [
          'Confirm the duplicate insert is now handled instead of throwing.',
          'Verify a non-P2002 error still propagates (do not swallow everything).',
          'Re-run the operation twice and confirm it is idempotent.',
        ],
      },
    ],
  },
  {
    pkg: 'mongoose',
    name: 'Mongoose',
    language: 'javascript',
    version: '8.1.0',
    description: 'MongoDB object modeling for Node.js.',
    category: 'ODM / database',
    errors: [
      {
        errorSlug: 'operation-buffering-timed-out',
        errorName: 'MongooseError',
        message: 'Operation `users.insertOne()` buffering timed out after 10000ms',
        summary: 'A query ran before a connection to MongoDB was established.',
        cause:
          'Mongoose buffers operations until it connects. If connect() is never awaited (or the URI/network is wrong), the buffer never drains and the operation times out after 10 seconds.',
        reproduce: `import mongoose from "mongoose";
const User = mongoose.model("User", new mongoose.Schema({ name: String }));

// connect() is fired but not awaited; the query runs first
mongoose.connect(process.env.MONGO_URI!);
await User.create({ name: "Jane" }); // buffering timed out after 10000ms`,
        fix: `import mongoose from "mongoose";
const User = mongoose.model("User", new mongoose.Schema({ name: String }));

async function main() {
  await mongoose.connect(process.env.MONGO_URI!); // wait for the connection
  await User.create({ name: "Jane" });
}

main().catch((err) => {
  console.error("DB error:", err);
  process.exit(1);
});`,
        explanation:
          'Awaiting connect() guarantees the socket is open before any model operation runs, so the buffer drains immediately. If it still times out, the URI, credentials, or network/firewall path is wrong — not the code ordering.',
        prevention:
          'Establish the connection once at startup and await it before serving traffic. Fail fast on connection errors instead of letting every query hit the 10s buffer timeout.',
        relatedTool: 'json-formatter',
        severity: 'high',
        difficulty: 'beginner',
        timeEstimate: '10 min',
        tags: ['mongoose', 'mongodb', 'connection', 'async'],
        affectedVersions: '6.x, 7.x, 8.x',
        verifySteps: [
          'Confirm connect() is awaited before the first model call.',
          'Verify a bad URI now fails fast instead of waiting 10 seconds.',
          'Check the connection is established once at boot, not per request.',
        ],
      },
    ],
  },
  {
    pkg: 'typescript',
    name: 'TypeScript',
    language: 'javascript',
    version: '5.3.3',
    description: 'A typed superset of JavaScript that compiles to plain JavaScript.',
    category: 'Compiler / types',
    errors: [
      {
        errorSlug: 'ts2532-object-possibly-undefined',
        errorName: 'TS2532',
        message: "Object is possibly 'undefined'.",
        summary: 'Accessing a property on a value the compiler knows can be undefined.',
        cause:
          'With strictNullChecks on, an optional property, an array index, or a Map.get() result is typed as T | undefined, so a direct property access is unsafe.',
        reproduce: `interface Config { db?: { host: string } }

function getHost(cfg: Config): string {
  // cfg.db may be undefined -> TS2532
  return cfg.db.host;
}`,
        fix: `interface Config { db?: { host: string } }

function getHost(cfg: Config): string {
  // Optional chaining + a sensible default narrows the type
  return cfg.db?.host ?? "localhost";
}`,
        explanation:
          'Optional chaining (?.) short-circuits to undefined when cfg.db is missing, and the nullish coalescing operator (??) supplies a fallback, so the function provably returns a string. This is safer than a non-null assertion (cfg.db!.host), which only silences the compiler.',
        prevention:
          'Model optionality honestly in your types and handle the undefined branch explicitly. Prefer ?. and ?? over the ! assertion, which hides real runtime risk.',
        relatedTool: 'json-to-typescript',
        severity: 'low',
        difficulty: 'beginner',
        timeEstimate: '5 min',
        tags: ['typescript', 'types', 'strict-null-checks'],
        affectedVersions: 'strictNullChecks (2.0+)',
        verifySteps: [
          'Confirm tsc reports no TS2532 for the access.',
          'Verify the fallback path returns the expected value when the field is absent.',
          'Check no new non-null assertions (!) were introduced to silence the error.',
        ],
      },
    ],
  },
  {
    pkg: 'jackson-databind',
    name: 'Jackson Databind',
    language: 'java',
    version: '2.16.0',
    description: 'JSON serialization/deserialization for the Java ecosystem.',
    category: 'JSON / serialization',
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
        severity: 'medium',
        difficulty: 'beginner',
        timeEstimate: '10 min',
        tags: ['jackson', 'json', 'deserialization'],
        affectedVersions: '2.x',
        verifySteps: [
          'Confirm a payload with extra fields now deserializes without throwing.',
          'Verify required fields are still populated correctly.',
          'Add a test payload with a new field to prove forward compatibility.',
        ],
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
        severity: 'medium',
        difficulty: 'intermediate',
        timeEstimate: '15 min',
        tags: ['jackson', 'json', 'streams', 'http'],
        affectedVersions: '2.x',
        verifySteps: [
          'Confirm an empty body returns Optional.empty() instead of throwing.',
          'Verify the stream is only read once (no double-consume).',
          'Add a test for the 204/empty-200 path.',
        ],
      },
    ],
  },
  {
    pkg: 'spring-boot',
    name: 'Spring Boot',
    language: 'java',
    version: '3.2.2',
    description: 'Convention-over-configuration framework for production Java services.',
    category: 'Web framework',
    errors: [
      {
        errorSlug: 'nosuchbeandefinitionexception',
        errorName: 'org.springframework.beans.factory.NoSuchBeanDefinitionException',
        message: "Field orderService in com.example.OrderController required a bean of type 'com.example.OrderService' that could not be found.",
        summary: 'A dependency cannot be autowired because no matching bean is registered.',
        cause:
          'The target type is not a Spring-managed bean (missing @Service/@Component/@Repository) or it lives outside the package scanned by @SpringBootApplication, so the container has nothing to inject.',
        reproduce: `// OrderService is a plain class, NOT annotated
public class OrderService { /* ... */ }

@RestController
public class OrderController {
    @Autowired
    private OrderService orderService; // NoSuchBeanDefinitionException at startup
}`,
        fix: `import org.springframework.stereotype.Service;

@Service // now a managed bean, eligible for injection
public class OrderService { /* ... */ }

@RestController
public class OrderController {
    private final OrderService orderService;

    // Constructor injection is preferred over field @Autowired
    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }
}`,
        explanation:
          'Spring can only inject beans it manages. Annotating OrderService with @Service registers it during component scanning. Constructor injection also makes the dependency explicit and the class testable without the container.',
        prevention:
          'Annotate every injectable class and keep it under the application package root so component scanning finds it. Prefer constructor injection so missing dependencies fail fast and visibly.',
        relatedTool: 'diff-checker',
        severity: 'high',
        difficulty: 'beginner',
        timeEstimate: '10 min',
        tags: ['spring', 'dependency-injection', 'beans', 'startup'],
        affectedVersions: 'Spring Boot 2.x and 3.x',
        verifySteps: [
          'Confirm the application context starts without the missing-bean error.',
          'Verify the bean is found via component scan (check the package location).',
          'Confirm constructor injection wires the dependency in a unit test.',
        ],
      },
    ],
  },
  {
    pkg: 'hibernate-orm',
    name: 'Hibernate ORM',
    language: 'java',
    version: '6.4.1',
    description: 'The de-facto JPA implementation for Java persistence.',
    category: 'ORM / database',
    errors: [
      {
        errorSlug: 'lazyinitializationexception',
        errorName: 'org.hibernate.LazyInitializationException',
        message: 'could not initialize proxy [com.example.Order#1] - no Session',
        summary: 'Accessing a lazy association after the persistence Session has closed.',
        cause:
          'A @OneToMany/@ManyToOne is LAZY by default. When the entity leaves the transaction (e.g. serialised in the controller), the Session is gone and the proxy cannot fetch its data.',
        reproduce: `@Transactional(readOnly = true)
public Order load(Long id) {
    return orderRepository.findById(id).orElseThrow();
}

// Outside the transaction, in the controller:
order.getLineItems().size(); // LazyInitializationException`,
        fix: `public interface OrderRepository extends JpaRepository<Order, Long> {
    @Query("select o from Order o join fetch o.lineItems where o.id = :id")
    Optional<Order> findByIdWithItems(@Param("id") Long id);
}

// The join fetch loads lineItems inside the transaction
Order order = orderRepository.findByIdWithItems(id).orElseThrow();
order.getLineItems().size(); // works`,
        explanation:
          'A join fetch loads the association eagerly within the active Session, so the collection is already initialised when the entity is used later. Returning a DTO projection is an even cleaner alternative that never exposes lazy proxies beyond the data layer.',
        prevention:
          'Fetch exactly what each use case needs with an explicit join fetch or DTO query. Avoid Open-Session-In-View as a crutch; it hides N+1 problems and leaks the persistence context into the view layer.',
        relatedTool: 'diff-checker',
        severity: 'high',
        difficulty: 'advanced',
        timeEstimate: '25 min',
        tags: ['hibernate', 'jpa', 'lazy-loading', 'transactions'],
        affectedVersions: 'Hibernate 5.x and 6.x',
        verifySteps: [
          'Confirm the association reads cleanly outside the transaction.',
          'Verify the SQL log shows a single join fetch rather than N+1 selects.',
          'Add a test that serialises the entity after the transaction closes.',
        ],
      },
    ],
  },
  {
    pkg: 'encoding-json',
    name: 'encoding/json',
    language: 'go',
    version: 'go1.22',
    description: "Go's standard-library JSON encoder/decoder.",
    category: 'JSON / serialization',
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
        severity: 'medium',
        difficulty: 'intermediate',
        timeEstimate: '15 min',
        tags: ['go', 'json', 'unmarshal', 'types'],
        affectedVersions: 'All Go versions',
        verifySteps: [
          'Confirm both 42 and "42" now unmarshal without error.',
          'Verify Int64() returns the expected numeric value.',
          'Add both wire formats as decode test cases.',
        ],
      },
    ],
  },
  {
    pkg: 'database-sql',
    name: 'database/sql',
    language: 'go',
    version: 'go1.22',
    description: "Go's standard-library generic SQL interface.",
    category: 'Database',
    errors: [
      {
        errorSlug: 'sql-no-rows-in-result-set',
        errorName: 'sql.ErrNoRows',
        message: 'sql: no rows in result set',
        summary: 'QueryRow().Scan() ran against a query that matched zero rows.',
        cause:
          'QueryRow returns a deferred error that surfaces at Scan time. When the WHERE clause matches nothing, Scan returns sql.ErrNoRows, which is an expected "not found" — not a failure.',
        reproduce: `var name string
err := db.QueryRow("SELECT name FROM users WHERE id = $1", 9999).Scan(&name)
if err != nil {
    log.Fatal(err) // crashes on a perfectly normal "not found"
}`,
        fix: `import (
    "database/sql"
    "errors"
)

var name string
err := db.QueryRow("SELECT name FROM users WHERE id = $1", 9999).Scan(&name)
switch {
case errors.Is(err, sql.ErrNoRows):
    // expected: no such user
    http.Error(w, "user not found", http.StatusNotFound)
case err != nil:
    http.Error(w, "internal error", http.StatusInternalServerError)
default:
    fmt.Fprintln(w, name)
}`,
        explanation:
          'errors.Is(err, sql.ErrNoRows) distinguishes an empty result (a 404-class condition) from a genuine database failure (a 500-class condition). Treating the two the same is what turns a normal lookup miss into a crash.',
        prevention:
          'Always branch on sql.ErrNoRows for single-row queries and map it to a domain "not found" rather than a server error.',
        relatedTool: 'diff-checker',
        severity: 'medium',
        difficulty: 'beginner',
        timeEstimate: '10 min',
        tags: ['go', 'sql', 'error-handling', 'database'],
        affectedVersions: 'All Go versions',
        verifySteps: [
          'Confirm a missing row returns a 404-class response, not a crash.',
          'Verify a real DB error still maps to a 500-class response.',
          'Add a test for the zero-rows path.',
        ],
      },
    ],
  },
  {
    pkg: 'express',
    name: 'Express',
    language: 'javascript',
    version: '4.18.2',
    description: 'Minimal and flexible Node.js web framework.',
    category: 'Web framework',
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
        severity: 'high',
        difficulty: 'beginner',
        timeEstimate: '5 min',
        tags: ['express', 'http', 'middleware', 'control-flow'],
        affectedVersions: '4.x and 5.x',
        verifySteps: [
          'Confirm the not-found branch returns and stops the handler.',
          'Verify the happy path still sends exactly one response.',
          'Add a test hitting a missing id to prove only one write occurs.',
        ],
      },
    ],
  },
  {
    pkg: 'guzzlehttp',
    name: 'Guzzle',
    language: 'php',
    version: '7.8.0',
    description: 'PHP HTTP client used across the Composer ecosystem.',
    category: 'HTTP client',
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
        severity: 'medium',
        difficulty: 'beginner',
        timeEstimate: '10 min',
        tags: ['php', 'http', 'guzzle', 'error-handling'],
        affectedVersions: '6.x and 7.x',
        verifySteps: [
          'Confirm a 404 now yields null instead of an uncaught exception.',
          'Verify a 500 still throws and is not silently swallowed.',
          'Add a test for both the found and not-found responses.',
        ],
      },
    ],
  },
  {
    pkg: 'laravel-framework',
    name: 'Laravel',
    language: 'php',
    version: '10.48.0',
    description: 'The PHP framework for web artisans.',
    category: 'Web framework',
    errors: [
      {
        errorSlug: 'queryexception-column-not-found-42s22',
        errorName: 'Illuminate\\Database\\QueryException',
        message: "SQLSTATE[42S22]: Column not found: 1054 Unknown column 'emai' in 'where clause'",
        summary: 'A query references a column that does not exist (often a typo or a missing migration).',
        cause:
          'The Eloquent where()/select() names a column the table does not have — usually a typo, a renamed column, or a migration that has not run in this environment.',
        reproduce: `// 'emai' is a typo for 'email'
$user = User::where('emai', 'jane@example.com')->first();
// Illuminate\\Database\\QueryException SQLSTATE[42S22]`,
        fix: `// 1) Fix the column name to match the schema
$user = User::where('email', 'jane@example.com')->first();

// 2) If the column is new, make sure the migration has run:
//    php artisan migrate --force
// 3) Confirm the actual columns at runtime if unsure:
$columns = Schema::getColumnListing('users');`,
        explanation:
          'SQLSTATE[42S22] is the database telling you the column is unknown. The fix is to align the query with the real schema: correct the spelling, run the pending migration, or check Schema::getColumnListing to see what actually exists in this environment.',
        prevention:
          'Keep migrations in version control and run them in every environment as part of deploy. Reference column names through constants or model casts to avoid free-typed strings drifting from the schema.',
        relatedTool: 'diff-checker',
        severity: 'high',
        difficulty: 'beginner',
        timeEstimate: '10 min',
        tags: ['php', 'laravel', 'eloquent', 'database', 'migrations'],
        affectedVersions: 'Laravel 9, 10, 11',
        verifySteps: [
          'Confirm the corrected query returns the expected row.',
          'Verify pending migrations have run in the failing environment.',
          'Compare Schema::getColumnListing output against the query column names.',
        ],
      },
    ],
  },
  {
    pkg: 'nokogiri',
    name: 'Nokogiri',
    language: 'ruby',
    version: '1.16.0',
    description: 'HTML/XML parser for Ruby.',
    category: 'Parsing',
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
        severity: 'medium',
        difficulty: 'intermediate',
        timeEstimate: '15 min',
        tags: ['ruby', 'xml', 'parsing', 'resilience'],
        affectedVersions: '1.1x',
        verifySteps: [
          'Confirm truncated XML now parses in recover mode instead of raising.',
          'Verify doc.errors is logged so truncation is observable.',
          'Add a test feeding a deliberately broken document.',
        ],
      },
    ],
  },
  {
    pkg: 'rails-activerecord',
    name: 'Rails (ActiveRecord)',
    language: 'ruby',
    version: '7.1.3',
    description: 'The model layer of Ruby on Rails.',
    category: 'ORM / database',
    errors: [
      {
        errorSlug: 'activerecord-recordnotfound',
        errorName: 'ActiveRecord::RecordNotFound',
        message: "Couldn't find User with 'id'=9999",
        summary: 'Model.find raised because no row matched the given id.',
        cause:
          'find() is strict: it raises RecordNotFound when the id is absent. In a controller this surfaces as an unhandled 500 unless you either rescue it or use a non-raising finder.',
        reproduce: `class UsersController < ApplicationController
  def show
    # find raises if the id does not exist -> 500
    @user = User.find(params[:id])
  end
end`,
        fix: `class UsersController < ApplicationController
  def show
    @user = User.find_by(id: params[:id])
    return head :not_found if @user.nil?
    # ... render @user
  end
end

# Or rescue globally to return a proper 404:
# rescue_from ActiveRecord::RecordNotFound do
#   head :not_found
# end`,
        explanation:
          'find_by returns nil instead of raising, so you can branch and return a real 404. The rescue_from variant centralises the mapping for every controller, turning a missing record into the correct HTTP status rather than a server error.',
        prevention:
          'Use find_by for lookups that may legitimately miss, reserve find for ids you know exist, and add a rescue_from for RecordNotFound so misses never leak as 500s.',
        relatedTool: 'diff-checker',
        severity: 'medium',
        difficulty: 'beginner',
        timeEstimate: '10 min',
        tags: ['ruby', 'rails', 'activerecord', 'error-handling'],
        affectedVersions: 'Rails 6, 7',
        verifySteps: [
          'Confirm a missing id returns 404 rather than 500.',
          'Verify an existing id still renders normally.',
          'Add a request spec for the not-found path.',
        ],
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

export interface FixStats {
  /** Total number of individual error-fix pages. */
  fixes: number;
  /** Distinct libraries covered. */
  libraries: number;
  /** Distinct languages covered. */
  languages: number;
  /** Distinct topic tags across all fixes. */
  tags: number;
}

/** Aggregate counts used by the hub/index page header. */
export function getFixStats(): FixStats {
  const tagSet = new Set<string>();
  const langSet = new Set<LanguageId>();
  for (const library of libraryCatalog) {
    langSet.add(library.language);
    for (const error of library.errors) {
      for (const tag of error.tags ?? []) tagSet.add(tag);
    }
  }
  return {
    fixes: getFixCount(),
    libraries: libraryCatalog.length,
    languages: langSet.size,
    tags: tagSet.size,
  };
}

/**
 * Resolve the display metadata for a fix, filling in deterministic defaults for
 * any optional field that a curated entry omitted. This guarantees every /fix
 * page renders a complete, professional "at a glance" panel — no blank cells —
 * regardless of how fully the underlying catalog entry was annotated.
 */
export interface FixPresentation {
  severity: ErrorSeverity;
  difficulty: ErrorDifficulty;
  timeEstimate: string;
  affectedVersions: string;
  tags: string[];
  verifySteps: string[];
}

const SEVERITY_FALLBACK_BY_KEYWORD: Array<{ test: RegExp; severity: ErrorSeverity }> = [
  { test: /security|ssl|certificate|token|xss|injection/i, severity: 'high' },
  { test: /timeout|hang|leak|crash|infinite/i, severity: 'high' },
];

export function getFixPresentation(resolved: ResolvedFix): FixPresentation {
  const { error, library } = resolved;

  let severity: ErrorSeverity = error.severity ?? 'medium';
  if (!error.severity) {
    const haystack = `${error.errorName} ${error.summary} ${error.tags?.join(' ') ?? ''}`;
    for (const rule of SEVERITY_FALLBACK_BY_KEYWORD) {
      if (rule.test.test(haystack)) {
        severity = rule.severity;
        break;
      }
    }
  }

  const verifySteps =
    error.verifySteps && error.verifySteps.length > 0
      ? error.verifySteps
      : [
          `Reproduce the original ${error.errorName} with the snippet above to confirm the failure.`,
          'Apply the fix and confirm the error no longer appears in logs.',
          'Add a regression test so the fixed behaviour is locked in for future releases.',
        ];

  const tags =
    error.tags && error.tags.length > 0
      ? error.tags
      : [library.language, library.pkg, 'error-fix'];

  return {
    severity,
    difficulty: error.difficulty ?? 'intermediate',
    timeEstimate: error.timeEstimate ?? '15 min',
    affectedVersions: error.affectedVersions ?? `Observed in ${library.name} ${library.version}`,
    tags,
    verifySteps,
  };
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
