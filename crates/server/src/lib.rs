mod embedded_asset;
mod config;
mod context;

pub mod server;
pub use crate::context::App;

pub async fn run() -> anyhow::Result<()> {
    server::serve(App::new()?).await?;
    Ok(())
}
