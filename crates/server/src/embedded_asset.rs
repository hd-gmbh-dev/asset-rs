use std::sync::Arc;
use ars_package::Asset;
use axum::{http::HeaderValue, http::StatusCode, http::header, response::IntoResponse};
use bytes::Bytes;

use std::io::Write;
use flate2::write::GzEncoder;
use flate2::Compression;

fn gzip_encode_raw(base_raw: &[u8]) -> Vec<u8> {
    let mut e = GzEncoder::new(Vec::new(), Compression::default());
    e.write_all(base_raw).unwrap();
    let compressed_bytes = e.finish();
    compressed_bytes.unwrap()
}

#[derive(Clone)]
pub struct EmbeddedAsset {
    body: Bytes,
    mime: Arc<str>,
    status: u16,
    cache: bool,
}

impl EmbeddedAsset {
    pub fn new(asset: &Asset, cache: bool, target_url: &str, public_url: &str) -> anyhow::Result<Self> {
        let is_empty = target_url == "/";
        Ok(match asset.mime.as_ref() {
            "application/javascript" | "text/css" | "text/html; charset=utf-8" => {
                let body = if !is_empty {
                    let next_asset = std::str::from_utf8(asset.bytes.as_ref())?
                        .replace(target_url, public_url);
                        Bytes::from(gzip_encode_raw(next_asset.as_bytes()))
                } else {
                    Bytes::from(gzip_encode_raw(&asset.bytes))
                };
                Self {
                    body,
                    mime: asset.mime.clone(),
                    status: 200,
                    cache,
                }
            }
            _ => {
                let body = Bytes::from(gzip_encode_raw(&asset.bytes.as_ref()));
                Self {
                    body,
                    mime: asset.mime.clone(),
                    status: 200,
                    cache,
                }
            }
        })
    }

    pub fn json<T>(body: &T) -> anyhow::Result<Self> where T: serde::ser::Serialize {
        let t = serde_json::to_vec(body)?;
        let body = Bytes::from(gzip_encode_raw(&t));
        Ok(Self {
            status: 200,
            body,
            mime: Arc::from("application/json; charset=utf-8"),
            cache: true,
        })
    }

    pub fn not_found(body: Bytes, mime: Arc<str>) -> Self {
        Self {
            status: 404,
            body,
            mime,
            cache: false,
        }
    }
}

impl IntoResponse for EmbeddedAsset {
    fn into_response(self) -> axum::response::Response {
        let mut response = self.body.into_response();
        *response.status_mut() = StatusCode::from_u16(self.status).unwrap();
        if self.status == 200 {
            response.headers_mut().insert(
                header::CONTENT_ENCODING,
                HeaderValue::from_static("gzip"),
            );
        }
        if self.cache {
            response.headers_mut().insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=604800"),
            );
        } else {
            response.headers_mut().insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static(
                    "no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate",
                ),
            );
        }
        response.headers_mut().insert(
            header::CONTENT_TYPE,
            HeaderValue::from_bytes(self.mime.as_bytes()).unwrap(),
        );
        response
    }
}
