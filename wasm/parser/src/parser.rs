use std::collections::HashMap;
use std::path::Path;
use std::{path::PathBuf, sync::Arc};
use wasm_bindgen::prelude::*;

use crate::fs::{read_file_sync, write_file_sync, exists_sync};
use ars_package::{AssetPackage, WebComponent};
use ars_package::{deflate_encode_raw, Asset};

const WC_HELPER_JS: &'static str = include_str!("../../../helper/load.js");

#[derive(Default, serde::Deserialize)]
pub struct Manifest {
    name: String,
    version: String,
    target_url: String,
    assets: Vec<String>,
    web_components: HashMap<String, String>,
}

#[wasm_bindgen]
pub struct Parser {
    manifest: Manifest,
    base: PathBuf,
}

#[wasm_bindgen]
impl Parser {
    #[wasm_bindgen(constructor)]
    pub fn new(manifest_path: &str) -> Parser {
        let p = Path::new(manifest_path);
        let base = p.parent().unwrap().to_path_buf();

        Parser {
            manifest: serde_json::from_slice(&read_file_sync(manifest_path))
                .expect("unable to parse manifest"),
            base,
        }
    }

    pub fn parse(mut self) {
        let mut index = -1;
        let index_html_path = self.base.join("index.html");
        let index_html_path_str = index_html_path.to_str().unwrap();
        let mut assets = vec![];
        if exists_sync(index_html_path_str) {
            index = 0;
            assets.push(Arc::new(Asset { path: Arc::from("/"), mime: Arc::from(mime::TEXT_HTML_UTF_8.to_string()), bytes: Arc::from(read_file_sync(index_html_path_str)) }))
        }
        let favicon_path = self.base.join("favicon.ico");
        let favicon_path_str = favicon_path.to_str().unwrap();
        if exists_sync(favicon_path_str) {
            assets.push(Arc::new(Asset { path: Arc::from("favicon.ico"), mime: Arc::from("image/x-icon"), bytes: Arc::from(read_file_sync(favicon_path_str)) }))
        }
        while let Some(asset) = self.manifest.assets.pop() {
            let p = self.base.join(&asset);
            let file_name = p.to_str().unwrap();
            let content = read_file_sync(file_name);
            let mime = mime_guess::from_path(&p)
                .first_or_octet_stream()
                .to_string();
            assets.push(Arc::new(Asset {
                bytes: Arc::from(content),
                path: Arc::from(asset),
                mime: Arc::from(mime),
            }));
        }
        let created = js_sys::Date::new_0().get_time() as i64;
        let pkg = AssetPackage {
            name: Arc::from(self.manifest.name),
            version: Arc::from(self.manifest.version),
            target_url: Arc::from(self.manifest.target_url),
            assets: Arc::from(assets),
            created,
            updated: created,
            index,
            web_components: Arc::from(self.manifest.web_components.into_iter().map(|(k,v)| {
                WebComponent {
                    name: Arc::from(k),
                    path: Arc::from(v),
                }
            }).collect::<Vec<WebComponent>>())
        };
        let p = self.base.join(format!("{}.ars", pkg.name.as_ref()));
        let file_name = p.to_str().unwrap();
        let content = deflate_encode_raw(&ars_package::serialize(pkg));
        write_file_sync(file_name, &content);
    }

    pub fn wc_helper_js() -> String {
        WC_HELPER_JS.to_string()
    }
}
