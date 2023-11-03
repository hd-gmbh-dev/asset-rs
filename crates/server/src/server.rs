use anyhow::Context;
use tracing::info;
use super::context::App;

use axum::{
    extract::{Path, State},
    response::IntoResponse,
    routing::get,
    Router,
};

pub async fn route(State(app): State<App>, Path(asset): Path<String>) -> impl IntoResponse {
    if !asset.contains(".") {
        return app
            .store()
            .index()
            .into_response();
    }
    app
        .store()
        .get(&asset)
        .into_response()
}

pub async fn keycloak_config(State(app): State<App>) -> impl IntoResponse {
    app
        .store()
        .keycloak_config()
        .into_response()
}

pub async fn index(State(app): State<App>) -> impl IntoResponse {
    app
        .store()
        .index()
        .into_response()
}

pub async fn serve(app: App) -> anyhow::Result<()> {
    let addr = app.cfg().address().parse().unwrap();
    let router = Router::new()
        .route("/.well-known/config", get(keycloak_config))
        .route("/*asset", get(route))
        .fallback(get(index))
        .with_state(app);
    info!("Serve on http://{addr:?}/");
    axum::Server::bind(&addr)
        .serve(router.into_make_service())
        .await
        .context("error while starting server")?;
    Ok(())
}
