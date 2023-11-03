use std::{sync::Arc, path::{PathBuf, Path}};

#[derive(Clone, serde::Deserialize, Debug)]
pub struct SrvConfig<const P: u16> {
    host: Option<Arc<str>>,
    port: Option<u16>,
    address: Option<Arc<str>>,
    public_url: Option<Arc<str>>,
    asset_package: PathBuf,
}

impl<const P: u16> SrvConfig<P> {
    pub fn from_env(prefix: &str) -> envy::Result<Self> {
        let mut cfg = envy::prefixed(prefix).from_env::<SrvConfig<P>>()?;
        if cfg.address.is_none() {
            let host = cfg.host.as_deref().unwrap_or("0.0.0.0");
            let port = cfg.port.unwrap_or(P);
            let address = format!("{}:{}", host, port);
            cfg.address = Some(Arc::from(address));
        }

        if cfg.public_url.is_none() {
            cfg.public_url = Some(Arc::from(format!("http://{}", cfg.address.as_deref().unwrap())));
        }

        Ok(cfg)
    }

    pub fn address(&self) -> &str {
        self.address.as_deref().unwrap()
    }

    pub fn public_url(&self) -> &str {
        self.public_url.as_deref().unwrap()
    }

    pub fn asset_package(&self) -> &Path {
        self.asset_package.as_ref()
    }
}

#[derive(Clone, serde::Deserialize, serde::Serialize, Debug)]
#[serde(rename_all="camelCase")]
pub struct KeycloakConfig {
    pub keycloak_url: Option<Arc<str>>,
    pub keycloak_client_id: Option<Arc<str>>,
    pub keycloak_realm: Option<Arc<str>>,
}
