use sha2::{Sha256, Digest};

#[derive(Debug, Clone)]
pub enum ChecksumType {
    Md5,
    Sha256,
}

impl ChecksumType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "md5" => Some(ChecksumType::Md5),
            "sha256" => Some(ChecksumType::Sha256),
            _ => None,
        }
    }
}

pub enum ChecksumCalculator {
    Md5(md5::Context),
    Sha256(Sha256),
}

impl ChecksumCalculator {
    pub fn new(checksum_type: ChecksumType) -> Self {
        match checksum_type {
            ChecksumType::Md5 => ChecksumCalculator::Md5(md5::Context::new()),
            ChecksumType::Sha256 => ChecksumCalculator::Sha256(Sha256::new()),
        }
    }

    pub fn update(&mut self, data: &[u8]) {
        match self {
            ChecksumCalculator::Md5(hasher) => hasher.consume(data),
            ChecksumCalculator::Sha256(hasher) => hasher.update(data),
        }
    }

    pub fn finalize(self) -> String {
        match self {
            // MD5: output hex with high-nibble first per byte (standard RFC), to match backend
            ChecksumCalculator::Md5(hasher) => hasher
                .compute()
                .as_ref()
                .iter()
                .map(|b| format!("{:02x}", *b))
                .collect::<String>(),
            ChecksumCalculator::Sha256(hasher) => format!("{:x}", hasher.finalize()),
        }
    }
}

/// Swap high/low nibbles for each byte in a hex string.
/// Example: "9a2d" -> "a9d2".
pub fn swap_hex_nibbles_per_byte(hex: &str) -> Option<String> {
    let bytes = hex.as_bytes();
    if bytes.is_empty() || bytes.len() % 2 != 0 {
        return None;
    }
    if !bytes.iter().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }

    let mut out = String::with_capacity(bytes.len());
    for pair in bytes.chunks_exact(2) {
        out.push(pair[1] as char);
        out.push(pair[0] as char);
    }
    Some(out.to_lowercase())
}

