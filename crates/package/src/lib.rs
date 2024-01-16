use flate2::write::DeflateEncoder;
use flate2::bufread::DeflateDecoder;
use std::io::Read;
use flate2::Compression;
use rkyv::ser::serializers::AllocSerializer;
use rkyv::{ser::Serializer, AlignedVec, Archive, Deserialize, Serialize};
use std::io::Write;
use std::sync::Arc;

#[derive(thiserror::Error, Debug)]
pub enum DeserializeError {
    #[error("rykv deserialization error {0:?}")]
    SharedDeserializeMapError(#[from] rkyv::de::deserializers::SharedDeserializeMapError),
    #[error("decode error {0:?}")]
    CheckTypeError(#[from] rkyv::validation::validators::DefaultValidatorError),
}

#[derive(Archive, Debug, Deserialize, Serialize, PartialEq, PartialOrd)]
#[archive(check_bytes)]
#[archive_attr(derive(Debug))]
pub struct Asset {
    pub path: Arc<str>,
    pub mime: Arc<str>,
    pub bytes: Arc<[u8]>,
}

#[derive(Archive, Debug, Deserialize, Serialize, PartialEq, PartialOrd)]
#[archive(check_bytes)]
#[archive_attr(derive(Debug))]
pub struct Locale {
    pub lang: Arc<str>,
    pub bytes: Arc<[u8]>,
}

#[derive(Archive, Debug, Deserialize, Serialize, PartialEq, PartialOrd)]
#[archive(check_bytes)]
#[archive_attr(derive(Debug))]
pub struct WebComponent {
    pub name: Arc<str>,
    pub path: Arc<str>,
    pub locales: Arc<[Locale]>,
}

#[derive(Archive, Debug, Deserialize, Serialize, PartialEq, PartialOrd)]
#[archive(check_bytes)]
#[archive_attr(derive(Debug))]
pub struct AssetPackage {
    pub name: Arc<str>,
    pub index: i64,
    pub version: Arc<str>,
    pub target_url: Arc<str>,
    pub assets: Arc<[Arc<Asset>]>,
    pub created: i64,
    pub updated: i64,
    pub web_components: Arc<[WebComponent]>,
}

pub fn serialize(pkg: AssetPackage) -> AlignedVec {
    let mut serializer = AllocSerializer::<0>::default();
    serializer.serialize_value(&pkg).unwrap();
    serializer.into_serializer().into_inner()
}

pub fn deserialize(data: &[u8]) -> anyhow::Result<AssetPackage> {
    let archived = rkyv::check_archived_root::<AssetPackage>(data)
        .map_err(|err| anyhow::anyhow!("{err:#?}"))?;
    let result =
        archived.deserialize(&mut rkyv::de::deserializers::SharedDeserializeMap::default())?;
    Ok(result)
}

pub fn deflate_encode_raw(base_raw: &[u8]) -> Vec<u8> {
    let mut e = DeflateEncoder::new(Vec::new(), Compression::default());
    e.write_all(base_raw).unwrap();
    let compressed_bytes = e.finish();
    compressed_bytes.unwrap()
}

pub fn deflate_decode_raw(base_compressed: &[u8]) -> Vec<u8> {
    let mut d = DeflateDecoder::new(base_compressed);
    let mut buffer = Vec::new();
    d.read_to_end(&mut buffer).unwrap();
    buffer
}
