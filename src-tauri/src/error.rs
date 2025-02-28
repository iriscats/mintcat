#[derive(Debug)]
pub enum IntegrationError {
    //#[snafu(display("unable to determine DRG installation at provided path {}", path.display()))]
    DrgInstallationNotFound {
        path: String,
    },
    //#[snafu(transparent)]
    IoError {
        source: std::io::Error,
    },
    //#[snafu(transparent)]
    RepakError {
        source: repak::Error,
    },
    //#[snafu(transparent)]
    UnrealAssetError {
        source: unreal_asset::Error,
    },
    //#[snafu(display("mod {:?}: I/O error encountered during its processing", mod_info.name))]
    CtxtIoError {
        source: std::io::Error,
        //mod_info: ModInfo,
    },
    //#[snafu(display("mod {:?}: repak error encountered during its processing", mod_info.name))]
    CtxtRepakError {
        source: repak::Error,
        //mod_info: ModInfo,
    },
    /*    #[snafu(display(
        "mod {:?}: modfile {} contains unexpected prefix",
        mod_info.name,
        modfile_path
    ))]*/
    ModfileInvalidPrefix {
        //mod_info: ModInfo,
        modfile_path: String,
    },
    /*    #[snafu(display(
        "mod {:?}: failed to integrate: {source}",
        mod_info.name,
    ))]*/
    CtxtGenericError {
        source: Box<dyn std::error::Error + Send + Sync>,
        //mod_info: ModInfo,
    },
    //#[snafu(transparent)]
    //ProviderError { source: ProviderError },
    //#[snafu(display("integration error: {msg}"))]
    GenericError {
        msg: String,
    },
    //#[snafu(transparent)]
    JoinError {
        source: tokio::task::JoinError,
    },
    //#[snafu(transparent)]
    //LintError { source: LintError },
    //#[snafu(display("self update failed: {source:?}"))]
    SelfUpdateFailed {
        source: Box<dyn std::error::Error + Send + Sync>,
    },
    MissingPakFile {
        //mod_info: ModInfo
    },
}
