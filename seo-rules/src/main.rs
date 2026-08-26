//! Stage-1 CLI around `src/seo_rules.rs`.
//!
//! Commands:
//!   self-test        run the crate tests' invariants and print PASS
//!   jaccard-stream   binary 5-gram Jaccard with early exit (stdin → stdout)
//!   validate-json    one JSON object per line → AuditResult JSON
//!
//! Jaccard stream protocol (little-endian, repeated until EOF):
//!   u32 n_left, n_left × u64 hashes, u32 n_right, n_right × u64 hashes
//! Response per pair:
//!   f64 jaccard, u8 exceeded (1 when > 0.040), u8 early_exit

use seo_rules::{
    jaccard_5gram_early_exit, keyword_density, meta_ends_with_trailing_conjunction,
    validate_google_bing_standards, AuditResult, PageMetadata, MAX_BODY_JACCARD,
};
use std::io::{self, BufRead, Read, Write};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let cmd = args.get(1).map(String::as_str).unwrap_or("self-test");
    match cmd {
        "self-test" => self_test(),
        "jaccard-stream" => {
            if let Err(err) = jaccard_stream() {
                eprintln!("jaccard-stream: {err}");
                std::process::exit(1);
            }
        }
        "validate-json" => {
            if let Err(err) = validate_json() {
                eprintln!("validate-json: {err}");
                std::process::exit(1);
            }
        }
        _ => {
            eprintln!("usage: seo-audit <self-test|jaccard-stream|validate-json>");
            std::process::exit(2);
        }
    }
}

fn self_test() {
    let title = "Validate JSON: backend debug no-CLI-audit via-fmt";
    let meta = "Validate JSON with the formatter tool: a backend workflow for debug production, built for audit readiness. Runs locally in your browser without uploads.";
    let json = format!(
        r#"{{"@type":"TechArticle","headline":"{title}","description":"{meta}"}}"#
    );
    let owned: Vec<String> = (0..1800).map(|i| format!("w{i}")).collect();
    let body: Vec<&str> = owned.iter().map(String::as_str).collect();
    let page = PageMetadata {
        title,
        meta_desc: meta,
        h1: title,
        body_words: body,
        json_ld_text: &json,
    };
    let result = validate_google_bing_standards(&page);
    assert!(
        result.is_indexable,
        "expected passing fixture, got {:?}",
        result.reject_reason
    );
    assert!(meta_ends_with_trailing_conjunction("padding that ends with"));
    assert!(keyword_density(&["json", "json", "the", "a"]) > 0.5);
    println!("PASS seo-audit self-test");
}

fn jaccard_stream() -> io::Result<()> {
    let mut stdin = io::stdin().lock();
    let mut stdout = io::stdout().lock();
    loop {
        let left = match read_hashes(&mut stdin)? {
            Some(v) => v,
            None => return Ok(()),
        };
        let right = match read_hashes(&mut stdin)? {
            Some(v) => v,
            None => {
                return Err(io::Error::new(
                    io::ErrorKind::UnexpectedEof,
                    "missing right-hand hash list",
                ))
            }
        };
        let result = jaccard_5gram_early_exit(&left, &right, MAX_BODY_JACCARD);
        stdout.write_all(&result.jaccard.to_le_bytes())?;
        stdout.write_all(&[u8::from(result.exceeded), u8::from(result.early_exit)])?;
        stdout.flush()?;
    }
}

fn read_hashes(stdin: &mut impl Read) -> io::Result<Option<Vec<u64>>> {
    let mut count_buf = [0u8; 4];
    match stdin.read_exact(&mut count_buf) {
        Ok(()) => {}
        Err(err) if err.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(err) => return Err(err),
    }
    let count = u32::from_le_bytes(count_buf) as usize;
    let mut bytes = vec![0u8; count.saturating_mul(8)];
    stdin.read_exact(&mut bytes)?;
    let mut hashes = Vec::with_capacity(count);
    for chunk in bytes.chunks_exact(8) {
        hashes.push(u64::from_le_bytes(chunk.try_into().unwrap()));
    }
    Ok(Some(hashes))
}

fn validate_json() -> io::Result<()> {
    let stdin = io::stdin().lock();
    let mut stdout = io::stdout().lock();
    for line in stdin.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let result = validate_line(&line);
        writeln!(
            stdout,
            "{{\"is_indexable\":{},\"jaccard_score\":{},\"reject_reason\":{}}}",
            if result.is_indexable { "true" } else { "false" },
            result.jaccard_score,
            reason_json(result.reject_reason)
        )?;
    }
    Ok(())
}

fn reason_json(reason: Option<&str>) -> String {
    match reason {
        Some(text) => format!("\"{}\"", text.replace('\\', "\\\\").replace('"', "\\\"")),
        None => "null".to_string(),
    }
}

fn validate_line(line: &str) -> AuditResult {
    let title = extract_string(line, "title").unwrap_or_default();
    let meta = extract_string(line, "meta_desc").unwrap_or_default();
    let h1 = extract_string(line, "h1").unwrap_or_default();
    let json_ld = extract_string(line, "json_ld_text").unwrap_or_default();
    let body = extract_string(line, "body").unwrap_or_default();
    let words: Vec<&str> = body.split_whitespace().collect();
    let page = PageMetadata {
        title: &title,
        meta_desc: &meta,
        h1: &h1,
        body_words: words,
        json_ld_text: &json_ld,
    };
    validate_google_bing_standards(&page)
}

fn extract_string(json: &str, key: &str) -> Option<String> {
    let needle = format!("\"{key}\":");
    let rest = json.split_once(&needle)?.1.trim_start();
    if !rest.starts_with('"') {
        return None;
    }
    let mut out = String::new();
    let chars = rest[1..].chars();
    let mut escape = false;
    for ch in chars {
        if escape {
            out.push(match ch {
                'n' => '\n',
                't' => '\t',
                other => other,
            });
            escape = false;
            continue;
        }
        if ch == '\\' {
            escape = true;
            continue;
        }
        if ch == '"' {
            return Some(out);
        }
        out.push(ch);
    }
    None
}
