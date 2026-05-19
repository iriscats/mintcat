pub mod app;
pub mod download;
pub mod frontend;
pub mod integrator;
pub mod network;
pub mod proxy;
pub mod steam;

pub fn run() {
    app::run()
}
