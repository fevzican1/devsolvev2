//! Google Search Essentials + Bing Webmaster Quality & Authority — hard limits.
//!
//! Stage 1 (offline / VM) scans every URL in the 20M factory against this
//! module. Failures are quarantined (404 seeds). Passes are recorded in
//! `indexable_manifest.bin`. Stage 2 (Cloudflare Pages) must not re-score the
//! 20M corpus inside the 20-minute build window; it only publishes seeds the
//! manifest already approved.
//!
//! Jaccard is **not** all-pairs 20M². Each URL is compared to its style+1 and
//! context+1 neighbours (and title/H1 against the same pair) with 5-gram hashes
//! and early-exit as soon as Jaccard exceeds 0.040.

use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

pub const TITLE_MIN: usize = 30;
pub const TITLE_MAX: usize = 66;
pub const META_MIN: usize = 150;
pub const META_MAX: usize = 160;
pub const MIN_WORDS: usize = 1700;
pub const MAX_KEYWORD_DENSITY: f64 = 0.025;
pub const MAX_BODY_JACCARD: f64 = 0.040;
pub const MAX_TITLE_H1_JACCARD: f64 = 0.10;
pub const SHINGLE_N: usize = 5;
pub const MIN_H2: usize = 4;
pub const MIN_JSON_LD_BLOCKS: usize = 3;
pub const MIN_INTERNAL_LINKS: usize = 14;

const TRAILING_CONJUNCTIONS: &[&str] = &[" in", " of", " with", " via"];

const STOPWORDS: &[&str] = &[
    "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "with",
    "is", "are", "was", "were", "be", "been", "being", "it", "its", "this", "that",
    "these", "those", "as", "at", "by", "from", "into", "your", "you", "we", "our",
    "their", "they", "can", "will", "not", "no", "if", "than", "then", "so", "such",
    "each", "more", "most", "some", "any", "all", "when", "how", "what", "why",
    "which", "who", "do", "does", "did", "have", "has", "had", "i", "us", "about",
    "also", "use", "using", "used", "per", "via", "after", "before", "during",
    "under", "across", "versus", "beside", "inside", "without", "ahead", "next",
    "upon", "among", "against", "within", "between",
];

static STOPWORD_SET: LazyLock<HashSet<&'static str>> =
    LazyLock::new(|| STOPWORDS.iter().copied().collect());

pub struct PageMetadata<'a> {
    pub title: &'a str,
    pub meta_desc: &'a str,
    pub h1: &'a str,
    pub body_words: Vec<&'a str>,
    pub json_ld_text: &'a str,
}

pub struct AuditResult {
    pub is_indexable: bool,
    pub jaccard_score: f64,
    pub reject_reason: Option<&'static str>,
}

pub struct JaccardResult {
    pub jaccard: f64,
    pub exceeded: bool,
    pub early_exit: bool,
    pub intersection: usize,
    pub union: usize,
}

pub fn validate_google_bing_standards(page: &PageMetadata) -> AuditResult {
    let title_len = page.title.chars().count();
    if !(TITLE_MIN..=TITLE_MAX).contains(&title_len) {
        return reject("Title length out of bounds (30-66)");
    }
    let meta_len = page.meta_desc.chars().count();
    if !(META_MIN..=META_MAX).contains(&meta_len) {
        return reject("Meta description length out of bounds (150-160)");
    }
    if meta_ends_with_trailing_conjunction(page.meta_desc) {
        return reject("Meta ends with trailing conjunction");
    }
    if page.body_words.len() < MIN_WORDS {
        return reject("Thin content: Word count under 1700");
    }
    if keyword_density(&page.body_words) > MAX_KEYWORD_DENSITY {
        return reject("Keyword density above 2.5%");
    }
    if page.h1 != page.title {
        return reject("H1 does not match Title exactly");
    }
    if page.json_ld_text.trim().is_empty() {
        return reject("Missing or corrupt JSON-LD payload");
    }
    if !json_ld_matches_html(page) {
        return reject("JSON-LD does not match HTML title/H1/description");
    }
    AuditResult {
        is_indexable: true,
        jaccard_score: 0.0,
        reject_reason: None,
    }
}

pub fn meta_ends_with_trailing_conjunction(meta: &str) -> bool {
    let trimmed = meta.trim();
    let stripped = trimmed
        .trim_end_matches(|c: char| matches!(c, '.' | ',' | ';' | ':' | '—' | '–' | '-'))
        .trim_end();
    let lower = stripped.to_ascii_lowercase();
    TRAILING_CONJUNCTIONS
        .iter()
        .any(|tail| lower.ends_with(tail))
}

pub fn keyword_density(words: &[&str]) -> f64 {
    let mut freq: HashMap<String, usize> = HashMap::new();
    let mut total = 0usize;
    for word in words {
        let lower = word.to_ascii_lowercase();
        if lower.len() < 2 {
            continue;
        }
        if lower.bytes().filter(|b| *b == b'-').count() >= 2 {
            continue;
        }
        if STOPWORD_SET.contains(lower.as_str()) {
            continue;
        }
        total += 1;
        *freq.entry(lower).or_insert(0) += 1;
    }
    if total == 0 {
        return 0.0;
    }
    let top = freq.values().copied().max().unwrap_or(0);
    top as f64 / total as f64
}

pub fn json_ld_matches_html(page: &PageMetadata) -> bool {
    let blob = page.json_ld_text;
    if blob.trim().is_empty() {
        return false;
    }
    blob.contains(page.h1) && blob.contains(page.meta_desc)
}

pub fn hash_5grams(words: &[&str]) -> Vec<u64> {
    if words.len() < SHINGLE_N {
        return Vec::new();
    }
    let mut set = HashSet::with_capacity(words.len());
    let lower: Vec<String> = words.iter().map(|w| w.to_ascii_lowercase()).collect();
    for window in lower.windows(SHINGLE_N) {
        set.insert(fnv1a64_gram(window));
    }
    let mut out: Vec<u64> = set.into_iter().collect();
    out.sort_unstable();
    out
}

pub fn jaccard_5gram_early_exit(left: &[u64], right: &[u64], ceiling: f64) -> JaccardResult {
    if left.is_empty() && right.is_empty() {
        return JaccardResult {
            jaccard: 0.0,
            exceeded: false,
            early_exit: false,
            intersection: 0,
            union: 0,
        };
    }
    let (small, large) = if left.len() <= right.len() {
        (left, right)
    } else {
        (right, left)
    };
    let large_set: HashSet<u64> = large.iter().copied().collect();
    let mut inter = 0usize;
    let small_len = small.len();
    let large_len = large.len();
    for (i, hash) in small.iter().enumerate() {
        if large_set.contains(hash) {
            inter += 1;
            let union = large_len + small_len - inter;
            if union > 0 {
                let jaccard = inter as f64 / union as f64;
                if jaccard > ceiling {
                    return JaccardResult {
                        jaccard,
                        exceeded: true,
                        early_exit: true,
                        intersection: inter,
                        union,
                    };
                }
            }
        }
        let _ = i;
    }
    let union = large_len + small_len - inter;
    let jaccard = if union == 0 {
        0.0
    } else {
        inter as f64 / union as f64
    };
    JaccardResult {
        jaccard,
        exceeded: jaccard > ceiling,
        early_exit: false,
        intersection: inter,
        union,
    }
}

pub fn jaccard_words(left: &[&str], right: &[&str], ceiling: f64) -> JaccardResult {
    jaccard_5gram_early_exit(&hash_5grams(left), &hash_5grams(right), ceiling)
}

fn reject(reason: &'static str) -> AuditResult {
    AuditResult {
        is_indexable: false,
        jaccard_score: 0.0,
        reject_reason: Some(reason),
    }
}

fn fnv1a64_gram(words: &[String]) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for (i, word) in words.iter().enumerate() {
        if i > 0 {
            hash ^= 0x1f;
            hash = hash.wrapping_mul(0x00000100000001b3);
        }
        for byte in word.as_bytes() {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(0x00000100000001b3);
        }
    }
    hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn title_bounds() {
        let words = vec!["word"; 1700];
        let page = PageMetadata {
            title: "short",
            meta_desc: &"x".repeat(155),
            h1: "short",
            body_words: words,
            json_ld_text: "short xxxxx",
        };
        let result = validate_google_bing_standards(&page);
        assert!(!result.is_indexable);
        assert_eq!(
            result.reject_reason,
            Some("Title length out of bounds (30-66)")
        );
    }

    #[test]
    fn h1_must_equal_title() {
        let title = "Validate JSON: backend debug no-CLI-audit via-fmt";
        assert!(title.chars().count() >= 30);
        let meta = "Validate JSON with the formatter tool: a backend workflow for debug production, built for audit readiness. Runs locally in your browser without uploads.";
        assert!(meta.chars().count() >= 150 && meta.chars().count() <= 160);
        let json = format!("{title} {meta}");
        let owned: Vec<String> = (0..1700).map(|i| format!("w{i}")).collect();
        let words: Vec<&str> = owned.iter().map(|s| s.as_str()).collect();
        let page = PageMetadata {
            title,
            meta_desc: meta,
            h1: "Some other heading that is not the title at all",
            body_words: words,
            json_ld_text: &json,
        };
        let result = validate_google_bing_standards(&page);
        assert!(!result.is_indexable);
        assert_eq!(
            result.reject_reason,
            Some("H1 does not match Title exactly")
        );
    }

    #[test]
    fn trailing_conjunction_rejected() {
        assert!(meta_ends_with_trailing_conjunction(
            "A perfectly long description that would otherwise pass but ends with"
        ));
        assert!(meta_ends_with_trailing_conjunction("ends with in"));
        assert!(!meta_ends_with_trailing_conjunction(
            "Runs locally in your browser without a trailing conjunction here."
        ));
    }

    #[test]
    fn jaccard_early_exit_on_near_duplicate() {
        let a: Vec<String> = (0..2000).map(|i| format!("tok{i}")).collect();
        let a_ref: Vec<&str> = a.iter().map(|s| s.as_str()).collect();
        let mut b = a.clone();
        b[0] = "changed".to_string();
        let b_ref: Vec<&str> = b.iter().map(|s| s.as_str()).collect();
        let result = jaccard_words(&a_ref, &b_ref, MAX_BODY_JACCARD);
        assert!(result.exceeded);
        assert!(result.jaccard > MAX_BODY_JACCARD);
    }

    #[test]
    fn jaccard_distinct_under_ceiling() {
        let a: Vec<String> = (0..2000).map(|i| format!("left{i}")).collect();
        let b: Vec<String> = (0..2000).map(|i| format!("right{i}")).collect();
        let a_ref: Vec<&str> = a.iter().map(|s| s.as_str()).collect();
        let b_ref: Vec<&str> = b.iter().map(|s| s.as_str()).collect();
        let result = jaccard_words(&a_ref, &b_ref, MAX_BODY_JACCARD);
        assert!(!result.exceeded);
        assert!(result.jaccard <= MAX_BODY_JACCARD);
    }

    #[test]
    fn passing_page() {
        let title = "Validate JSON: backend debug no-CLI-audit via-fmt";
        let meta = "Validate JSON with the formatter tool: a backend workflow for debug production, built for audit readiness. Runs locally in your browser without uploads.";
        assert!((TITLE_MIN..=TITLE_MAX).contains(&title.chars().count()));
        assert!((META_MIN..=META_MAX).contains(&meta.chars().count()));
        let json = format!(
            r#"{{"@type":"TechArticle","headline":"{title}","description":"{meta}"}}"#
        );
        let words: Vec<&str> = (0..1800).map(|_| "uniquebodytoken").collect();
        // 1800 copies of one token → density 100%. Use varied tokens.
        let owned: Vec<String> = (0..1800).map(|i| format!("w{i}")).collect();
        let body: Vec<&str> = owned.iter().map(|s| s.as_str()).collect();
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
            "{:?}",
            result.reject_reason
        );
        let _ = words;
    }
}
