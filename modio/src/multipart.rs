use std::marker::Unpin;
use std::path::Path;

use futures_util::TryFutureExt;
use mime::Mime;
use reqwest::multipart::Part;
use reqwest::Body;
use tokio::fs::File;
use tokio::io::AsyncRead;
use tokio_util::io::ReaderStream;

pub struct FileSource {
    pub body: Body,
    pub filename: String,
    pub mime: Mime,
}

impl FileSource {
    pub fn new_from_file<P: AsRef<Path>>(file: P, filename: String, mime: Mime) -> Self {
        let file = file.as_ref().to_path_buf();
        let st = File::open(file)
            .map_ok(ReaderStream::new)
            .try_flatten_stream();

        FileSource {
            body: Body::wrap_stream(st),
            filename,
            mime,
        }
    }

    pub fn new_from_read<T>(read: T, filename: String, mime: Mime) -> Self
    where
        T: AsyncRead + Send + Sync + Unpin + 'static,
    {
        FileSource {
            body: Body::wrap_stream(ReaderStream::new(read)),
            filename,
            mime,
        }
    }
}

impl From<FileSource> for Part {
    fn from(source: FileSource) -> Part {
        Part::stream(source.body)
            .file_name(source.filename)
            .mime_str(source.mime.as_ref())
            .expect("FileSource::into::<Part>()")
    }
}
