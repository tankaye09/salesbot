"use strict";
const fs = require("fs");
const db = require("./db");

// Use dotenv to read .env vars into Node
require("dotenv").config();

// Imports dependencies and set up http server
const request = require("request"),
  express = require("express"),
  { urlencoded, json } = require("body-parser"),
  app = express();

// Parse application/x-www-form-urlencoded
app.use(urlencoded({ extended: true }));

// Parse application/json
app.use(json());

// Respond with 'Hello World' when a GET request is made to the homepage
app.get("/", function (_req, res) {
  res.send("Hello World");
});

app.get("/db", (req, res) => {
  db.query("SELECT * FROM test_table", [], (err, result) => {
    if (err) {
      return next(err);
    }
    res.send(result);
  });
  // console.table(results.rows);
  // console.log("Results: " + results);
  // res.send({ Results: results });
});

// Adds support for GET requests to our webhooks
app.get("/webhook", (req, res) => {
  // Your verify token. Should be a random string.
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  // Parse the query params
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
    // Checks the mode and token sent is correct
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      // Responds with the challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

// Creates the endpoint for your webhook
app.post("/webhook", (req, res) => {
  let body = req.body;
  // console.log("REQ BODY: " + body);
  // printObjectFields(body);

  // Checks if this is an event from a page subscription
  if (body.object === "page") {
    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function (entry) {
      // printObjectFields(entry);
      if (entry.messaging) {
        // RECEIVE MESSAGE EVENT
        // Gets the body of the webhook event
        // pass this into JSON file
        let webhookEvent = entry.messaging[0];
        console.log(webhookEvent);

        // Get the sender PSID
        let senderPsid = webhookEvent.sender.id;
        console.log("Sender PSID is: " + senderPsid);

        // Check if the event is a message or postback and
        // pass the event to the appropriate handler function
        if (webhookEvent.message) {
          handleMessage(senderPsid, webhookEvent.message);
        } else if (webhookEvent.postback) {
          handlePostback(senderPsid, webhookEvent.postback);
        }
      } else if (entry.changes[0].field === "feed") {
        // RECEIVE FEED UPDATE EVENT
        let updateValueObject = entry.changes[0].value;
        handleFeedUpdate(updateValueObject);
      }
    });

    // Returns a '200 OK' response to all requests
    res.status(200).send("EVENT_RECEIVED");
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

// function sendToDB(jsonObj) {
//   const query =
//     "INSERT INTO chat_data(sender_id, recipient_id, NLP, text, timestamp)VALUES(";
// }

// Handles messages events
function handleMessage(senderPsid, receivedMessage) {
  let response;

  // Checks if the message contains text
  if (receivedMessage.text) {
    // Create the payload for a basic text message, which
    // will be added to the body of your request to the Send API
    response = {
      text: `You sent the message: '${receivedMessage.text}'. Now send me an attachment!`,
    };
  } else if (receivedMessage.attachments) {
    // Get the URL of the message attachment
    let attachmentUrl = receivedMessage.attachments[0].payload.url;
    response = {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: "Is this the right picture?",
              subtitle: "Tap a button to answer.",
              image_url: attachmentUrl,
              buttons: [
                {
                  type: "postback",
                  title: "Yes!",
                  payload: "yes",
                },
                {
                  type: "postback",
                  title: "No!",
                  payload: "no",
                },
              ],
            },
          ],
        },
      },
    };
  }
  if (receivedMessage.nlp) {
    // const sentiment = firstTrait(receivedMessage.nlp, "wit$sentiment");
    // console.log("Sentiment: ");
    // printObjectFields(sentiment);
    const JSONstring = JSON.stringify(receivedMessage.nlp);
    console.log("NLP: " + JSONstring);
  }

  // Send the response message
  callSendAPI(senderPsid, response);
}

function firstTrait(nlp, name) {
  return nlp && nlp.entities && nlp.traits[name] && nlp.traits[name][0];
}

function handlePostback(senderPsid, receivedPostback) {
  let response;

  // Get the payload for the postback
  let payload = receivedPostback.payload;

  // Set the response based on the postback payload
  if (payload === "yes") {
    response = { text: "Thanks!" };
  } else if (payload === "no") {
    response = { text: "Oops, try sending another image." };
  }
  // Send the message to acknowledge the postback
  callSendAPI(senderPsid, response);
}

function handleFeedUpdate(feedUpdateObject) {
  console.log("Feed Update: ");
  printObjectFields(feedUpdateObject);
}

// Sends response messages via the Send API
function callSendAPI(senderPsid, response) {
  // The page access token we have generated in your app settings
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

  // Construct the message body
  let requestBody = {
    recipient: {
      id: senderPsid,
    },
    message: response,
  };

  // Send the HTTP request to the Messenger Platform
  request(
    {
      uri: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: "POST",
      json: requestBody,
    },
    (err, _res, _body) => {
      if (!err) {
        console.log("Message sent!");
      } else {
        console.error("Unable to send message:" + err);
      }
    }
  );
}

function printObjectFields(object) {
  console.log("Object Fields:");
  for (const [key, value] of Object.entries(object)) {
    console.log(`${key}: ${value}`);
  }
}

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log("Your app is listening on port " + listener.address().port);
});
