use serde::de::{DeserializeOwned, Error, MapAccess};

pub trait DeserializeField<T: DeserializeOwned> {
    fn deserialize_value<'de, A: MapAccess<'de>>(
        &mut self,
        name: &'static str,
        map: &mut A,
    ) -> Result<(), A::Error>;
}

impl<T: DeserializeOwned> DeserializeField<T> for Option<T> {
    fn deserialize_value<'de, A>(&mut self, name: &'static str, map: &mut A) -> Result<(), A::Error>
    where
        A: MapAccess<'de>,
    {
        if self.is_some() {
            return Err(A::Error::duplicate_field(name));
        }
        self.replace(map.next_value()?);
        Ok(())
    }
}

pub trait MissingField<T> {
    fn missing_field<E: Error>(self, name: &'static str) -> Result<T, E>;
}

impl<T> MissingField<T> for Option<T> {
    fn missing_field<E: Error>(self, name: &'static str) -> Result<T, E> {
        self.ok_or_else(|| Error::missing_field(name))
    }
}
