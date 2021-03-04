const docusign = require('docusign-esign'),
  validator = require('validator'),
  dsConfig = require('./config/index.js').config;
const eg001EmbeddedSigning = exports,
  eg = 'eg001',
  mustAuthenticate = '/ds/mustAuthenticate',
  minimumBufferMin = 3,
  signerClientId = 1,
  dsReturnUrl = dsConfig.appUrl + '/outtake',
  dsPingUrl = dsConfig.appUrl + '/';

eg001EmbeddedSigning.createController = async (req, res) => {
  // ***************************** Double checks token and validator is the same as yup validation *****************************
  await req.dsAuthJwt.getToken();
  // Step 1. Check the token
  // At this point we should have a good token. But we
  // double-check here to enable a better UX to the user.
  let tokenOK = req.dsAuthJwt.checkToken(minimumBufferMin);
  if (!tokenOK) {
    // Save the current operation so it will be resumed after authentication
    req.dsAuthJwt.setEg(req, eg);
    res.redirect(mustAuthenticate);
  }

  // Step 2. Call the worker method
  let body = req.body,
    // Additional data validation might also be appropriate
    signer1Email = validator.escape(body.signer1Email),
    signer1Name = validator.escape(body.signer1Name),
    signerClientId = validator.escape(body.signer1Id),
    // signer2Email = validator.escape(body.signer2Email),
    // signer2Name = validator.escape(body.signer2Name),
    // staffEmail = validator.escape(body.staffEmail),
    // staffName = validator.escape(body.staffName),
    envelopeArgs = {
      templateId: '7d01e7f4-0ebd-4aa9-aedd-926f06859461',
      signer1Email: signer1Email,
      signer1Name: signer1Name,
      // signer2Email: signer2Email,
      // signer2Name: signer2Name,
      // staffEmail: staffEmail,
      // staffName: staffName,
      clientUserId: signerClientId,
      dsReturnUrl: dsReturnUrl,
      dsPingUrl: dsPingUrl,
    },
    args = {
      accessToken: req.dsAuthJwt.accessToken,
      basePath: dsConfig.restAPIUrl,
      accountId: dsConfig.dsJWTClientId,
      envelopeArgs: envelopeArgs,
      brandId: '37dd6dd4-9b01-4902-81ee-0da2d3c62685',
    },
    results = null;
  try {
    results = await eg001EmbeddedSigning.worker(args);
  } catch (error) {
    let errorBody = error.response.body;
    res.status(error.status || 500).json({
      message: error.message,
      errorBody: errorBody,
    });
  }
  if (results) {
    // Redirect the user to the embedded signing
    // Don't use an iFrame!
    // State can be stored/recovered using the framework's session or a
    // query parameter on the returnUrl (see the makeRecipientViewRequest method)
    res.json(results.redirectUrl);
  }
};

eg001EmbeddedSigning.worker = async (args) => {
  let dsApiClient = new docusign.ApiClient();
  dsApiClient.setBasePath(args.basePath);
  dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + args.accessToken);
  let envelopesApi = new docusign.EnvelopesApi(dsApiClient),
    results = null;

  // Step 1. Make the envelope request body
  // ***************************** Fills in envelope template *****************************
  let envelope = makeEnvelope(args.envelopeArgs);

  // Step 2. call Envelopes::create API method
  // Exceptions will be caught by the calling function
  // ***************************** createEnvelope is a "model" in the envelopes API that creates a new envelope *****************************
  results = await envelopesApi.createEnvelope(args.accountId, {
    envelopeDefinition: envelope,
  });

  let envelopeId = results.envelopeId;

  // Step 3. create the recipient view, the embedded signing
  // ***************************** This is what brings the template to the signer view *****************************
  let viewRequest = makeRecipientViewRequest(args.envelopeArgs);
  // Call the CreateRecipientView API
  // Exceptions will be caught by the calling function
  results = await envelopesApi.createRecipientView(args.accountId, envelopeId, {
    recipientViewRequest: viewRequest,
  });

  return { envelopeId: envelopeId, redirectUrl: results.url };
};

function makeEnvelope(args) {
  // create the envelope definition
  let env = new docusign.EnvelopeDefinition();
  env.templateId = args.templateId;

  // Create template role elements to connect the signer and cc recipients
  // to the template
  // We're setting the parameters via the object creation
  let signer1 = docusign.TemplateRole.constructFromObject({
    clientUserId: signerClientId,
    email: args.signer1Email,
    name: args.signer1Name,
    roleName: 'Signer 1',
  });

  // let signer2 = docusign.TemplateRole.constructFromObject({
  //   email: args.signer2Email,
  //   name: args.signer2Name,
  //   roleName: "Signer 2",
  // });

  // let staff = docusign.TemplateRole.constructFromObject({
  //   email: args.staffEmail,
  //   name: args.staffName,
  //   roleName: "Staff",
  // });

  // Add the TemplateRole objects to the envelope object
  env.templateRoles = [signer1];
  env.status = 'sent'; // ***************************** We want the envelope status to be set to "sent" *****************************

  return env;
}

function makeRecipientViewRequest(args) {
  let viewRequest = new docusign.RecipientViewRequest();

  // The query parameter is included as an example of how
  // to save/recover state information during the redirect to
  // the DocuSign signing. It's usually better to use
  // the session mechanism of your web framework. Query parameters
  // can be changed/spoofed very easily.
  viewRequest.returnUrl = args.dsReturnUrl;
  // ***************************** Set the url where you want the recipient to go once they are done signing *****************************

  // How has your app authenticated the user? In addition to your app's
  // authentication, you can include authenticate steps from DocuSign.
  // Eg, SMS authentication
  viewRequest.authenticationMethod = 'none';

  // Recipient information must match embedded recipient info
  // we used to create the envelope.
  viewRequest.email = args.signer1Email; // ***************************** email for signer *****************************
  viewRequest.userName = args.signer1Name; // ***************************** name when signing up for signer *****************************
  viewRequest.clientUserId = signerClientId; // ***************************** signer ID *****************************

  // DocuSign recommends that you redirect to DocuSign for the
  // embedded signing. There are multiple ways to save state.
  // To maintain your application's session, use the pingUrl
  // parameter. It causes the DocuSign signing web page
  // (not the DocuSign server) to send pings via AJAX to your
  // app,
  // ***************************** Will send a ping to FP website so Okta does not sign us out for inactivity *****************************
  viewRequest.pingFrequency = 600; // seconds
  // ***************************** NOTE: The pings will only be sent if the pingUrl is an https address *****************************
  viewRequest.pingUrl = args.dsPingUrl; // optional setting
  return viewRequest;
}
