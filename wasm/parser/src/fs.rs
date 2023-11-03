use wasm_bindgen::prelude::*;

#[wasm_bindgen(module = "fs")]
extern "C" {
    #[wasm_bindgen(js_name = readFileSync)]
    pub fn read_file_sync(file_name: &str) -> Vec<u8>;
    #[wasm_bindgen(js_name = writeFileSync)]
    pub fn write_file_sync(file_name: &str, content: &[u8]);
    #[wasm_bindgen(js_name = existsSync)]
    pub fn exists_sync(file_name: &str) -> bool;
    #[wasm_bindgen(js_name = mkdirSync)]
    pub fn mkdir_sync(file_name: &str);
}
