// macro: bitflags {{{
macro_rules! bitflags {
    (
        $(#[$outer:meta])*
        $vis:vis struct $BitFlags:ident: $T:ty {
            $(
                $(#[$inner:ident $($args:tt)*])*
                const $Flag:ident = $value:expr;
            )*
        }

        $($t:tt)*
    ) => {
        bitflags::bitflags! {
            $(#[$outer])*
            $vis struct $BitFlags: $T {
                $(
                    $(#[$inner $($args)*])*
                    const $Flag = $value;
                )*
            }
        }

        bitflags!(__impl_display $BitFlags);
        bitflags!(__impl_serde $BitFlags: $T);

        bitflags! {
            $($t)*
        }
    };
    (__impl_display $BitFlags:ident) => {
        impl ::std::fmt::Display for $BitFlags {
            fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
                self.bits.fmt(f)
            }
        }
    };
    (__impl_serde $BitFlags:ident: $T:tt) => {
        impl<'de> ::serde::de::Deserialize<'de> for $BitFlags {
            fn deserialize<D: ::serde::de::Deserializer<'de>>(deserializer: D) -> ::std::result::Result<Self, D::Error> {
                let value = <$T>::deserialize(deserializer)?;
                Self::from_bits(value)
                    .ok_or_else(|| {
                        ::serde::de::Error::custom(format!("invalid {} value: {}", stringify!($BitFlags), value))
                    })
            }
        }
    };
    () => {};
}
// }}}

// macro: enum_number {{{
macro_rules! enum_number {
    (
        $(#[$outer:meta])*
        $vis:vis enum $Enum:ident {
            $(
                $(#[$inner:ident $($args:tt)*])*
                $Variant:ident = $value:literal,
            )*
            _ => Unknown($T:ty),
        }
    ) => {
        $(#[$outer])*
        $vis enum $Enum {
            $(
                $(#[$inner $($args)*])*
                $Variant,
            )*
            /// Variant value is unknown.
            Unknown($T),
        }

        impl ::std::fmt::Display for $Enum {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> ::std::fmt::Result {
                <$T>::from(*self).fmt(f)
            }
        }

        impl From<$T> for $Enum {
            fn from(value: $T) -> Self {
                #[allow(unused_doc_comments)]
                match value {
                    $($(#[$inner $($args)*])* $value => Self::$Variant,)*
                    unknown => Self::Unknown(unknown),
                }
            }
        }

        impl From<$Enum> for $T {
            fn from(value: $Enum) -> Self {
                #[allow(unused_doc_comments)]
                match value {
                    $($(#[$inner $($args)*])* $Enum::$Variant => $value,)*
                    $Enum::Unknown(unknown) => unknown,
                }
            }
        }
    };
}
// }}}

// vim: fdm=marker
