const createError = require('http-errors');
const OktaJwtVerifier = require('@okta/jwt-verifier');
const oktaVerifierConfig = require('../../config/okta');
const Users = require('../users/userModel');
const oktaJwtVerifier = new OktaJwtVerifier(oktaVerifierConfig.config);

const makeProfileObj = (claims) => {
  return {
    id: claims.sub,
    email: claims.email,
    first_name: claims.name.split(' ')[0],
    last_name: claims.name.split(' ')[1],
    role: 'pending',
  };
};

/**
 * A simple middleware that asserts valid Okta idToken and sends 401 responses
 * if the token is not present or fails validation. If the token is valid its
 * contents are attached to req.profile
 */

const authRequired = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/Bearer (.+)/);

    if (!match) throw new Error('Missing idToken');

    const idToken = match[1];

    oktaJwtVerifier
      .verifyAccessToken(idToken, oktaVerifierConfig.expectedAudience)
      .then(async (data) => {
        const jwtUserObj = makeProfileObj(data.claims);
        const user = await Users.findOrCreateProfile(jwtUserObj);
        if (user) {
          req.user = user;
        } else {
          console.log('THROW CATCH PATH ====>', err)
          throw new Error('Unable to process idToken');
        }
        next();
      })
      .catch((err) => {
        console.log('SMALL CATCH PATH ====>', err)
        res.status(401).json({ message: `${err.message} error` });
      });
  } catch (err) {
    console.log('BIG CATCH PATH ====>', err)
    next(createError(401, err.message));
  }
};

module.exports = authRequired;
