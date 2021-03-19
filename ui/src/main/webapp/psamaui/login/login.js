define(['common/session', 'psamaSettings/settings', 'common/searchParser', 'jquery', 'handlebars', 'text!login/login.hbs', 'text!login/not_authorized.hbs', 'psamaui/overrides/login', 'util/notification', 'psamaui/login/fence_login'], function(session, settings, parseQueryString, $, HBS, loginTemplate, notAuthorizedTemplate, overrides, notification, fenceLogin) {
    var loginTemplate = HBS.compile(loginTemplate);
    var loginCss = null
    var login = {
        showLoginPage: function() {
            console.log("Auth0-showLoginPage()");
            var queryObject = parseQueryString();
            if (queryObject.redirection_url)
                sessionStorage.redirection_url = queryObject.redirection_url.trim();
            if (queryObject.not_authorized_url)
                sessionStorage.not_authorized_url = queryObject.not_authorized_url.trim();
            var redirectURI = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ":" + window.location.port : "") + "/psamaui/login/";
            if (typeof queryObject.access_token === "string") {
                $.ajax({
                    url: '/psama/authentication',
                    type: 'post',
                    data: JSON.stringify({
                        access_token: queryObject.access_token,
                        redirectURI: redirectURI
                    }),
                    contentType: 'application/json',
                    success: function(data) {
                        session.authenticated(data.userId, data.token, data.email, data.permissions, data.acceptedTOS, this.handleNotAuthorizedResponse);
                        if (data.acceptedTOS !== 'true') {
                            history.pushState({}, "", "/psamaui/tos");
                        } else {
                            if (sessionStorage.redirection_url) {
                                window.location = sessionStorage.redirection_url;
                            } else {
                                history.pushState({}, "", "/picsureui");
                            }
                        }
                    }
                    .bind(this),
                    error: function(data) {
                        notification.showFailureMessage("Failed to authenticate with provider. Try again or contact administrator if error persists.")
                        history.pushState({}, "", sessionStorage.not_authorized_url ? sessionStorage.not_authorized_url : "/psamaui/not_authorized?redirection_url=/picsureui");
                    }
                });
            } else {
                if (!overrides.client_id) {
                    notification.showFailureMessage("Client_ID is not provided. Please update overrides/login.js file.");
                }
                var clientId = overrides.client_id;
                if (settings.customizeAuth0Login) {
                    require.config({
                        paths: {
                            'auth0-js': "webjars/auth0.js/9.2.3/build/auth0"
                        },
                        shim: {
                            "auth0-js": {
                                deps: ["jquery"],
                                exports: "Auth0Lock"
                            }
                        }
                    });
                    require(['auth0-js'], function() {
                                $('#main-content').html(loginTemplate({
                                    clientId: clientId,
                                    auth0Subdomain: "avillachlab",
                                    callbackURL: redirectURI
                                }));
                                overrides.postRender ? overrides.postRender.apply(this) : undefined;
                    });
                } else {
                    require.config({
                        paths: {
                            'auth0Lock': "webjars/auth0-lock/11.2.3/build/lock",
                        },
                        shim: {
                            "auth0Lock": {
                                deps: ["jquery"],
                                exports: "Auth0Lock"
                            }
                        }
                    });
                    require(['auth0Lock'], function(Auth0Lock) {
                        var lock = new Auth0Lock(clientId,settings.auth0domain + ".auth0.com",{
                            auth: {
                                redirectUrl: redirectURI,
                                responseType: 'token',
                                params: {
                                    scope: 'openid email'
                                }
                            }
                        });
                        lock.show();
                    });
                }
            }
        },
        handleNotAuthorizedResponse: function() {
            console.log("Auth0-handleNotAuthorizedResponse()");
            if (JSON.parse(sessionStorage.session).token) {
                if (sessionStorage.not_authorized_url)
                    window.location = sessionStorage.not_authorized_url;
                else
                    window.location = "/psamaui/not_authorized" + window.location.search;
            } else {
                console.log("No token in session, so redirect to logout...");
                return null;
            }
        },
        displayNotAuthorized: function() {
            console.log("Auth0-displayNotAuthorized()");
            if (overrides.displayNotAuthorized)
                overrides.displayNotAuthorized()
            else {
                sessionStorage.clear();
                localStorage.clear();
                $('#main-content').html(HBS.compile(notAuthorizedTemplate)({
                    helpLink: settings.helpLink
                }));
            }
        }
    };
    return settings.idp_provider == "fence" ? fenceLogin : login;
});

