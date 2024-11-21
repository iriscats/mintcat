//! Filtering and sorting
use std::collections::BTreeSet;
use std::fmt;

macro_rules! filter {
    ($type:ident, $name:ident, $value:expr) => {
        static $name: &str = $value;
        pub struct $type;
    };
    (
        $(#[$outer:meta])*
        $type:ident, $name:ident, $value:expr, $($x:tt),*) => {
        static $name: &str = $value;
        $(#[$outer])*
        pub struct $type;
        $(
            __impl_filter!($x, $type, $name);
        )*

        impl crate::filter::sealed::FilterPriv for $type {}
    };
}

/// macros: `__impl_filter_*` {{{
macro_rules! __impl_filter {
    (Eq, $type:ident, $name:ident) => {
        __impl_filter_eq!($type, $name);
    };
    (NotEq, $type:ident, $name:ident) => {
        __impl_filter_ne!($type, $name);
    };
    (Like, $type:ident, $name:ident) => {
        __impl_filter_like!($type, $name);
    };
    (In, $type:ident, $name:ident) => {
        __impl_filter_in!($type, $name);
    };
    (Cmp, $type:ident, $name:ident) => {
        __impl_filter_cmp!($type, $name);
    };
    (Bit, $type:ident, $name:ident) => {
        __impl_filter_bit!($type, $name);
    };
    (OrderBy, $type:ident, $name:ident) => {
        __impl_filter_order_by!($type, $name);
    };
}

macro_rules! __impl_filter_eq {
    ($type:ty, $name:expr) => {
        impl crate::filter::Eq for $type {
            fn eq<T, V>(value: V) -> crate::filter::Filter
            where
                T: std::fmt::Display,
                V: Into<crate::filter::OneOrMany<T>>,
            {
                let op = crate::filter::Operator::Equals;
                crate::filter::Filter::new($name, op, value)
            }
        }
    };
}

macro_rules! __impl_filter_ne {
    ($type:ty, $name:expr) => {
        impl crate::filter::NotEq for $type {
            fn ne<T, V>(value: V) -> crate::filter::Filter
            where
                T: std::fmt::Display,
                V: Into<crate::filter::OneOrMany<T>>,
            {
                let op = crate::filter::Operator::Not;
                crate::filter::Filter::new($name, op, value)
            }
        }
    };
}

macro_rules! __impl_filter_like {
    ($type:ty, $name:expr) => {
        impl crate::filter::Like for $type {
            fn like<T, V>(value: V) -> crate::filter::Filter
            where
                T: std::fmt::Display,
                V: Into<crate::filter::OneOrMany<T>>,
            {
                let op = crate::filter::Operator::Like;
                crate::filter::Filter::new($name, op, value)
            }
        }

        impl crate::filter::NotLike for $type {
            fn not_like<T, V>(value: V) -> crate::filter::Filter
            where
                T: std::fmt::Display,
                V: Into<crate::filter::OneOrMany<T>>,
            {
                let op = crate::filter::Operator::NotLike;
                crate::filter::Filter::new($name, op, value)
            }
        }
    };
}

macro_rules! __impl_filter_in {
    ($type:ty, $name:expr) => {
        impl crate::filter::In for $type {
            fn _in<T, V>(value: V) -> crate::filter::Filter
            where
                T: std::fmt::Display,
                V: Into<crate::filter::OneOrMany<T>>,
            {
                let op = crate::filter::Operator::In;
                crate::filter::Filter::new($name, op, value)
            }
        }

        impl crate::filter::NotIn for $type {
            fn not_in<T, V>(value: V) -> crate::filter::Filter
            where
                T: std::fmt::Display,
                V: Into<crate::filter::OneOrMany<T>>,
            {
                let op = crate::filter::Operator::NotIn;
                crate::filter::Filter::new($name, op, value)
            }
        }
    };
}

macro_rules! __impl_filter_cmp {
    ($type:ty, $name:expr) => {
        impl crate::filter::Cmp for $type {
            fn le<T, V>(value: V) -> crate::filter::Filter
            where
                T: std::fmt::Display,
                V: Into<crate::filter::OneOrMany<T>>,
            {
                let op = crate::filter::Operator::Max;
                crate::filter::Filter::new($name, op, value)
            }

            fn ge<T, V>(value: V) -> crate::filter::Filter
            where
                T: std::fmt::Display,
                V: Into<crate::filter::OneOrMany<T>>,
            {
                let op = crate::filter::Operator::Min;
                crate::filter::Filter::new($name, op, value)
            }

            fn gt<T, V>(value: V) -> crate::filter::Filter
            where
                T: std::fmt::Display,
                V: Into<crate::filter::OneOrMany<T>>,
            {
                let op = crate::filter::Operator::GreaterThan;
                crate::filter::Filter::new($name, op, value)
            }

            fn lt<T, V>(value: V) -> crate::filter::Filter
            where
                T: std::fmt::Display,
                V: Into<crate::filter::OneOrMany<T>>,
            {
                let op = crate::filter::Operator::SmallerThan;
                crate::filter::Filter::new($name, op, value)
            }
        }
    };
}

macro_rules! __impl_filter_bit {
    ($type:ty, $name:expr) => {
        impl crate::filter::BitwiseAnd for $type {
            fn bit_and<T, V>(value: V) -> crate::filter::Filter
            where
                T: std::fmt::Display,
                V: Into<crate::filter::OneOrMany<T>>,
            {
                let op = crate::filter::Operator::BitwiseAnd;
                crate::filter::Filter::new($name, op, value)
            }
        }
    };
}

macro_rules! __impl_filter_order_by {
    ($type:ty, $name:expr) => {
        impl crate::filter::OrderBy for $type {
            fn asc() -> crate::filter::Filter {
                crate::filter::Filter::new_order_by_asc($name)
            }

            fn desc() -> crate::filter::Filter {
                crate::filter::Filter::new_order_by_desc($name)
            }
        }
    };
}
// }}}

/// A `prelude` for using common filters and importing traits.
/// ```
/// use modio::filter::prelude::*;
/// ```
#[rustfmt::skip]
pub mod prelude {
    pub use super::BitwiseAnd;
    pub use super::Cmp;
    pub use super::OrderBy;
    pub use super::{Eq, NotEq};
    pub use super::{In, NotIn};
    pub use super::{Like, NotLike};

    pub use super::Filter;
    pub use super::OneOrMany;

    filter!(Fulltext, _Q, "_q", Eq);
    filter!(Id, ID, "id", Eq, NotEq, In, Cmp, OrderBy);
    filter!(Name, NAME, "name", Eq, NotEq, Like, In, OrderBy);
    filter!(NameId, NAME_ID, "name_id", Eq, NotEq, Like, In, OrderBy);
    filter!(ModId, MOD_ID, "mod_id", Eq, NotEq, In, Cmp, OrderBy);
    filter!(Status, STATUS, "status", Eq, NotEq, In, Cmp, OrderBy);
    filter!(DateAdded, DATE_ADDED, "date_added", Eq, NotEq, In, Cmp, OrderBy);
    filter!(DateUpdated, DATE_UPDATED, "date_updated", Eq, NotEq, In, Cmp, OrderBy);
    filter!(DateLive, DATE_LIVE, "date_live", Eq, NotEq, In, Cmp, OrderBy);
    filter!(
        /// Unique id of the user who has ownership of the objects.
        SubmittedBy, SUBMITTED_BY, "submitted_by", Eq, NotEq, In, Cmp, OrderBy
    );

    /// Create a `Filter` with a limit to paginate through results.
    ///
    /// ```
    /// use modio::filter::prelude::*;
    ///
    /// let filter = with_limit(10).offset(10);
    /// ```
    pub fn with_limit(limit: usize) -> Filter {
        Filter::with_limit(limit)
    }

    /// Create a `Filter` with an offset to paginate through results.
    ///
    /// ```
    /// use modio::filter::prelude::*;
    ///
    /// let filter = with_offset(10).limit(10);
    /// ```
    pub fn with_offset(offset: usize) -> Filter {
        Filter::with_offset(offset)
    }
}

pub(crate) mod sealed {
    pub trait FilterPriv {}
}

pub trait Eq: sealed::FilterPriv {
    /// Creates [`Equals`](Operator::Equals) filter.
    fn eq<T: fmt::Display, V: Into<OneOrMany<T>>>(value: V) -> Filter;
}

pub trait NotEq: sealed::FilterPriv {
    /// Creates [`Not`](Operator::Not) filter.
    fn ne<T: fmt::Display, V: Into<OneOrMany<T>>>(value: V) -> Filter;
}

pub trait Like: sealed::FilterPriv {
    /// Creates [`Like`](Operator::Like) filter.
    fn like<T: fmt::Display, V: Into<OneOrMany<T>>>(value: V) -> Filter;
}

pub trait NotLike: sealed::FilterPriv {
    /// Creates [`NotLike`](Operator::Like) filter.
    fn not_like<T: fmt::Display, V: Into<OneOrMany<T>>>(value: V) -> Filter;
}

pub trait In: sealed::FilterPriv {
    /// Creates [`In`](Operator::In) filter.
    fn _in<T: fmt::Display, V: Into<OneOrMany<T>>>(value: V) -> Filter;
}

pub trait NotIn: sealed::FilterPriv {
    /// Creates [`NotIn`](Operator::NotIn) filter.
    fn not_in<T: fmt::Display, V: Into<OneOrMany<T>>>(value: V) -> Filter;
}

pub trait Cmp: sealed::FilterPriv {
    /// Creates [`Max`](Operator::Max) filter.
    fn le<T: fmt::Display, V: Into<OneOrMany<T>>>(value: V) -> Filter;

    /// Creates [`SmallerThan`](Operator::SmallerThan) filter.
    fn lt<T: fmt::Display, V: Into<OneOrMany<T>>>(value: V) -> Filter;

    /// Creates [`Min`](Operator::Min) filter.
    fn ge<T: fmt::Display, V: Into<OneOrMany<T>>>(value: V) -> Filter;

    /// Creates [`GreaterThan`](Operator::GreaterThan) filter.
    fn gt<T: fmt::Display, V: Into<OneOrMany<T>>>(value: V) -> Filter;
}

pub trait BitwiseAnd: sealed::FilterPriv {
    /// Creates [`BitwiseAnd`](Operator::BitwiseAnd) filter.
    fn bit_and<T: fmt::Display, V: Into<OneOrMany<T>>>(value: V) -> Filter;
}

pub trait OrderBy: sealed::FilterPriv {
    /// Creates sorting filter in ascending order.
    fn asc() -> Filter;

    /// Creates sorting filter in descending order.
    fn desc() -> Filter;
}

/// Create a custom `Filter`.
///
/// ```
/// use modio::filter::{custom_filter, Operator};
///
/// let filter = custom_filter("foo", Operator::Equals, "bar");
/// ```
pub fn custom_filter<S, T, V>(name: S, op: Operator, value: V) -> Filter
where
    S: Into<String>,
    T: fmt::Display,
    V: Into<OneOrMany<T>>,
{
    Filter::new(name, op, value)
}

/// Create a custom sorting `Filter` in ascending order.
///
/// ```
/// use modio::filter::{custom_filter, custom_order_by_asc, Operator};
///
/// let filter = custom_filter("foo", Operator::Like, "bar*").order_by(custom_order_by_asc("foo"));
/// ```
pub fn custom_order_by_asc<S: Into<String>>(name: S) -> Filter {
    Filter::new_order_by_asc(name)
}

/// Create a custom sorting `Filter` in descending order.
///
/// ```
/// use modio::filter::{custom_filter, custom_order_by_desc, Operator};
///
/// let filter = custom_filter("foo", Operator::Like, "bar*").order_by(custom_order_by_desc("foo"));
/// ```
pub fn custom_order_by_desc<S: Into<String>>(name: S) -> Filter {
    Filter::new_order_by_desc(name)
}

#[derive(Clone, Default)]
pub struct Filter {
    filters: BTreeSet<FilterEntry>,
    order_by: Option<Sorting>,
    limit: Option<usize>,
    offset: Option<usize>,
}

impl Filter {
    pub(crate) fn new<S, T, V>(name: S, op: Operator, value: V) -> Filter
    where
        S: Into<String>,
        T: fmt::Display,
        V: Into<OneOrMany<T>>,
    {
        let mut filters = BTreeSet::new();
        filters.insert(FilterEntry::new(name.into(), op, value.into().to_string()));
        Filter {
            filters,
            ..Default::default()
        }
    }

    pub(crate) fn new_order_by_asc<S>(name: S) -> Filter
    where
        S: Into<String>,
    {
        Filter {
            order_by: Some(Sorting::Asc(name.into())),
            ..Default::default()
        }
    }

    pub(crate) fn new_order_by_desc<S>(name: S) -> Filter
    where
        S: Into<String>,
    {
        Filter {
            order_by: Some(Sorting::Desc(name.into())),
            ..Default::default()
        }
    }

    pub(crate) fn with_limit(limit: usize) -> Filter {
        Filter {
            limit: Some(limit),
            ..Default::default()
        }
    }

    pub(crate) fn with_offset(offset: usize) -> Filter {
        Filter {
            offset: Some(offset),
            ..Default::default()
        }
    }

    #[must_use]
    pub fn and(self, mut other: Filter) -> Filter {
        let Filter { mut filters, .. } = self;
        filters.append(&mut other.filters);
        Filter {
            filters,
            order_by: other.order_by.or(self.order_by),
            limit: other.limit.or(self.limit),
            offset: other.offset.or(self.offset),
        }
    }

    #[must_use]
    pub fn order_by(self, other: Filter) -> Filter {
        Filter {
            order_by: other.order_by.or(self.order_by),
            ..self
        }
    }

    #[must_use]
    pub fn limit(self, limit: usize) -> Filter {
        Filter {
            limit: Some(limit),
            ..self
        }
    }

    #[must_use]
    pub fn offset(self, offset: usize) -> Filter {
        Filter {
            offset: Some(offset),
            ..self
        }
    }
}

impl std::ops::Add for Filter {
    type Output = Self;

    fn add(self, other: Self) -> Self {
        self.and(other)
    }
}

impl fmt::Display for Filter {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match serde_json::to_string(&self) {
            Ok(s) => f.write_str(&s),
            Err(_) => Err(fmt::Error),
        }
    }
}

impl sealed::FilterPriv for Filter {}

#[doc(hidden)]
impl serde::ser::Serialize for Filter {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        use serde::ser::SerializeMap;

        let map_filters = |f: &FilterEntry| {
            let value = match f.value {
                OneOrMany::One(ref v) => v.to_string(),
                OneOrMany::Many(ref v) => v
                    .iter()
                    .map(ToString::to_string)
                    .collect::<Vec<_>>()
                    .join(","),
            };
            (format!("{}{}", f.name, f.op), value)
        };

        let len = self.filters.len()
            + self.limit.as_ref().map(|_| 1).unwrap_or_default()
            + self.offset.as_ref().map(|_| 1).unwrap_or_default()
            + self.order_by.as_ref().map(|_| 1).unwrap_or_default();

        let mut map = serializer.serialize_map(Some(len))?;
        for (k, v) in self.filters.iter().map(map_filters) {
            map.serialize_entry(&k, &v)?;
        }
        if let Some(ref limit) = self.limit {
            map.serialize_entry("_limit", limit)?;
        }
        if let Some(ref offset) = self.offset {
            map.serialize_entry("_offset", offset)?;
        }
        if let Some(ref order_by) = self.order_by {
            map.serialize_entry("_sort", &order_by.to_string())?;
        }
        map.end()
    }
}

#[derive(Clone)]
struct FilterEntry {
    name: String,
    op: Operator,
    value: OneOrMany<String>,
}

impl FilterEntry {
    fn new(name: String, op: Operator, value: OneOrMany<String>) -> FilterEntry {
        FilterEntry { name, op, value }
    }
}

// impl PartialEq, Eq, PartialOrd, Ord for FilterEntry {{{
impl std::cmp::Eq for FilterEntry {}

impl PartialEq for FilterEntry {
    fn eq(&self, other: &FilterEntry) -> bool {
        matches!(self.cmp(other), std::cmp::Ordering::Equal)
    }
}

impl Ord for FilterEntry {
    fn cmp(&self, other: &FilterEntry) -> std::cmp::Ordering {
        self.name.cmp(&other.name).then(self.op.cmp(&other.op))
    }
}

impl PartialOrd for FilterEntry {
    fn partial_cmp(&self, other: &FilterEntry) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}
// }}}

#[derive(Clone)]
enum Sorting {
    Asc(String),
    Desc(String),
}

impl fmt::Display for Sorting {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        use std::fmt::Write;

        match self {
            Self::Asc(field) => f.write_str(field),
            Self::Desc(field) => {
                f.write_char('-')?;
                f.write_str(field)
            }
        }
    }
}

/// Filter operators of mod.io.
///
/// See [mod.io docs](https://docs.mod.io/#filtering) for more information.
#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub enum Operator {
    /// Equal to (`id=1`)
    Equals,
    /// Not equal to (`id-not=1`)
    Not,
    /// Equivalent to SQL's `LIKE`. `*` is equivalent to SQL's `%`. (`name-lk=foo*`)
    Like,
    /// Equivalent to SQL's `NOT LIKE` (`name-not-lk=foo*`)
    NotLike,
    /// Equivalent to SQL's `IN` (`id-in=1,3,5`)
    In,
    /// Equivalent to SQL's `NOT IN` (`id-not-in=1,3,5`)
    NotIn,
    /// Greater than or equal to (`id-min=5`)
    Min,
    /// Less than or equal to (`id-max=10`)
    Max,
    /// Less than (`id-st=10`)
    SmallerThan,
    /// Greater than (`id-gt=5`)
    GreaterThan,
    /// Match bits (`maturity_option-bitwise-and=5`)
    BitwiseAnd,
}

impl fmt::Display for Operator {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Equals => fmt.write_str(""),
            Self::Not => fmt.write_str("-not"),
            Self::Like => fmt.write_str("-lk"),
            Self::NotLike => fmt.write_str("-not-lk"),
            Self::In => fmt.write_str("-in"),
            Self::NotIn => fmt.write_str("-not-in"),
            Self::Min => fmt.write_str("-min"),
            Self::Max => fmt.write_str("-max"),
            Self::SmallerThan => fmt.write_str("-st"),
            Self::GreaterThan => fmt.write_str("-gt"),
            Self::BitwiseAnd => fmt.write_str("-bitwise-and"),
        }
    }
}

/// Represents a value or a list of values of a filter.
#[derive(Clone, Debug)]
pub enum OneOrMany<T>
where
    T: fmt::Display,
{
    One(T),
    Many(Vec<T>),
}

impl<T: fmt::Display> OneOrMany<T> {
    fn to_string(&self) -> OneOrMany<String> {
        match self {
            Self::One(s) => OneOrMany::One(s.to_string()),
            Self::Many(s) => OneOrMany::Many(s.iter().map(ToString::to_string).collect()),
        }
    }
}

impl<T: fmt::Display> From<T> for OneOrMany<T> {
    fn from(from: T) -> OneOrMany<T> {
        Self::One(from)
    }
}

impl<T: fmt::Display> From<Vec<T>> for OneOrMany<T> {
    fn from(from: Vec<T>) -> OneOrMany<T> {
        Self::Many(from)
    }
}

#[cfg(test)]
mod test {
    #[test]
    #[allow(dead_code)]
    fn filters() {
        use super::prelude::*;

        filter!(GameId, GAME_ID, "game_id", Eq, NotEq, Like, In, Cmp, OrderBy);
        filter!(NameId, NAME_ID, "name_id", Eq, NotEq, Like, In, Cmp, OrderBy);
        filter!(BitOption, BIT_OPTION, "bit_option", Bit);

        assert_eq!(GAME_ID, "game_id");
        assert_eq!(NAME_ID, "name_id");

        let f = GameId::eq(1);
        assert_eq!(f.to_string(), r#"{"game_id":"1"}"#);

        let f = GameId::_in(vec![1, 2]).and(NameId::like("foobar*"));
        assert_eq!(
            f.to_string(),
            r#"{"game_id-in":"1,2","name_id-lk":"foobar*"}"#
        );

        let f = GameId::eq(1).and(GameId::eq(2)).and(GameId::ne(3));
        assert_eq!(f.to_string(), r#"{"game_id":"2","game_id-not":"3"}"#);

        let f = GameId::eq(1).order_by(NameId::asc());
        assert_eq!(f.to_string(), r#"{"game_id":"1","_sort":"name_id"}"#);

        let f = NameId::like("foo*").and(NameId::not_like("bar*"));
        assert_eq!(
            f.to_string(),
            r#"{"name_id-lk":"foo*","name_id-not-lk":"bar*"}"#
        );

        let f = NameId::gt(1).and(NameId::lt(2));
        assert_eq!(f.to_string(), r#"{"name_id-st":"2","name_id-gt":"1"}"#);

        let f = NameId::ge(1).and(NameId::le(2));
        assert_eq!(f.to_string(), r#"{"name_id-min":"1","name_id-max":"2"}"#);

        let f = BitOption::bit_and(1);
        assert_eq!(f.to_string(), r#"{"bit_option-bitwise-and":"1"}"#);

        let f = NameId::desc();
        assert_eq!(f.to_string(), r#"{"_sort":"-name_id"}"#);

        let f = with_limit(10).and(with_limit(20));
        assert_eq!(f.to_string(), r#"{"_limit":20}"#);

        let f = with_offset(10).and(with_offset(20));
        assert_eq!(f.to_string(), r#"{"_offset":20}"#);
    }

    #[test]
    fn custom_filters() {
        use super::prelude::*;
        use super::*;

        filter!(GameId, GAME_ID, "game_id", Eq);

        let f = GameId::eq(1).and(custom_filter("foo", Operator::Equals, "bar"));
        assert_eq!(f.to_string(), r#"{"foo":"bar","game_id":"1"}"#);

        let f = custom_order_by_asc("foo");
        assert_eq!(f.to_string(), r#"{"_sort":"foo"}"#);
    }

    #[test]
    fn std_ops_add() {
        use super::prelude::*;

        let f = Id::eq(1) + Id::eq(2);
        assert_eq!(f.to_string(), r#"{"id":"2"}"#);

        let f = Id::eq(1) + NameId::eq("foo");
        assert_eq!(f.to_string(), r#"{"id":"1","name_id":"foo"}"#);
    }
}

// vim: fdm=marker
