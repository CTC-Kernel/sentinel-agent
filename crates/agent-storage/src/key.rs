//! Encryption key management for SQLCipher.
//!
//! This module handles derivation and storage of database encryption keys.
//! Keys are derived from machine-specific data and protected using platform-specific mechanisms:
//! - Windows: DPAPI (Data Protection API)
//! - Linux: File with restrictive permissions (0600)

use crate::error::{StorageError, StorageResult};
use agent_common::config::AgentConfig;
#[cfg(unix)]
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, info};

/// Length of the encryption key in bytes (256 bits for AES-256).
const KEY_LENGTH: usize = 32;

/// Key file name.
#[cfg(unix)]
const KEY_FILE_NAME: &str = ".sentinel-key";

#[cfg(windows)]
const KEY_FILE_NAME: &str = "key.dpapi";

/// Key manager for database encryption.
///
/// Handles key derivation, storage, and retrieval for SQLCipher encryption.
pub struct KeyManager {
    /// The encryption key (32 bytes for AES-256).
    key: [u8; KEY_LENGTH],
}

impl KeyManager {
    /// Create a new key manager, loading or generating a key.
    ///
    /// On first run, generates a new key and stores it securely.
    /// On subsequent runs, loads the existing key.
    pub fn new() -> StorageResult<Self> {
        let key_path = Self::get_key_path();

        let key = if key_path.exists() {
            Self::load_key(&key_path)?
        } else {
            let new_key = Self::generate_key();
            Self::store_key(&key_path, &new_key)?;
            new_key
        };

        Ok(Self { key })
    }

    /// Create a key manager with a specific key (for testing only).
    #[cfg(test)]
    pub fn new_with_test_key() -> Self {
        Self {
            // Exactly 32 bytes for AES-256
            key: *b"01234567890123456789012345678901",
        }
    }

    /// Create a key manager with a specific key.
    pub fn new_with_key(key: &[u8]) -> Self {
        let mut key_array = [0u8; KEY_LENGTH];
        let len = key.len().min(KEY_LENGTH);
        key_array[..len].copy_from_slice(&key[..len]);
        Self { key: key_array }
    }

    /// Get the database encryption key.
    /// Get the encryption key for the database.
    ///
    /// On Unix, the key is bound to the machine's hardware ID (machine-id)
    /// to prevent unauthorized use on other systems even if the key file is stolen.
    pub fn get_database_key(&self) -> StorageResult<Vec<u8>> {
        #[cfg(unix)]
        {
            let hwid = self.get_hwid().map_err(|e| {
                StorageError::KeyManagement(format!("Failed to retrieve Hardware ID: {}", e))
            })?;

            let mut final_key = self.key;
            for (i, byte) in final_key.iter_mut().enumerate() {
                *byte ^= hwid[i % hwid.len()];
            }
            Ok(final_key.to_vec())
        }
        #[cfg(not(unix))]
        {
            Ok(self.key.to_vec())
        }
    }

    /// Retrieve a machine-specific hardware identifier on Unix.
    #[cfg(unix)]
    fn get_hwid(&self) -> Result<Vec<u8>, std::io::Error> {
        let mut id = String::new();

        #[cfg(target_os = "linux")]
        {
            if let Ok(content) = fs::read_to_string("/etc/machine-id") {
                id = content.trim().to_string();
            } else if let Ok(content) = fs::read_to_string("/var/lib/dbus/machine-id") {
                id = content.trim().to_string();
            }
        }

        #[cfg(target_os = "macos")]
        {
            // Fetch IOPlatformUUID (equivalent to machine-id on macOS)
            if let Ok(output) = std::process::Command::new("ioreg")
                .args(["-rd1", "-c", "IOPlatformExpertDevice"])
                .output()
                && let Ok(content) = String::from_utf8(output.stdout)
            {
                for line in content.lines() {
                    if line.contains("IOPlatformUUID")
                        && let Some(uuid) = line.split('"').nth(3)
                    {
                        id = uuid.to_string();
                        break;
                    }
                }
            }
        }

        if id.is_empty() {
            // Fallback to hostname if machine-specific ID is unavailable
            id = hostname::get()
                .map(|h| h.to_string_lossy().to_string())
                .unwrap_or_else(|_| "sentinel-fallback-id".to_string());
        }

        // Return SHA256 hash of the machine ID as entropy
        let mut hasher = Sha256::new();
        hasher.update(id.as_bytes());
        Ok(hasher.finalize().to_vec())
    }

    /// Get the path to the key file.
    fn get_key_path() -> PathBuf {
        AgentConfig::platform_data_dir().join(KEY_FILE_NAME)
    }

    /// Generate a new random encryption key using a CSPRNG.
    ///
    /// Returns an error if the platform CSPRNG is unavailable.
    /// This function MUST NOT fall back to a weak key.
    fn generate_key() -> [u8; KEY_LENGTH] {
        use getrandom::getrandom;

        let mut key = [0u8; KEY_LENGTH];

        if let Err(e) = getrandom(&mut key) {
            // getrandom should never fail on supported platforms (Linux/macOS/Windows).
            // If it does, the system's entropy source is broken — the agent cannot
            // operate securely without cryptographic key material.
            // We panic here rather than return Result because ALL callers require a key,
            // and there is no safe degraded mode without encryption.
            panic!(
                "CRITICAL: Failed to generate cryptographic key via getrandom: {}. \
                 The system's CSPRNG is unavailable. Cannot start agent without secure key generation.",
                e
            );
        }

        debug!("Generated new encryption key using getrandom CSPRNG");
        key
    }

    /// Load a key from file.
    #[cfg(unix)]
    fn load_key(path: &Path) -> StorageResult<[u8; KEY_LENGTH]> {
        let data = fs::read(path).map_err(|e| {
            StorageError::KeyManagement(format!(
                "Failed to read key file {}: {}",
                path.display(),
                e
            ))
        })?;

        if data.len() != KEY_LENGTH {
            return Err(StorageError::KeyManagement(format!(
                "Invalid key file size: expected {} bytes, got {}",
                KEY_LENGTH,
                data.len()
            )));
        }

        let mut key = [0u8; KEY_LENGTH];
        key.copy_from_slice(&data);

        debug!("Loaded encryption key from: {}", path.display());
        Ok(key)
    }

    /// Load a key from file (Windows - DPAPI protected).
    #[cfg(windows)]
    fn load_key(path: &Path) -> StorageResult<[u8; KEY_LENGTH]> {
        use windows::Win32::Security::Cryptography::{CRYPT_INTEGER_BLOB, CryptUnprotectData};

        let encrypted_data = fs::read(path).map_err(|e| {
            StorageError::KeyManagement(format!(
                "Failed to read key file {}: {}",
                path.display(),
                e
            ))
        })?;

        let mut data_in = CRYPT_INTEGER_BLOB {
            cbData: encrypted_data.len() as u32,
            pbData: encrypted_data.as_ptr() as *mut u8,
        };

        let mut data_out = CRYPT_INTEGER_BLOB::default();

        // SAFETY: CryptUnprotectData is a Windows API that allocates output via LocalAlloc.
        // We must check for null pointers AND validate cbData before any copy,
        // then free the buffer with LocalFree regardless of success/failure.
        unsafe {
            CryptUnprotectData(
                &mut data_in,
                None, // description (optional)
                None, // entropy (optional)
                None, // reserved
                None, // prompt struct
                0,    // flags
                &mut data_out,
            )
            .map_err(|e| StorageError::KeyManagement(format!("DPAPI decryption failed: {}", e)))?;

            // Null pointer check before accessing decrypted data
            if data_out.pbData.is_null() {
                return Err(StorageError::KeyManagement(
                    "DPAPI decryption returned null pointer".to_string(),
                ));
            }

            // Bounds check: verify DPAPI returned exactly KEY_LENGTH bytes
            let decrypted_len = data_out.cbData as usize;
            if decrypted_len != KEY_LENGTH {
                // Free the allocated memory before returning error
                windows::Win32::Foundation::LocalFree(windows::Win32::Foundation::HLOCAL(
                    data_out.pbData as *mut _,
                ));
                return Err(StorageError::KeyManagement(format!(
                    "Invalid decrypted key size: expected {} bytes, got {}. Key file may be corrupted.",
                    KEY_LENGTH, decrypted_len
                )));
            }

            // Additional safety: ensure cbData doesn't exceed what we'll copy
            debug_assert!(
                decrypted_len <= KEY_LENGTH,
                "bounds check should have caught this"
            );

            let mut key = [0u8; KEY_LENGTH];
            std::ptr::copy_nonoverlapping(data_out.pbData, key.as_mut_ptr(), KEY_LENGTH);

            // Free the DPAPI-allocated memory
            windows::Win32::Foundation::LocalFree(windows::Win32::Foundation::HLOCAL(
                data_out.pbData as *mut _,
            ));

            debug!(
                "Loaded and decrypted key using DPAPI from: {}",
                path.display()
            );
            Ok(key)
        }
    }

    /// Store a key to file with secure permissions (Unix).
    #[cfg(unix)]
    fn store_key(path: &Path, key: &[u8; KEY_LENGTH]) -> StorageResult<()> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent()
            && !parent.exists()
        {
            fs::create_dir_all(parent).map_err(|e| {
                StorageError::KeyManagement(format!(
                    "Failed to create key directory {}: {}",
                    parent.display(),
                    e
                ))
            })?;
        }

        // Write the key
        fs::write(path, key).map_err(|e| {
            StorageError::KeyManagement(format!(
                "Failed to write key file {}: {}",
                path.display(),
                e
            ))
        })?;

        // Set restrictive permissions (0600 = owner read/write only)
        use std::os::unix::fs::PermissionsExt;
        let permissions = fs::Permissions::from_mode(0o600);
        fs::set_permissions(path, permissions).map_err(|e| {
            StorageError::KeyManagement(format!("Failed to set key file permissions: {}", e))
        })?;

        info!("Stored encryption key to: {} (mode 0600)", path.display());
        Ok(())
    }

    /// Store a key to file using DPAPI protection (Windows).
    #[cfg(windows)]
    fn store_key(path: &Path, key: &[u8; KEY_LENGTH]) -> StorageResult<()> {
        use windows::Win32::Security::Cryptography::{CRYPT_INTEGER_BLOB, CryptProtectData};

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| {
                    StorageError::KeyManagement(format!(
                        "Failed to create key directory {}: {}",
                        parent.display(),
                        e
                    ))
                })?;
            }
        }

        // Encrypt the key using DPAPI
        let mut data_in = CRYPT_INTEGER_BLOB {
            cbData: KEY_LENGTH as u32,
            pbData: key.as_ptr() as *mut u8,
        };

        let mut data_out = CRYPT_INTEGER_BLOB::default();

        unsafe {
            CryptProtectData(
                &mut data_in,
                None, // description (optional)
                None, // entropy (optional)
                None, // reserved
                None, // prompt struct
                0,    // flags
                &mut data_out,
            )
            .map_err(|e| StorageError::KeyManagement(format!("DPAPI encryption failed: {}", e)))?;

            // Null pointer check before accessing encrypted data
            if data_out.pbData.is_null() {
                return Err(StorageError::KeyManagement(
                    "DPAPI encryption returned null pointer".to_string(),
                ));
            }

            // Copy encrypted data to a Vec before freeing
            let encrypted =
                std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize).to_vec();

            // Free the allocated memory
            windows::Win32::Foundation::LocalFree(windows::Win32::Foundation::HLOCAL(
                data_out.pbData as *mut _,
            ));

            // Write encrypted data to file
            fs::write(path, &encrypted).map_err(|e| {
                StorageError::KeyManagement(format!(
                    "Failed to write key file {}: {}",
                    path.display(),
                    e
                ))
            })?;
        }

        info!(
            "Stored DPAPI-protected encryption key to: {}",
            path.display()
        );
        Ok(())
    }
}

/// Zeroize the key from memory on drop to prevent key leakage.
impl Drop for KeyManager {
    fn drop(&mut self) {
        // Volatile write to prevent the compiler from optimizing away the zeroization
        for byte in self.key.iter_mut() {
            unsafe {
                std::ptr::write_volatile(byte, 0);
            }
        }
    }
}

impl Default for KeyManager {
    fn default() -> Self {
        match Self::new() {
            Ok(km) => km,
            Err(e) => {
                panic!(
                    "CRITICAL: Failed to initialize KeyManager: {}. \
                     Cannot start agent without secure encryption key.",
                    e
                );
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_key_manager_test_key() {
        let km = KeyManager::new_with_test_key();
        let key = km.get_database_key().unwrap();
        assert_eq!(key.len(), KEY_LENGTH);
    }

    #[test]
    fn test_key_generation() {
        let key1 = KeyManager::generate_key();
        let key2 = KeyManager::generate_key();

        // Keys should be non-zero
        assert!(!key1.iter().all(|&b| b == 0));
        assert!(!key2.iter().all(|&b| b == 0));

        // Keys should be different (with high probability)
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_key_storage_and_loading() {
        let temp_dir = TempDir::new().unwrap();
        let key_path = temp_dir.path().join("test.key");

        let original_key = KeyManager::generate_key();

        // Store the key
        KeyManager::store_key(&key_path, &original_key).unwrap();

        // Verify file exists and has correct permissions
        assert!(key_path.exists());

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let metadata = fs::metadata(&key_path).unwrap();
            let mode = metadata.permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }

        // Load the key
        let loaded_key = KeyManager::load_key(&key_path).unwrap();

        assert_eq!(original_key, loaded_key);
    }

    #[test]
    fn test_invalid_key_file_size() {
        let temp_dir = TempDir::new().unwrap();
        let key_path = temp_dir.path().join("bad.key");

        // Write a key with wrong size
        fs::write(&key_path, b"too_short").unwrap();

        let result = KeyManager::load_key(&key_path);
        assert!(result.is_err());
    }
}
