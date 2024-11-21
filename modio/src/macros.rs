macro_rules! option {
    ($(#[$outer:meta])* $name:ident) => {
        option!($(#[$outer])* $name: Into<String>);
    };
    ($(#[$outer:meta])* $name:ident: Into<$T:ty>) => {
        $(#[$outer])*
        #[must_use]
        pub fn $name<T: Into<$T>>(self, value: T) -> Self {
            Self {
                $name: Some(value.into()),
                ..self
            }
        }
    };
    ($(#[$outer:meta])* $name:ident: $T:ty) => {
        $(#[$outer])*
        #[must_use]
        pub fn $name(self, value: $T) -> Self {
            Self {
                $name: Some(value),
                ..self
            }
        }
    };
    ($(#[$outer:meta])* $name:ident >> $param:expr) => {
        $(#[$outer])*
        #[must_use]
        pub fn $name<S: Into<String>>(self, value: S) -> Self {
            let mut params = self.params;
            params.insert($param, value.into());
            Self { params }
        }
    };
    ($(#[$outer:meta])* $name:ident: Into<$T:ty> >> $param:expr) => {
        $(#[$outer])*
        #[must_use]
        pub fn $name<T: Into<$T>>(self, value: T) -> Self {
            let mut params = self.params;
            params.insert($param, value.into().to_string());
            Self { params }
        }
    };
    ($(#[$outer:meta])* $name:ident: $T:ty >> $param:expr) => {
        $(#[$outer])*
        #[must_use]
        pub fn $name(self, value: $T) -> Self {
            let mut params = self.params;
            params.insert($param, value.to_string());
            Self { params }
        }
    };
    // This variant prevents the poor macro formatting in auth.rs by rustfmt
    ($(#[$outer:meta])* $name:ident $T:ty >> $param:expr) => {
        option!($(#[$outer])* $name: $T >> $param);
    };
}

macro_rules! impl_serialize_params {
    ($T:ty >> $map:ident) => {
        #[doc(hidden)]
        impl ::serde::ser::Serialize for $T {
            fn serialize<S>(&self, serializer: S) -> ::std::result::Result<S::Ok, S::Error>
            where
                S: ::serde::ser::Serializer,
            {
                use ::serde::ser::SerializeMap;

                let mut map = serializer.serialize_map(Some(self.$map.len()))?;
                for (k, v) in &self.$map {
                    map.serialize_entry(k, v)?;
                }
                map.end()
            }
        }
    };
}
