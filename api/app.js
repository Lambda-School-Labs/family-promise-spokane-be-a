const createError = require('http-errors');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const jsdocConfig = require('../config/jsdoc');
const dotenv = require('dotenv');
const config_result = dotenv.config();
const task = require('../tasks/databaseTasks');
//*****************DOCUSIGN *********/

const DsJwtAuth = require('./docuSign/lib/DSJwtAuth');
const eg001 = require('../api/docuSign/eg001EmbeddedSigning');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const dsConfig = require('../api/docuSign/config/index').config;
const passport = require('passport');
const DocusignStrategy = require('passport-docusign');
const moment = require('moment');
//*****************DOCUSIGN *********/

let max_session_min = 180;

if (process.env.NODE_ENV != 'production' && config_result.error) {
  throw config_result.error;
}

const swaggerSpec = swaggerJSDoc(jsdocConfig);
const swaggerUIOptions = {
  explorer: true,
};

//###[  Routers ]###
const indexRouter = require('./index/indexRouter');
const userRouter = require('./users/userRouter');
const familiesRouter = require('./families/familiesRouter');
const memberRouter = require('./members/membersRouter');
const notesRouter = require('./notes/notesRouter');
const logsRouter = require('./guestLogs/logsRouter');
const bedsRouter = require('./bedCapacity/bedCapacityRouter');

const app = express();

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});
// docs would need to be built and committed
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, swaggerUIOptions)
);

// uses cron to set a task
// this should help with reseting bed values in the database
task.start();

app.use(helmet());
app.use(express.json());
app.use(
  cors({
    origin: '*',
  })
);
app.use(logger('dev'));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// application routes
app.use('/', indexRouter);
app.use('/users', userRouter);
app.use('/families', familiesRouter);
app.use('/members', memberRouter);
app.use('/notes', notesRouter);
app.use('/logs', logsRouter);
app.use('/beds', bedsRouter);

// error handler
app.use(function (err, req, res, next) {
  if (err instanceof createError.HttpError) {
    res.locals.message = err.message;
    res.locals.status = err.statusCode;
    if (process.env.NODE_ENV === 'development') {
      res.locals.error = err;
    }
  }
  console.error(err);
  if (process.env.NODE_ENV === 'production' && !res.locals.message) {
    res.locals.message = 'ApplicationError';
    res.locals.status = 500;
  }
  if (res.locals.status) {
    res.status(res.locals.status || 500);
    const errObject = { error: res.locals.error, message: res.locals.message };
    return res.json(errObject);
  }
  next(err);
});

//*****************DOCUSIGN ***************/

const SCOPES = ['signature'];

let scope = SCOPES;

let hostUrl = 'http://localhost:3000/';

app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
  req.dsAuthJwt = new DsJwtAuth(req);
  next();
});

app.use(
  session({
    secret: dsConfig.sessionSecret,
    name: 'ds-launcher-session',
    cookie: { maxAge: max_session_min * 60000 },
    saveUninitialized: true,
    resave: true,
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
  })
);

app.post('/callDS', eg001.createController);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

let docusignStrategy = new DocusignStrategy(
  {
    production: dsConfig.production,
    clientID: dsConfig.dsClientId,
    scope: scope.join(' '),
    clientSecret: dsConfig.dsClientSecret,
    callbackURL: hostUrl + '/ds/callback',
    state: true, // automatic CSRF protection.
    // See https://github.com/jaredhanson/passport-oauth2/blob/master/lib/state/session.js
  },
  function _processDsResult(accessToken, refreshToken, params, profile, done) {
    // The params arg will be passed additional parameters of the grant.
    // See https://github.com/jaredhanson/passport-oauth2/pull/84
    //
    // Here we're just assigning the tokens to the account object
    // We store the data in DSAuthCodeGrant.getDefaultAccountInfo
    let user = profile;
    user.accessToken = accessToken;
    user.refreshToken = refreshToken;
    user.expiresIn = params.expires_in;
    user.tokenExpirationTimestamp = moment().add(user.expiresIn, 's'); // The dateTime when the access token will expire
    return done(null, user);
  }
);
passport.use(docusignStrategy);

//*****************DOCUSIGN ***************/
module.exports = app;
