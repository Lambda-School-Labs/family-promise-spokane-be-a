### FOR whoever is taking over DocuSign:

This took us the full 4 weeks to understand (pls don't mess it up), so the issues that remain are from the already existing codebase
These are the things that you need to know / the things you need to refactor in order for this to work in production

### Private.key

Contains RSA key from Docusign account. Make sure it's in the gitignore! Make sure to add the private.key in the DocuSign config folder.

### Creating/updating a new template

If you need to create a new template, you can do so through the Docusign developer account. There's a GUI through their website where you can create a new template and it will return a template id that you can replace in the eg001embeddedsigning.js file. You must use the same value for Signer Role (ex:"Signer 1") in template creation as you do for each signer's roleName attribute in the eg001 file.

### Multiple signers

You should be able to add multiple signers to the Docusign flow using routing order. [See first StackOverflow answer here](https://stackoverflow.com/questions/21385552/docusign-rest-api-recipientview-exception-unknown-envelope-recipient/21385876)

### Refactoring State in Intake Packet

Lambda_LABS31 got DocuSign integrated into the family_promises app but the main issue is how state is managed on the app
First step would either be refactoring the backend in order for the post from the clientStaffSig.js (in the front end) to fit into the database
OR
First step would be refactoring the state in the intakepacket.jsx into redux and having it persist through the store because we redirect from the family_promises app into docusign (which gets rid of the local state)

### comments in the DocuSign Files

### CHECK THE COMMENTS IF YOU'RE CONFUSED

There will be ample amount of comments in each of the files that are used in the DocuSign flow. The backend files that are necessary for authentication and envelope creation is:
eg001EmbeddedSigning.js
DSJwtAuth.js
every file in the DocuSign config folder

### general tips

--- DocuSign university is WAY outdated
--- DocuSign documents are a hit or miss for React apps
--- The DocuSign QuickStart API was the KEY to understanding. All of the files are copied and edited from the node.js quick-start
--- Any "tutorials" are either outdated or just a powerpoint (as of march 2021)
--- if you get a CORS issue then you need to figure out another way to do your flow
--- We are using JWT authentication if anything goes wrong
--- we are using the embedded_signing API with templates
--- Naming convention from DocuSign is not straight forward, so just make sure everything is correctly passed down.
--- Don't get bogged down in the details, just try to understand the flow and move from there.
--- "Best of luck, this should be straight forward" -- Ryan Hamblin

### Front-end details

--- DocuSign redirect comes from the "next" button in pets.js
--- DocuSign redirects to ("/clientreleasestaffsig") clientStaffsig.js
--- The code for that is in the homeContainer.js
--- Submit button in clientstaffsig.js is empty due to backend not being properly set up

### DocuSign Flow

Supervisor signs in => creates guest account => guest enters in details for data collection
=> guest is taken from pets.js to DocuSign API => guest signs and initials
=> guest is redirected back to clientStaffSig => staff signs that they completed form
=> possibly redirects back to said guests family page (that can only happen if you implement redux)

### DocuSign Authentication

The plan was to authenticate signers using Okta & FP app but currently the user flow is supervisor is logged in and takes the demographic information and logs into DocuSign. We can't have two users signed into Okta at the same time, so the signer will have to log in at the start of the DocuSign flow. It's recommended that signers are authenticated so they can't say they didn't sign it later.

Created by Lambda_LABS31, DocuSign team: David Viodes, Alice Chang, Ramsha Nasir, and William Fletcher
