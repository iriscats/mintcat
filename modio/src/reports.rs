//! Reports interface
use crate::prelude::*;

pub struct Reports {
    modio: Modio,
}

impl Reports {
    pub(crate) fn new(modio: Modio) -> Self {
        Self { modio }
    }

    /// Submit a report for any resource on mod.io. [required: token]
    pub async fn submit(self, report: Report) -> Result<()> {
        self.modio
            .request(Route::SubmitReport)
            .form(&report)
            .send::<Message>()
            .await?;
        Ok(())
    }
}

pub struct Report {
    pub name: String,
    pub contact: Option<String>,
    pub summary: String,
    pub kind: ReportType,
    pub resource: Resource,
}

pub enum ReportType {
    Generic,
    DMCA,
    NotWorking,
    RudeContent,
    IllegalContent,
    StolenContent,
    FalseInformation,
    Other,
}

pub enum Resource {
    Game(u32),
    Mod(u32),
    User(u32),
}

impl Report {
    pub fn new<S: Into<String>>(
        name: S,
        contact: Option<S>,
        summary: S,
        kind: ReportType,
        resource: Resource,
    ) -> Self {
        Self {
            name: name.into(),
            contact: contact.map(Into::into),
            summary: summary.into(),
            kind,
            resource,
        }
    }
}

#[doc(hidden)]
impl serde::ser::Serialize for Report {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        use serde::ser::SerializeMap;

        let (resource, id) = match self.resource {
            Resource::Game(id) => ("games", id),
            Resource::Mod(id) => ("mods", id),
            Resource::User(id) => ("users", id),
        };
        let kind = match self.kind {
            ReportType::Generic => 0,
            ReportType::DMCA => 1,
            ReportType::NotWorking => 2,
            ReportType::RudeContent => 3,
            ReportType::IllegalContent => 4,
            ReportType::StolenContent => 5,
            ReportType::FalseInformation => 6,
            ReportType::Other => 7,
        };

        let len = if self.contact.is_some() { 6 } else { 5 };
        let mut map = serializer.serialize_map(Some(len))?;

        if let Some(ref c) = self.contact {
            map.serialize_entry("contact", c)?;
        }
        map.serialize_entry("resource", resource)?;
        map.serialize_entry("id", &id)?;
        map.serialize_entry("type", &kind)?;
        map.serialize_entry("name", &self.name)?;
        map.serialize_entry("summary", &self.summary)?;

        map.end()
    }
}
