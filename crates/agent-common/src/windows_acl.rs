// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Who may write the agent's files on Windows.
//!
//! The service runs as LocalSystem and reads from `%ProgramData%\Sentinel`
//! its configuration, its encryption key and database, and the rule
//! directories (`checks.d`, `sca.d`, `sigma.d`, `yara.d`), some of which make
//! it run programs. Whoever writes there controls what SYSTEM runs.
//!
//! * [`secure_data_dir`] gives that directory to SYSTEM and the
//!   Administrators group alone: owner Administrators, inheritance from
//!   `%ProgramData%` cut, one rule for each of the two, and every file and
//!   directory below brought back to inheriting it only. The installer runs
//!   it (`sentinel-agent secure-data-dir`) and the service on every start.
//! * [`untrusted`] is the Windows side of the rule the agent applies before
//!   it loads rules or runs a program: owned by SYSTEM, Administrators or
//!   TrustedInstaller, and writable by nobody else.

use std::ffi::{OsStr, c_void};
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};

use windows::Win32::Foundation::{
    CloseHandle, ERROR_ACCESS_DENIED, ERROR_SUCCESS, HANDLE, HLOCAL, LUID, LocalFree, WIN32_ERROR,
};
use windows::Win32::Security::Authorization::{
    ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW,
    GetNamedSecurityInfoW, SDDL_REVISION_1, SE_FILE_OBJECT, SetNamedSecurityInfoW,
};
use windows::Win32::Security::{
    ACCESS_ALLOWED_ACE, ACE_HEADER, ACL, AdjustTokenPrivileges, DACL_SECURITY_INFORMATION, GetAce,
    GetSecurityDescriptorDacl, GetSecurityDescriptorOwner, INHERIT_ONLY_ACE, LUID_AND_ATTRIBUTES,
    LookupAccountSidW, LookupPrivilegeValueW, OBJECT_SECURITY_INFORMATION,
    OWNER_SECURITY_INFORMATION, PROTECTED_DACL_SECURITY_INFORMATION, PSECURITY_DESCRIPTOR, PSID,
    SE_BACKUP_NAME, SE_PRIVILEGE_ENABLED, SE_RESTORE_NAME, SE_TAKE_OWNERSHIP_NAME, SID_NAME_USE,
    TOKEN_ADJUST_PRIVILEGES, TOKEN_PRIVILEGES, TOKEN_QUERY, UNPROTECTED_DACL_SECURITY_INFORMATION,
};
use windows::Win32::Storage::FileSystem::{
    BY_HANDLE_FILE_INFORMATION, CreateFileW, FILE_ATTRIBUTE_DIRECTORY,
    FILE_ATTRIBUTE_REPARSE_POINT, FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT,
    FILE_LIST_DIRECTORY, FILE_READ_ATTRIBUTES, FILE_SHARE_READ, FILE_SHARE_WRITE,
    GetFileInformationByHandle, OPEN_EXISTING,
};
use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
use windows::core::{PCWSTR, PWSTR};

/// `NT AUTHORITY\SYSTEM`, the service's account.
pub const SYSTEM_SID: &str = "S-1-5-18";
/// `BUILTIN\Administrators`.
pub const ADMINISTRATORS_SID: &str = "S-1-5-32-544";
/// `NT SERVICE\TrustedInstaller`, owner of the files Windows ships.
pub const TRUSTED_INSTALLER_SID: &str =
    "S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464";
/// `OWNER RIGHTS`: a rule for whoever owns the object, already checked.
const OWNER_RIGHTS_SID: &str = "S-1-3-4";
/// `CREATOR OWNER`: a placeholder for inheritance, in nobody's token.
const CREATOR_OWNER_SID: &str = "S-1-3-0";

/// Owners trusted by [`untrusted`].
const TRUSTED_OWNERS: [&str; 3] = [SYSTEM_SID, ADMINISTRATORS_SID, TRUSTED_INSTALLER_SID];

/// Directories of the data directory whose contents the agent loads as rules.
/// What is below them keeps its owner when the directory is secured: a file a
/// standard user wrote there while the directory was open to everyone stays
/// owned by that user, and so refused by [`untrusted`].
pub const RULE_DIRS: [&str; 4] = ["checks.d", "sca.d", "sigma.d", "yara.d"];

/// Rights that change a file's contents, its permissions or its owner, or
/// let a directory gain, lose or swap entries.
const WRITE_RIGHTS: u32 = 0x0002 // FILE_WRITE_DATA, FILE_ADD_FILE
    | 0x0004 // FILE_APPEND_DATA, FILE_ADD_SUBDIRECTORY
    | 0x0040 // FILE_DELETE_CHILD
    | 0x0001_0000 // DELETE
    | 0x0004_0000 // WRITE_DAC
    | 0x0008_0000 // WRITE_OWNER
    | 0x1000_0000 // GENERIC_ALL
    | 0x4000_0000; // GENERIC_WRITE

const ACCESS_ALLOWED_ACE_TYPE: u8 = 0;
const ACCESS_ALLOWED_OBJECT_ACE_TYPE: u8 = 5;
const ACCESS_ALLOWED_CALLBACK_ACE_TYPE: u8 = 9;
const ACCESS_ALLOWED_CALLBACK_OBJECT_ACE_TYPE: u8 = 11;

/// The data directory: owner Administrators, protected from inheritance,
/// full control for SYSTEM and Administrators, inherited by everything below.
const ROOT_SDDL: &str = "O:BAD:PAI(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)";
/// Everything below: no rule of its own, only what it inherits.
const CHILD_SDDL: &str = "D:AI";

/// `%ProgramData%\Sentinel`, where the installer puts the agent's data.
pub fn data_dir() -> PathBuf {
    std::env::var_os("ProgramData")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"))
        .join("Sentinel")
}

/// Why the agent may not load or run `path`, when it may not: its owner is
/// not SYSTEM, Administrators or TrustedInstaller, or someone else may write
/// it. Follows a symbolic link to its target, as opening the file would.
pub fn untrusted(path: &Path) -> Option<String> {
    let descriptor = match Descriptor::of(path) {
        Ok(descriptor) => descriptor,
        Err(e) => return Some(format!("cannot be checked: {e}")),
    };
    let owner = match descriptor.owner() {
        Ok(owner) => owner,
        Err(e) => return Some(format!("cannot be checked: {e}")),
    };
    if !TRUSTED_OWNERS.contains(&owner.as_str()) {
        return Some(format!(
            "is owned by {}, not by SYSTEM, Administrators or TrustedInstaller",
            describe(&owner)
        ));
    }
    match descriptor.writers() {
        Ok(writers) => writers
            .iter()
            .find(|sid| !trusted_writer(sid))
            .map(|sid| format!("is writable by {}", describe(sid))),
        Err(reason) => Some(reason),
    }
}

fn trusted_writer(sid: &str) -> bool {
    TRUSTED_OWNERS.contains(&sid) || sid == OWNER_RIGHTS_SID || sid == CREATOR_OWNER_SID
}

/// What [`secure_data_dir`] did.
#[derive(Debug, Default)]
pub struct SecureReport {
    /// Files and directories below the root given its rules.
    pub secured: usize,
    /// Symbolic links and junctions found below, neither followed nor changed.
    pub links: Vec<PathBuf>,
    /// Entries that could not be secured, with the reason.
    pub errors: Vec<String>,
}

/// Give `root` and everything below it to SYSTEM and the Administrators
/// group alone (see the module documentation).
///
/// Needs SYSTEM or an elevated administrator. Fails when the root itself
/// cannot be secured, in particular when it is a link or a junction; an entry
/// below that cannot be secured is reported and the walk goes on. Links below
/// the root are reported and left alone: the agent never creates any.
pub fn secure_data_dir(root: &Path) -> Result<SecureReport, String> {
    let _privileges =
        Privileges::enable(&[SE_TAKE_OWNERSHIP_NAME, SE_RESTORE_NAME, SE_BACKUP_NAME]);
    // Held open without delete sharing until the end, so the directory
    // checked here is the one secured and walked: nobody can rename it and
    // put a junction in its place.
    let pinned = PinnedDir::open(root)?;

    let root_rules = Descriptor::from_sddl(ROOT_SDDL)?;
    let child_rules = Descriptor::from_sddl(CHILD_SDDL)?;
    let administrators = root_rules.owner_sid()?;
    set_security(
        root,
        OWNER_SECURITY_INFORMATION
            | DACL_SECURITY_INFORMATION
            | PROTECTED_DACL_SECURITY_INFORMATION,
        Some(administrators),
        root_rules.dacl()?,
    )
    .map_err(|e| format!("cannot secure {}: {e}", root.display()))?;

    let mut report = SecureReport::default();
    let walk = Walk {
        administrators,
        dacl: child_rules.dacl()?,
    };
    // Top-down: a directory is closed before its entries are listed, so no
    // entry can be swapped for a link between its check and its change.
    walk.children(root, true, false, &mut report);
    drop(pinned);
    Ok(report)
}

struct Walk {
    administrators: PSID,
    dacl: *const ACL,
}

impl Walk {
    fn children(&self, dir: &Path, at_root: bool, below_rules: bool, report: &mut SecureReport) {
        let entries = match std::fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(e) => {
                report.errors.push(format!("{}: {e}", dir.display()));
                return;
            }
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let metadata = match std::fs::symlink_metadata(&path) {
                Ok(metadata) => metadata,
                Err(e) => {
                    report.errors.push(format!("{}: {e}", path.display()));
                    continue;
                }
            };
            // Symbolic links and junctions: following one would change
            // whatever it points to.
            if metadata.file_type().is_symlink() {
                report.links.push(path);
                continue;
            }
            match self.secure(&path, below_rules) {
                Ok(()) => report.secured += 1,
                Err(e) => report.errors.push(format!("{}: {e}", path.display())),
            }
            if metadata.is_dir() {
                let rules = below_rules
                    || (at_root
                        && entry
                            .file_name()
                            .to_str()
                            .is_some_and(|name| RULE_DIRS.contains(&name)));
                self.children(&path, false, rules, report);
            }
        }
    }

    /// Drop the entry's own rules so it inherits the root's only, and make
    /// Administrators its owner unless it lies below a rule directory.
    fn secure(&self, path: &Path, keep_owner: bool) -> Result<(), String> {
        let reset = DACL_SECURITY_INFORMATION | UNPROTECTED_DACL_SECURITY_INFORMATION;
        if keep_owner {
            return set_security(path, reset, None, self.dacl);
        }
        match set_security(
            path,
            OWNER_SECURITY_INFORMATION | reset,
            Some(self.administrators),
            self.dacl,
        ) {
            // An owner whose rules shut administrators out: take ownership
            // first, the owner may then rewrite the rules.
            Err(_) => {
                set_security(
                    path,
                    OWNER_SECURITY_INFORMATION,
                    Some(self.administrators),
                    std::ptr::null(),
                )?;
                set_security(path, reset, None, self.dacl)
            }
            Ok(()) => Ok(()),
        }
    }
}

fn set_security(
    path: &Path,
    information: OBJECT_SECURITY_INFORMATION,
    owner: Option<PSID>,
    dacl: *const ACL,
) -> Result<(), String> {
    let name = wide(path.as_os_str());
    let dacl = (!dacl.is_null()).then_some(dacl);
    // SAFETY: `name` is NUL-terminated; the SID and ACL point into security
    // descriptors that outlive the call.
    let status = unsafe {
        SetNamedSecurityInfoW(
            PCWSTR(name.as_ptr()),
            SE_FILE_OBJECT,
            information,
            owner,
            None,
            dacl,
            None,
        )
    };
    win32(status)
}

fn win32(status: WIN32_ERROR) -> Result<(), String> {
    if status == ERROR_SUCCESS {
        Ok(())
    } else if status == ERROR_ACCESS_DENIED {
        Err("access denied".to_string())
    } else {
        Err(std::io::Error::from_raw_os_error(status.0 as i32).to_string())
    }
}

fn wide(text: &OsStr) -> Vec<u16> {
    text.encode_wide().chain(std::iter::once(0)).collect()
}

/// A security descriptor allocated by Windows, freed on drop.
struct Descriptor(PSECURITY_DESCRIPTOR);

impl Descriptor {
    /// The owner and access rules of a file or directory.
    fn of(path: &Path) -> Result<Self, String> {
        let name = wide(path.as_os_str());
        let mut descriptor = PSECURITY_DESCRIPTOR::default();
        // SAFETY: `name` is NUL-terminated; Windows allocates the descriptor,
        // freed by `Drop`.
        let status = unsafe {
            GetNamedSecurityInfoW(
                PCWSTR(name.as_ptr()),
                SE_FILE_OBJECT,
                OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
                None,
                None,
                None,
                None,
                &mut descriptor,
            )
        };
        win32(status)?;
        Ok(Self(descriptor))
    }

    fn from_sddl(sddl: &str) -> Result<Self, String> {
        let text = wide(OsStr::new(sddl));
        let mut descriptor = PSECURITY_DESCRIPTOR::default();
        // SAFETY: `text` is NUL-terminated; the descriptor is freed by `Drop`.
        unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                PCWSTR(text.as_ptr()),
                SDDL_REVISION_1,
                &mut descriptor,
                None,
            )
        }
        .map_err(|e| format!("invalid security descriptor {sddl}: {e}"))?;
        Ok(Self(descriptor))
    }

    fn owner_sid(&self) -> Result<PSID, String> {
        let mut owner = PSID::default();
        let mut defaulted = windows::core::BOOL::default();
        // SAFETY: the descriptor is valid while `self` lives.
        unsafe { GetSecurityDescriptorOwner(self.0, &mut owner, &mut defaulted) }
            .map_err(|e| e.to_string())?;
        if owner.is_invalid() {
            return Err("no owner".to_string());
        }
        Ok(owner)
    }

    fn owner(&self) -> Result<String, String> {
        sid_string(self.owner_sid()?)
    }

    /// The access rules; null for a null DACL, which lets everyone in.
    fn dacl(&self) -> Result<*const ACL, String> {
        let mut present = windows::core::BOOL::default();
        let mut dacl: *mut ACL = std::ptr::null_mut();
        let mut defaulted = windows::core::BOOL::default();
        // SAFETY: the descriptor is valid while `self` lives.
        unsafe { GetSecurityDescriptorDacl(self.0, &mut present, &mut dacl, &mut defaulted) }
            .map_err(|e| e.to_string())?;
        Ok(if present.as_bool() {
            dacl
        } else {
            std::ptr::null_mut()
        })
    }

    /// Every SID an access rule lets write the object itself (rules that
    /// only pass to children are left out).
    fn writers(&self) -> Result<Vec<String>, String> {
        let dacl = self.dacl()?;
        if dacl.is_null() {
            return Err("has no access rules: everyone may write it".to_string());
        }
        let mut writers = Vec::new();
        // SAFETY: `dacl` points into the descriptor; `GetAce` bounds the index.
        let count = unsafe { (*dacl).AceCount };
        for index in 0..u32::from(count) {
            let mut ace: *mut c_void = std::ptr::null_mut();
            // SAFETY: as above.
            unsafe { GetAce(dacl, index, &mut ace) }.map_err(|e| e.to_string())?;
            // SAFETY: every ACE starts with a header.
            let header = unsafe { *(ace as *const ACE_HEADER) };
            if header.AceFlags & INHERIT_ONLY_ACE.0 as u8 != 0 {
                continue;
            }
            match header.AceType {
                ACCESS_ALLOWED_ACE_TYPE | ACCESS_ALLOWED_CALLBACK_ACE_TYPE => {
                    // SAFETY: both types share the layout header, mask, SID.
                    let allowed = unsafe { &*(ace as *const ACCESS_ALLOWED_ACE) };
                    if allowed.Mask & WRITE_RIGHTS != 0 {
                        let sid = PSID(&allowed.SidStart as *const u32 as *mut c_void);
                        writers.push(sid_string(sid)?);
                    }
                }
                ACCESS_ALLOWED_OBJECT_ACE_TYPE | ACCESS_ALLOWED_CALLBACK_OBJECT_ACE_TYPE => {
                    // SAFETY: the mask follows the header in every ACE.
                    let mask = unsafe { (*(ace as *const ACCESS_ALLOWED_ACE)).Mask };
                    if mask & WRITE_RIGHTS != 0 {
                        return Err("is writable through an object access rule".to_string());
                    }
                }
                // Denials only take rights away; audit and label entries
                // grant none.
                _ => {}
            }
        }
        Ok(writers)
    }
}

impl Drop for Descriptor {
    fn drop(&mut self) {
        if !self.0.is_invalid() {
            // SAFETY: allocated by Windows with LocalAlloc, freed once.
            unsafe { LocalFree(Some(HLOCAL(self.0.0))) };
        }
    }
}

fn sid_string(sid: PSID) -> Result<String, String> {
    let mut text = PWSTR::null();
    // SAFETY: `sid` is a valid SID; Windows allocates `text`, freed below.
    unsafe { ConvertSidToStringSidW(sid, &mut text) }.map_err(|e| e.to_string())?;
    // SAFETY: `text` is a NUL-terminated string allocated by Windows.
    let converted = unsafe { text.to_string() }.map_err(|e| e.to_string());
    // SAFETY: allocated with LocalAlloc, freed once.
    unsafe { LocalFree(Some(HLOCAL(text.0 as *mut c_void))) };
    converted
}

/// `BUILTIN\Users (S-1-5-32-545)`, or the SID alone when it has no name.
fn describe(sid: &str) -> String {
    match account_name(sid) {
        Some(name) => format!("{name} ({sid})"),
        None => sid.to_string(),
    }
}

fn account_name(sid: &str) -> Option<String> {
    let text = wide(OsStr::new(sid));
    let mut binary = PSID::default();
    // SAFETY: `text` is NUL-terminated; the SID is freed below.
    unsafe {
        windows::Win32::Security::Authorization::ConvertStringSidToSidW(
            PCWSTR(text.as_ptr()),
            &mut binary,
        )
    }
    .ok()?;
    let mut name = [0u16; 256];
    let mut domain = [0u16; 256];
    let mut name_len = name.len() as u32;
    let mut domain_len = domain.len() as u32;
    let mut kind = SID_NAME_USE::default();
    // SAFETY: the buffers and their lengths match.
    let found = unsafe {
        LookupAccountSidW(
            PCWSTR::null(),
            binary,
            Some(PWSTR(name.as_mut_ptr())),
            &mut name_len,
            Some(PWSTR(domain.as_mut_ptr())),
            &mut domain_len,
            &mut kind,
        )
    };
    // SAFETY: allocated with LocalAlloc, freed once.
    unsafe { LocalFree(Some(HLOCAL(binary.0))) };
    found.ok()?;
    let name = String::from_utf16_lossy(&name[..name_len as usize]);
    let domain = String::from_utf16_lossy(&domain[..domain_len as usize]);
    Some(if domain.is_empty() {
        name
    } else {
        format!("{domain}\\{name}")
    })
}

/// A directory held open, the directory itself and not what a link would
/// point to, without delete sharing so it can be neither renamed nor removed.
struct PinnedDir(HANDLE);

impl PinnedDir {
    fn open(path: &Path) -> Result<Self, String> {
        let name = wide(path.as_os_str());
        // SAFETY: `name` is NUL-terminated; the handle is closed by `Drop`.
        let handle = unsafe {
            CreateFileW(
                PCWSTR(name.as_ptr()),
                // Listing counts as reading: only an open that reads, writes
                // or deletes makes its sharing mode binding on later ones.
                // Backup semantics grant it whatever the current rules say.
                FILE_LIST_DIRECTORY.0 | FILE_READ_ATTRIBUTES.0,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                None,
                OPEN_EXISTING,
                FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
                None,
            )
        }
        .map_err(|e| format!("cannot open {}: {e}", path.display()))?;
        let pinned = Self(handle);
        let mut information = BY_HANDLE_FILE_INFORMATION::default();
        // SAFETY: the handle is open.
        unsafe { GetFileInformationByHandle(pinned.0, &mut information) }
            .map_err(|e| format!("cannot read {}: {e}", path.display()))?;
        if information.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT.0 != 0 {
            return Err(format!(
                "{} is a link or a junction, not a directory: left alone",
                path.display()
            ));
        }
        if information.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY.0 == 0 {
            return Err(format!("{} is not a directory", path.display()));
        }
        Ok(pinned)
    }
}

impl Drop for PinnedDir {
    fn drop(&mut self) {
        // SAFETY: opened by `open`, closed once.
        let _ = unsafe { CloseHandle(self.0) };
    }
}

/// Privileges enabled for the duration of the work, as they were before
/// once dropped: taking ownership, and setting any owner and rules whatever
/// the current rules say.
struct Privileges {
    token: HANDLE,
    previous: Vec<TOKEN_PRIVILEGES>,
}

impl Privileges {
    fn enable(names: &[PCWSTR]) -> Option<Self> {
        let mut token = HANDLE::default();
        // SAFETY: the pseudo-handle of the current process needs no closing.
        unsafe {
            OpenProcessToken(
                GetCurrentProcess(),
                TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY,
                &mut token,
            )
        }
        .ok()?;
        let mut previous = Vec::new();
        for name in names {
            let mut luid = LUID::default();
            // SAFETY: `name` is a static NUL-terminated string.
            if unsafe { LookupPrivilegeValueW(PCWSTR::null(), *name, &mut luid) }.is_err() {
                continue;
            }
            let wanted = TOKEN_PRIVILEGES {
                PrivilegeCount: 1,
                Privileges: [LUID_AND_ATTRIBUTES {
                    Luid: luid,
                    Attributes: SE_PRIVILEGE_ENABLED,
                }],
            };
            let mut before = TOKEN_PRIVILEGES::default();
            let mut length = 0u32;
            // SAFETY: both structures hold one privilege, as declared.
            let adjusted = unsafe {
                AdjustTokenPrivileges(
                    token,
                    false,
                    Some(&wanted as *const TOKEN_PRIVILEGES),
                    std::mem::size_of::<TOKEN_PRIVILEGES>() as u32,
                    Some(&mut before as *mut TOKEN_PRIVILEGES),
                    Some(&mut length as *mut u32),
                )
            };
            if adjusted.is_ok() {
                previous.push(before);
            }
        }
        Some(Self { token, previous })
    }
}

impl Drop for Privileges {
    fn drop(&mut self) {
        for before in self.previous.iter().rev() {
            if before.PrivilegeCount > 0 {
                // SAFETY: `before` was filled by AdjustTokenPrivileges.
                let _ = unsafe {
                    AdjustTokenPrivileges(
                        self.token,
                        false,
                        Some(before as *const TOKEN_PRIVILEGES),
                        0,
                        None,
                        None,
                    )
                };
            }
        }
        // SAFETY: opened by `enable`, closed once.
        let _ = unsafe { CloseHandle(self.token) };
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::Win32::Security::Authorization::ConvertSecurityDescriptorToStringSecurityDescriptorW;
    use windows::Win32::Security::{GetTokenInformation, TOKEN_ELEVATION, TokenElevation};

    const USERS_SID: &str = "S-1-5-32-545";
    /// Read, write, execute and delete: what `icacls (M)` grants.
    const MODIFY: &str = "0x1301bf";

    /// Securing needs an elevated administrator, as on the CI runner.
    fn elevated() -> bool {
        let mut token = HANDLE::default();
        // SAFETY: as in `Privileges::enable`.
        if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) }.is_err() {
            return false;
        }
        let mut elevation = TOKEN_ELEVATION::default();
        let mut length = 0u32;
        // SAFETY: the buffer is a TOKEN_ELEVATION, as declared.
        let read = unsafe {
            GetTokenInformation(
                token,
                TokenElevation,
                Some(&mut elevation as *mut _ as *mut c_void),
                std::mem::size_of::<TOKEN_ELEVATION>() as u32,
                &mut length,
            )
        };
        // SAFETY: opened above.
        let _ = unsafe { CloseHandle(token) };
        let elevated = read.is_ok() && elevation.TokenIsElevated != 0;
        if !elevated {
            eprintln!("skipped: needs an elevated administrator");
        }
        elevated
    }

    /// Apply the parts of `sddl` named by `information` to `path`.
    fn apply(path: &Path, information: OBJECT_SECURITY_INFORMATION, sddl: &str) {
        let _privileges = Privileges::enable(&[SE_TAKE_OWNERSHIP_NAME, SE_RESTORE_NAME]);
        let rules = Descriptor::from_sddl(sddl).unwrap();
        let owner = if information.0 & OWNER_SECURITY_INFORMATION.0 != 0 {
            Some(rules.owner_sid().unwrap())
        } else {
            None
        };
        let dacl = if information.0 & DACL_SECURITY_INFORMATION.0 != 0 {
            rules.dacl().unwrap()
        } else {
            std::ptr::null()
        };
        set_security(path, information, owner, dacl).unwrap();
    }

    /// The legacy installer's grant: Users may modify, on the object and
    /// everything created below it, next to what it inherits.
    fn grant_users_modify(path: &Path) {
        apply(
            path,
            DACL_SECURITY_INFORMATION | UNPROTECTED_DACL_SECURITY_INFORMATION,
            &format!("D:AI(A;OICI;{MODIFY};;;BU)"),
        );
    }

    fn sddl_of(path: &Path) -> String {
        let descriptor = Descriptor::of(path).unwrap();
        let mut text = PWSTR::null();
        // SAFETY: valid descriptor; `text` is freed below.
        unsafe {
            ConvertSecurityDescriptorToStringSecurityDescriptorW(
                descriptor.0,
                SDDL_REVISION_1,
                OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
                &mut text,
                None,
            )
        }
        .unwrap();
        // SAFETY: NUL-terminated, allocated by Windows.
        let sddl = unsafe { text.to_string() }.unwrap();
        // SAFETY: allocated with LocalAlloc, freed once.
        unsafe { LocalFree(Some(HLOCAL(text.0 as *mut c_void))) };
        sddl
    }

    fn owner_of(path: &Path) -> String {
        Descriptor::of(path).unwrap().owner().unwrap()
    }

    /// Whether `path` carries a rule of its own (not inherited) for `sid`.
    fn has_own_rule_for(path: &Path, sid: &str) -> bool {
        let descriptor = Descriptor::of(path).unwrap();
        let dacl = descriptor.dacl().unwrap();
        // SAFETY: as in `Descriptor::writers`.
        let count = unsafe { (*dacl).AceCount };
        (0..u32::from(count)).any(|index| {
            let mut ace: *mut c_void = std::ptr::null_mut();
            // SAFETY: as in `Descriptor::writers`.
            unsafe { GetAce(dacl, index, &mut ace) }.unwrap();
            // SAFETY: as in `Descriptor::writers`.
            let allowed = unsafe { &*(ace as *const ACCESS_ALLOWED_ACE) };
            const INHERITED_ACE: u8 = 0x10;
            allowed.Header.AceFlags & INHERITED_ACE == 0
                && sid_string(PSID(&allowed.SidStart as *const u32 as *mut c_void)).unwrap() == sid
        })
    }

    /// `link` and `target` with `\` only: `cmd` reads a `/` as a switch.
    fn mklink_junction(link: &Path, target: &Path) {
        let output = std::process::Command::new("cmd")
            .args(["/C", "mklink", "/J"])
            .arg(link)
            .arg(target)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "mklink /J failed: {}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
    }

    #[test]
    fn a_program_shipped_with_windows_is_trusted() {
        let windir = std::env::var_os("SystemRoot").unwrap_or_else(|| r"C:\Windows".into());
        let cmd = PathBuf::from(windir).join("System32").join("cmd.exe");
        assert_eq!(untrusted(&cmd), None);
    }

    #[test]
    fn the_legacy_grant_to_users_is_removed_everywhere() {
        if !elevated() {
            return;
        }
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("Sentinel");
        for dir in ["data", "logs", "checks.d", "cache/llm"] {
            std::fs::create_dir_all(root.join(dir)).unwrap();
        }
        for file in [
            "agent.json",
            "data/key.dpapi",
            "logs/agent.log",
            "checks.d/a.toml",
        ] {
            std::fs::write(root.join(file), "x").unwrap();
        }
        // What `icacls /grant *S-1-5-32-545:(OI)(CI)(M) /T` left behind:
        // the grant on every object, not only inherited.
        grant_users_modify(&root);
        for path in [
            "data",
            "logs",
            "checks.d",
            "cache",
            "cache/llm",
            "agent.json",
            "data/key.dpapi",
        ] {
            grant_users_modify(&root.join(path));
        }
        // Rule files keep their owner: make it one the check trusts.
        apply(
            &root.join("checks.d/a.toml"),
            OWNER_SECURITY_INFORMATION,
            "O:BA",
        );
        assert!(untrusted(&root.join("agent.json")).is_some());

        let report = secure_data_dir(&root).unwrap();

        assert!(report.errors.is_empty(), "{:?}", report.errors);
        assert!(report.links.is_empty());
        assert_eq!(report.secured, 9);
        assert!(sddl_of(&root).contains("D:PAI"), "{}", sddl_of(&root));
        for path in [
            "",
            "data",
            "logs",
            "checks.d",
            "cache",
            "cache/llm",
            "agent.json",
            "data/key.dpapi",
            "logs/agent.log",
            "checks.d/a.toml",
        ] {
            let path = root.join(path);
            assert!(!has_own_rule_for(&path, USERS_SID), "{}", path.display());
            assert_eq!(untrusted(&path), None, "{}", path.display());
            let sddl = sddl_of(&path);
            assert!(!sddl.contains(";BU)"), "{}: {sddl}", path.display());
            assert!(!sddl.contains(";AU)"), "{}: {sddl}", path.display());
        }
        assert_eq!(owner_of(&root), ADMINISTRATORS_SID);
        assert_eq!(owner_of(&root.join("data/key.dpapi")), ADMINISTRATORS_SID);
    }

    #[test]
    fn files_below_a_rule_directory_keep_their_owner() {
        if !elevated() {
            return;
        }
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("Sentinel");
        std::fs::create_dir_all(root.join("checks.d/sub")).unwrap();
        std::fs::create_dir_all(root.join("data")).unwrap();
        for file in [
            "checks.d/planted.toml",
            "checks.d/sub/deep.toml",
            "data/agent.db",
        ] {
            let path = root.join(file);
            std::fs::write(&path, "x").unwrap();
            apply(&path, OWNER_SECURITY_INFORMATION, "O:BU");
        }
        apply(&root.join("checks.d"), OWNER_SECURITY_INFORMATION, "O:BU");

        let report = secure_data_dir(&root).unwrap();

        assert!(report.errors.is_empty(), "{:?}", report.errors);
        // The rule directory and the data are the administrators' ...
        assert_eq!(owner_of(&root.join("checks.d")), ADMINISTRATORS_SID);
        assert_eq!(owner_of(&root.join("data/agent.db")), ADMINISTRATORS_SID);
        // ... what a user put in the rules stays theirs, and refused.
        for file in ["checks.d/planted.toml", "checks.d/sub/deep.toml"] {
            let path = root.join(file);
            assert_eq!(owner_of(&path), USERS_SID);
            let reason = untrusted(&path).unwrap();
            assert!(reason.starts_with("is owned by"), "{reason}");
            assert!(reason.contains(USERS_SID), "{reason}");
        }
    }

    #[test]
    fn links_inside_are_neither_followed_nor_changed() {
        if !elevated() {
            return;
        }
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("Sentinel");
        let outside = temp.path().join("outside");
        std::fs::create_dir_all(root.join("cache")).unwrap();
        std::fs::create_dir_all(outside.join("inner")).unwrap();
        std::fs::write(outside.join("inner/file"), "x").unwrap();
        grant_users_modify(&outside);
        let before = [
            sddl_of(&outside),
            sddl_of(&outside.join("inner")),
            sddl_of(&outside.join("inner/file")),
        ];
        mklink_junction(&root.join("cache").join("link"), &outside);

        let report = secure_data_dir(&root).unwrap();

        assert_eq!(report.links, vec![root.join("cache").join("link")]);
        let after = [
            sddl_of(&outside),
            sddl_of(&outside.join("inner")),
            sddl_of(&outside.join("inner/file")),
        ];
        assert_eq!(before, after);
    }

    #[test]
    fn a_root_that_is_a_junction_is_refused() {
        if !elevated() {
            return;
        }
        let temp = tempfile::tempdir().unwrap();
        let target = temp.path().join("target");
        std::fs::create_dir_all(&target).unwrap();
        let before = sddl_of(&target);
        let root = temp.path().join("Sentinel");
        mklink_junction(&root, &target);

        let error = secure_data_dir(&root).unwrap_err();

        assert!(error.contains("junction"), "{error}");
        assert_eq!(sddl_of(&target), before);
    }

    #[test]
    fn writers_and_owners_outside_the_trusted_three_are_refused() {
        if !elevated() {
            return;
        }
        let temp = tempfile::tempdir().unwrap();
        let file = temp.path().join("program.exe");
        std::fs::write(&file, "x").unwrap();
        let protected = "D:P(A;;FA;;;SY)(A;;FA;;;BA)";

        apply(
            &file,
            OWNER_SECURITY_INFORMATION
                | DACL_SECURITY_INFORMATION
                | PROTECTED_DACL_SECURITY_INFORMATION,
            &format!("O:BA{protected}"),
        );
        assert_eq!(untrusted(&file), None);

        apply(
            &file,
            DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
            &format!("{protected}(A;;{MODIFY};;;BU)"),
        );
        let reason = untrusted(&file).unwrap();
        assert!(reason.starts_with("is writable by"), "{reason}");
        assert!(reason.contains(USERS_SID), "{reason}");

        // Reading and running is fine.
        apply(
            &file,
            DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
            &format!("{protected}(A;;FRFX;;;BU)"),
        );
        assert_eq!(untrusted(&file), None);

        apply(&file, OWNER_SECURITY_INFORMATION, "O:BU");
        assert!(untrusted(&file).unwrap().starts_with("is owned by"));

        apply(&file, OWNER_SECURITY_INFORMATION, "O:SY");
        assert_eq!(untrusted(&file), None);

        // No DACL at all lets everyone in.
        apply(
            &file,
            DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
            "D:PNO_ACCESS_CONTROL",
        );
        assert!(untrusted(&file).unwrap().contains("everyone"));
    }

    #[test]
    fn a_rule_for_children_only_does_not_make_a_directory_writable() {
        if !elevated() {
            return;
        }
        let temp = tempfile::tempdir().unwrap();
        let dir = temp.path().join("rules");
        std::fs::create_dir_all(&dir).unwrap();
        apply(
            &dir,
            OWNER_SECURITY_INFORMATION
                | DACL_SECURITY_INFORMATION
                | PROTECTED_DACL_SECURITY_INFORMATION,
            "O:BAD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICIIO;FA;;;BU)",
        );
        assert_eq!(untrusted(&dir), None);

        // A file created inside inherits that rule, and is refused.
        let file = dir.join("rule.yml");
        std::fs::write(&file, "x").unwrap();
        apply(&file, OWNER_SECURITY_INFORMATION, "O:BA");
        assert!(untrusted(&file).unwrap().starts_with("is writable by"));
    }
}
