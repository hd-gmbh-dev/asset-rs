pub mod embedded_asset;
pub mod config;
pub mod context;
pub mod server;

use crate::context::App;

pub async fn run() -> anyhow::Result<()> {
    server::serve(App::new()?).await?;
    Ok(())
}
