use std::borrow::Cow;

use reqwest::Method;

// macro: define_routes {{{
// Based on https://stackoverflow.com/a/44161783
macro_rules! define_routes {
    // Start rule.
    // Note: `$(,)*` is a trick to eat any number of trailing commas.
    ( $( {$($route:tt)*} ),* $(,)*) => {
        // This starts the parse, giving the initial state of the output
        // (i.e. empty).  Note that the route come after the semicolon.
        define_routes! { @parse {}, {}; $({$($route)*},)* }
    };

    // Termination rule: no more input.
    (
        @parse
        // $eout will be the body of the enum.
        {$($eout:tt)*},
        // $pout will be the body of the `pieces` match.
        {$($pout:tt)*};
        // See, nothing here?
    ) => {
        #[derive(Debug, Clone, Copy)]
        pub enum Route {
            $($eout)*
        }

        impl Route {
            pub fn pieces(&self) -> (Method, Cow<'_, str>, AuthMethod) {
                match self {
                    $($pout)*
                }
            }
        }
    };

    // Rule for routes with no arguments.
    (
        @parse {$($eout:tt)*}, {$($pout:tt)*};
        {
            $rname:ident,
            $method:ident: $path:expr,
            $required:ident $(,)*
        },
        $($tail:tt)*
    ) => {
        define_routes! {
            @parse
            {
                $($eout)*
                $rname,
            },
            {
                $($pout)*
                Route::$rname => {
                    (Method::$method, Cow::from($path), AuthMethod::$required)
                },
            };
            $($tail)*
        }
    };

    // Rule for other routes.
    (
        @parse {$($eout:tt)*}, {$($pout:tt)*};
        {
            $rname:ident,
            $method:ident: $path:expr,
            [$($args:ident),* $(,)*],
            $required:ident $(,)*
        },
        $($tail:tt)*
    ) => {
        define_routes! {
            @parse
            {
                $($eout)*
                $rname { $( $args: u32, )* },
            },
            {
                $($pout)*
                Route::$rname {
                    $($args,)*
                }=> {
                    (Method::$method, Cow::from(format!($path, $($args,)*)), AuthMethod::$required)
                },
            };
            $($tail)*
        }
    };
}
// }}}

pub enum AuthMethod {
    ApiKey,
    Token,
    Any,
}

define_routes! {
    { AuthEmailRequest, POST: "/oauth/emailrequest", ApiKey },
    { AuthEmailExchange, POST: "/oauth/emailexchange", ApiKey },
    { AuthSteam, POST: "/external/steamauth", ApiKey },
    { AuthGog, POST: "/external/galaxyauth", ApiKey },
    { AuthItchio, POST: "/external/itchioauth", ApiKey },
    { AuthOculus, POST: "/external/oculusauth", ApiKey },
    { AuthSwitch, POST: "/external/switchauth", ApiKey },
    { AuthXbox, POST: "/external/xboxauth", ApiKey },
    { AuthDiscord, POST: "/external/discordauth", ApiKey },
    { AuthGoogle, POST: "/external/googleauth", ApiKey },
    { Terms, GET: "/authenticate/terms", ApiKey},
    { GetGames, GET: "/games", Any },
    { GetGame, GET: "/games/{}", [game_id], Any },
    { AddGameMedia, POST: "/games/{}/media", [game_id], Token },
    { GetGameStats, GET: "/games/{}/stats", [game_id], Any },
    { GetGameTags, GET: "/games/{}/tags", [game_id], Any },
    { AddGameTags, POST: "/games/{}/tags", [game_id], Token },
    { DeleteGameTags, DELETE: "/games/{}/tags", [game_id], Token },
    { GetMods, GET: "/games/{}/mods", [game_id], Any },
    { GetMod, GET: "/games/{}/mods/{}", [game_id, mod_id], Any },
    { AddMod, POST: "/games/{}/mods", [game_id], Token },
    { EditMod, PUT: "/games/{}/mods/{}", [game_id, mod_id], Token },
    { DeleteMod, DELETE: "/games/{}/mods/{}", [game_id, mod_id], Token },
    { AddModMedia, POST: "/games/{}/mods/{}/media", [game_id, mod_id], Token },
    { DeleteModMedia, DELETE: "/games/{}/mods/{}/media", [game_id, mod_id], Token },
    { Subscribe, POST: "/games/{}/mods/{}/subscribe", [game_id, mod_id], Token },
    { Unsubscribe, DELETE: "/games/{}/mods/{}/subscribe", [game_id, mod_id], Token },
    { GetAllModEvents, GET: "/games/{}/mods/events", [game_id], Any },
    { GetModEvents, GET: "/games/{}/mods/{}/events", [game_id, mod_id], Any },
    { GetAllModStats, GET: "/games/{}/mods/stats", [game_id], Any },
    { GetModStats, GET: "/games/{}/mods/{}/stats", [game_id, mod_id], Any },
    { GetModTags, GET: "/games/{}/mods/{}/tags", [game_id, mod_id], Any },
    { AddModTags, POST: "/games/{}/mods/{}/tags", [game_id, mod_id], Token },
    { DeleteModTags, DELETE: "/games/{}/mods/{}/tags", [game_id, mod_id], Token },
    { RateMod, POST: "/games/{}/mods/{}/ratings", [game_id, mod_id], Token },
    { GetModMetadata, GET: "/games/{}/mods/{}/metadatakvp", [game_id, mod_id], Any },
    { AddModMetadata, POST: "/games/{}/mods/{}/metadatakvp", [game_id, mod_id], Token },
    { DeleteModMetadata, DELETE: "/games/{}/mods/{}/metadatakvp", [game_id, mod_id], Token },
    { GetModDependencies, GET: "/games/{}/mods/{}/dependencies", [game_id, mod_id], Any },
    { AddModDependencies, POST: "/games/{}/mods/{}/dependencies", [game_id, mod_id], Token },
    { DeleteModDependencies, DELETE: "/games/{}/mods/{}/dependencies", [game_id, mod_id], Token },
    { GetTeamMembers, GET: "/games/{}/mods/{}/team", [game_id, mod_id], Any },
    { GetModComments, GET: "/games/{}/mods/{}/comments", [game_id, mod_id], Any },
    { GetModComment, GET: "/games/{}/mods/{}/comments/{}", [game_id, mod_id, comment_id], Any },
    { AddModComment, POST: "/games/{}/mods/{}/comments", [game_id, mod_id], Token },
    { EditModComment, PUT: "/games/{}/mods/{}/comments/{}", [game_id, mod_id, comment_id], Token },
    { DeleteModComment, DELETE: "/games/{}/mods/{}/comments/{}", [game_id, mod_id, comment_id], Token },
    { AddModCommentKarma, POST: "/games/{}/mods/{}/comments/{}/karma", [game_id, mod_id, comment_id], Token },
    { GetFiles, GET: "/games/{}/mods/{}/files", [game_id, mod_id], Any },
    { GetFile, GET: "/games/{}/mods/{}/files/{}", [game_id, mod_id, file_id], Any },
    { AddFile, POST: "/games/{}/mods/{}/files", [game_id, mod_id], Token },
    { EditFile, PUT: "/games/{}/mods/{}/files/{}", [game_id, mod_id, file_id], Token },
    { DeleteFile, DELETE: "/games/{}/mods/{}/files/{}", [game_id, mod_id, file_id], Token },
    { ManagePlatformStatus, POST: "/games/{}/mods/{}/files/{}/platforms", [game_id, mod_id, file_id], Token },
    { AuthorizedUser, GET: "/me", Token },
    { UserSubscriptions, GET: "/me/subscribed", Token },
    { UserEvents, GET: "/me/events", Token },
    { UserGames, GET: "/me/games", Token },
    { UserMods, GET: "/me/mods", Token },
    { UserFiles, GET: "/me/files", Token },
    { UserRatings, GET: "/me/ratings", Token },
    { UserMuted, GET: "/me/users/muted", Token },
    { MuteUser, POST: "/users/{}/mute", [user_id], Token },
    { UnmuteUser, DELETE: "/users/{}/mute", [user_id], Token },
    { SubmitReport, POST: "/report", Token },
}

#[cfg(test)]
mod tests {
    use super::Route;

    #[test]
    fn pieces() {
        let route = Route::GetGames;
        let (_, path, _) = route.pieces();
        assert_eq!(path, "/games");

        let route = Route::GetFile {
            game_id: 1,
            mod_id: 2,
            file_id: 3,
        };
        let (_, path, _) = route.pieces();
        assert_eq!(path, "/games/1/mods/2/files/3");
    }
}

// vim: fdm=marker
