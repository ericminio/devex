'use strict';

/**
 * Module dependencies
 */
var path = require('path'),
  errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
  mongoose = require('mongoose'),
  passport = require('passport'),
  request = require('request'),
  claimMessages = require(path.resolve('./modules/messages/server/controllers/messages.controller')).claimMessages,
  User = mongoose.model('User');

var config = require('../../../../../config/config');

// URLs for which user can't be redirected on signin
var noReturnUrls = [
  '/authentication/signin',
  '/authentication/signup'
];

/**
 * Signup
 */
exports.signup = function (req, res) {
  // For security measurement we remove the roles from the req.body object
  delete req.body.roles;

  // Init user and add missing fields
  var user = new User(req.body);
  user.provider = 'local';
  user.displayName = user.firstName + ' ' + user.lastName;
  if (user.government) user.roles = ['gov-request','user'];

  // Then save the user
  user.save(function (err) {
    if (err) {
      return res.status(422).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      // Remove sensitive data before login
      user.password = undefined;
      user.salt = undefined;
      //
      // CC: this bit claims any messages attributed to this new
      // user's email address
      //
      claimMessages (user);
      req.login(user, function (err) {
        if (err) {
          res.status(400).send(err);
        } else {
          res.json(user);
        }
      });
    }
  });
};

var ensureOrgs = function (user, orglist) {
  var Org = mongoose.model ('Org');
  var plist = orglist.map (function (orgid) {
    return new Promise (function (resolve, reject) {
      Org.findById (orgid).exec (function (err, org) {
        if (err || !org) {
          user.orgsAdmin.pull (orgid);
          user.orgsMember.pull (orgid);
          user.orgsPending.pull (orgid);
        }
        resolve ();
      });
    });
  });
  Promise.all (plist)
  .then (function () {
    user.markModified ('orgsAdmin');
    user.markModified ('orgsMember');
    user.markModified ('orgsPending');
    user.save ();
  });
};

/**
 * Signin after passport authentication
 */
exports.signin = function (req, res, next) {
  passport.authenticate('local', function (err, user, info) {
    if (err || !user) {
      res.status(422).send(info);
    } else {
      // Remove sensitive data before login
        user.password = undefined;
        user.salt = undefined;
        req.login(user, function (err) {
          if (err) {
            res.status(400).send(err);
          } else {
            res.json(user);
          }
        });
    }
  })(req, res, next);
};

/**
 * Signout
 */
exports.signout = function (req, res) {
  // ensureOrgs (req.user, req.user.orgsAdmin.concat (req.user.orgsMember, req.user.orgsPending))
  req.logout();
  res.redirect('/');
};

/**
 * OAuth provider call
 */
exports.oauthCall = function (strategy, scope) {
  return function (req, res, next) {
    // Authenticate
    passport.authenticate(strategy, scope)(req, res, next);
  };
};

exports.validate = () => {
	return (req, res, next) => {
		let code = req.query.code;
		let options = {
			url: 'https://github.com/login/oauth/access_token',
			headers: {
				'Accept': 'application/json'
			},
			form: {
				code: code,
				client_id: config.github.clientID,
				client_secret: config.github.clientSecret
			}
		}
		request.post(options, (err, httpResponse, body) => {
			if (err) {
				res.status(403).send('Error authenticating code with github: ' + err);
			}

			// github should have returned an access_token.  Use token to in another request to retrieve user
			const access_token = JSON.parse(body).access_token;
			let options = {
				url: 'https://api.github.com/user?access_token=' + access_token,
				headers: {
					'User-Agent': 'request'
				}
			}
			request(options, (err, httpResponse, body) => {

				var providerData = JSON.parse(body);
				// providerData.accessToken = accessToken;
				// providerData.refreshToken = refreshToken;

				// Create the user OAuth profile
				var displayName = providerData.name;
				var iSpace = displayName.indexOf(' '); // index of the whitespace following the firstName
				var firstName = iSpace !== -1 ? displayName.substring(0, iSpace) : displayName;
				var lastName = iSpace !== -1 ? displayName.substring(iSpace + 1) : '';

				var providerUserProfile = {
					firstName: firstName,
					lastName: lastName,
					displayName: displayName,
					email: providerData.email,
					username: providerData.login,
					// jscs:disable requireCamelCaseOrUpperCaseIdentifiers
					profileImageURL: (providerData.avatar_url) ? providerData.avatar_url : undefined,
					// jscs:enable
					provider: 'github',
					providerIdentifierField: 'id',
					providerData: providerData
				};

				this.saveOAuthUserProfile(req, providerUserProfile, (err, user, info) => {
					res.json(user);
				})
			});
		});
	}
}

/**
 * OAuth callback
 */
exports.oauthCallback = function (strategy) {
  return function (req, res, next) {
	const refererPath = req.headers.referer;
    passport.authenticate(strategy, function (err, user, info) {
      if (err) {
        return res.redirect(refererPath + '/authentication/signin?err=' + encodeURIComponent(errorHandler.getErrorMessage(err)));
      }
      if (!user) {
        	return res.redirect(refererPath + '/authentication/signin');
      }
      req.login(user, function (err) {
        if (err) {
          	return res.redirect(refererPath + '/authentication/signin');
        }
        if (!user.email) {
          	return res.redirect(info.redirect_to || refererPath + '/settings/profile');
        }
        else {
		  	return res.redirect(info.redirect_to || refererPath + '/');
        }
      });
    })(req, res, next);
  };
};

/**
 * Helper function to save or update a OAuth user profile
 */
exports.saveOAuthUserProfile = function (req, providerUserProfile, done) {
  if (!req.user) {
    // Define a search query fields
    var searchMainProviderIdentifierField = 'providerData.' + providerUserProfile.providerIdentifierField;
    var searchAdditionalProviderIdentifierField = 'additionalProvidersData.' + providerUserProfile.provider + '.' + providerUserProfile.providerIdentifierField;

    // Define main provider search query
    var mainProviderSearchQuery = {};
    mainProviderSearchQuery.provider = providerUserProfile.provider;
    mainProviderSearchQuery[searchMainProviderIdentifierField] = providerUserProfile.providerData[providerUserProfile.providerIdentifierField];

    // Define additional provider search query
    var additionalProviderSearchQuery = {};
    additionalProviderSearchQuery[searchAdditionalProviderIdentifierField] = providerUserProfile.providerData[providerUserProfile.providerIdentifierField];

    // Define a search query to find existing user with current provider profile
    var searchQuery = {
      $or: [mainProviderSearchQuery, additionalProviderSearchQuery]
    };

    // Setup info object
    var info = {};

    // Set redirection path on session.
    // Do not redirect to a signin or signup page
    if (noReturnUrls.indexOf(req.query.redirect_to) === -1) {
      info.redirect_to = req.query.redirect_to;
    }

    User.findOne(searchQuery, function (err, user) {
      if (err) {
        return done(err);
      } else {
        if (!user) {
          var possibleUsername = providerUserProfile.username || ((providerUserProfile.email) ? providerUserProfile.email.split('@')[0] : '');

          User.findUniqueUsername(possibleUsername, null, function (availableUsername) {
            user = new User({
              firstName: providerUserProfile.firstName,
              lastName: providerUserProfile.lastName,
              username: availableUsername,
              displayName: providerUserProfile.displayName,
              profileImageURL: providerUserProfile.profileImageURL,
              provider: providerUserProfile.provider,
              providerData: providerUserProfile.providerData
            });

            // Email intentionally added later to allow defaults (sparse settings) to be applid.
            // Handles case where no email is supplied.
            // See comment: https://github.com/meanjs/mean/pull/1495#issuecomment-246090193
            user.email = providerUserProfile.email;

            // And save the user
            user.save(function (err) {
              claimMessages (user);
              return done(err, user, info);
            });
          });
        } else {
          return done(err, user, info);
        }
      }
    });
  } else {
    // User is already logged in, join the provider data to the existing user
    var user = req.user;

    // Check if user exists, is not signed in using this provider, and doesn't have that provider data already configured
    if (user.provider !== providerUserProfile.provider && (!user.additionalProvidersData || !user.additionalProvidersData[providerUserProfile.provider])) {
      // Add the provider data to the additional provider data field
      if (!user.additionalProvidersData) {
        user.additionalProvidersData = {};
      }

      user.additionalProvidersData[providerUserProfile.provider] = providerUserProfile.providerData;

      // Then tell mongoose that we've updated the additionalProvidersData field
      user.markModified('additionalProvidersData');

      // And save the user
      user.save(function (err) {
        return done(err, user, '/settings/accounts');
      });
    } else {
      return done(new Error('User is already connected using this provider'), user);
    }
  }
};

/**
 * Remove OAuth provider
 */
exports.removeOAuthProvider = function (req, res) {
  var user = req.user;
  var provider = req.query.provider;

  if (!user) {
    return res.status(401).json({
      message: 'User is not authenticated'
    });
  } else if (!provider) {
    return res.status(400).send();
  }

  // Delete the additional provider
  if (user.additionalProvidersData[provider]) {
    delete user.additionalProvidersData[provider];

    // Then tell mongoose that we've updated the additionalProvidersData field
    user.markModified('additionalProvidersData');
  }

  user.save(function (err) {
    if (err) {
      return res.status(422).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      req.login(user, function (err) {
        if (err) {
          return res.status(400).send(err);
        } else {
          return res.json(user);
        }
      });
    }
  });
};
