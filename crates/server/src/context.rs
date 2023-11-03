use std::sync::Arc;
use ahash::AHashMap;
use ars_package::Asset;
use bytes::Bytes;

use crate::embedded_asset::EmbeddedAsset;
use crate::config::SrvConfig;

struct EmbeddedAssetMap {
    inner: AHashMap<Arc<str>, EmbeddedAsset>,
}

impl EmbeddedAssetMap {
    pub fn new(assets: &[Arc<Asset>], target_url: &str, public_url: &str, index: usize) -> anyhow::Result<Self> {
        let mut inner = AHashMap::default();
        for (idx, asset) in assets.iter().enumerate() {
            if idx != index {
                inner.insert(asset.path.clone(), EmbeddedAsset::new(asset, true, target_url, public_url)?);
            }
        }
        Ok(Self {
            inner,
        })
    }
}

pub type ServerConfig = SrvConfig<8000>;
pub struct AssetStore {
    not_found: Bytes,
    not_found_mime: Arc<str>,
    assets: Arc<EmbeddedAssetMap>,
    index: EmbeddedAsset,
}

impl AssetStore {
    pub fn new(cfg: &ServerConfig) -> anyhow::Result<Self> {
        let pkg_encoded = std::fs::read(cfg.asset_package())?;
        let pkg = ars_package::deflate_decode_raw(&pkg_encoded);
        let asset_package = ars_package::deserialize(&pkg)?;
        let index = asset_package.assets.get(asset_package.index as usize)
            .ok_or(anyhow::anyhow!("unable to find index.html"))?;

        let target_url = &asset_package.target_url;
        let public_url = cfg.public_url();
        let index = EmbeddedAsset::new(&index, false, target_url, public_url)?;
        let assets = Arc::new(EmbeddedAssetMap::new(asset_package.assets.as_ref(), target_url, public_url, asset_package.index as usize)?);

        Ok(Self {
            not_found_mime: Arc::from("text/plain"),
            not_found: Bytes::from_static(b"not found"),
            assets,
            index,
        })
    }

    pub fn get(&self, id: &str) -> EmbeddedAsset {
        self.assets
            .inner
            .get(id)
            .cloned()
            .unwrap_or_else(|| EmbeddedAsset::not_found(self.not_found.clone(), self.not_found_mime.clone()))
    }

    pub fn index(&self) -> EmbeddedAsset {
        self.index.clone()
    }
}

struct Inner {
    config: ServerConfig,
    store: AssetStore,    
}

#[derive(Clone)]
pub struct App {
    inner: Arc<Inner>,
}

impl App {
    pub fn new() -> anyhow::Result<Self> {
        let config = ServerConfig::from_env("SERVER_")?;
        Ok(Self {
            inner: Arc::new(Inner {
                store: AssetStore::new(&config)?,
                config,
            })
        })
    }

    pub fn cfg(&self) -> &ServerConfig {
        &self.inner.config
    }

    pub fn store(&self) -> &AssetStore {
        &self.inner.store
    }
}
