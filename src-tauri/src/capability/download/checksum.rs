use sha2::{Sha256, Digest};
use std::io::Read;

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
            ChecksumCalculator::Md5(hasher) => format!("{:x}", hasher.compute()),
            ChecksumCalculator::Sha256(hasher) => format!("{:x}", hasher.finalize()),
        }
    }
}

