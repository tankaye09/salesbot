"use strict";
const fs = require("fs");
const db = require("./db");
const hooks = require("./hooks.json");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const active = true;
// The page access token we have generated in your app settings
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const RASA_ENDPOINT = process.env.WEBHOOK + "/webhooks/rest/webhook";

// Use dotenv to read .env vars into Node
require("dotenv").config();

// Imports dependencies and set up http server
const express = require("express"),
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

// testing database
app.get("/db", (req, res) => {
  db.query("SELECT * FROM test_table", [], (err, result) => {
    if (err) {
      return next(err);
    }
    res.send(result.rows[0]);
  });
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

  // Checks if this is an event from a page subscription
  if (body.object === "page") {
    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function (entry) {
      if (entry.messaging) {
        // RECEIVE MESSAGE EVENT
        let webhookEvent = entry.messaging[0];
        console.log(webhookEvent);

        // Get the sender PSID
        let senderPsid = webhookEvent.sender.id;
        console.log("Sender PSID is: " + senderPsid);

        sendToDB(webhookEvent);
        sendToRasa(senderPsid, webhookEvent);
      }
    });

    // Returns a '200 OK' response to all requests
    res.status(200).send("EVENT_RECEIVED");
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

// Database insert function
function sendToDB(jsonObj) {
  const query =
    "INSERT INTO chat_data(sender_id, recipient_id, NLP, text, timestamp) VALUES($1, $2, $3, $4, $5) RETURNING *;";
  var sender_id;
  var recipient_id;
  var NLP;
  var text;
  var timestamp;

  sender_id = jsonObj.sender.id;
  recipient_id = jsonObj.recipient.id;
  if (
    jsonObj.hasOwnProperty("message") &&
    jsonObj.message.hasOwnProperty("nlp")
  ) {
    NLP = jsonObj.message.nlp;
  } else {
    NLP = "";
  }
  if (
    jsonObj.hasOwnProperty("message") &&
    jsonObj.message.hasOwnProperty("text")
  ) {
    text = jsonObj.message.text;
  } else if (
    jsonObj.hasOwnProperty("postback") &&
    jsonObj.postback.hasOwnProperty("payload")
  ) {
    text = jsonObj.postback.payload;
  } else {
    text = "";
  }
  timestamp = jsonObj.timestamp;
  console.log(
    "params are: " + typeof sender_id,
    typeof recipient_id,
    typeof NLP,
    typeof text,
    typeof timestamp
  );
  console.log(
    "param_types are: " + sender_id,
    recipient_id,
    NLP,
    text,
    timestamp
  );

  db.query(
    query,
    [sender_id, recipient_id, NLP, text, timestamp],
    (err, res) => {
      if (err) {
        console.log("Error Inserting Row to DB: " + err.stack);
      } else {
        console.log("Inserted Row to DB: " + res.rows[0]);
      }
    }
  );
}

// Sends response messages via the Send API
async function callSendAPI(senderPsid, response) {
  // TOGGLE AUTO SEND MESSAGE
  if (active == false) {
    return;
  }

  // Construct the message body
  let requestBody = {
    recipient: {
      id: senderPsid,
    },
    message: response,
  };

  try {
    const response = await fetch(
      "https://graph.facebook.com/v2.6/me/messages?" +
        new URLSearchParams({
          access_token: PAGE_ACCESS_TOKEN,
        }),
      {
        method: "post",
        body: JSON.stringify(requestBody),
        headers: { "Content-Type": "application/json" },
      }
    );
    const data = await response.json();
    console.log(JSON.stringify(data));
  } catch (error) {
    console.log(error);
  }
}

async function sendToRasa(senderPsid, webhookEvent) {
  let msg;
  if ("message" in webhookEvent) {
    msg = webhookEvent.message.text;
  } else if ("payload" in webhookEvent.postback) {
    msg = webhookEvent.postback.payload;
    console.log("Sending payload: ", msg);
  }
  // Construct the message body
  let requestBody = {
    sender: String(senderPsid),
    message: msg,
  };

  try {
    const response = await fetch(RASA_ENDPOINT, {
      method: "post",
      body: JSON.stringify(requestBody),
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    console.log("Message sent to RASA!");
    console.log("Data: ", JSON.stringify(data));
    for (const reply of data) {
      console.log("reply: ", reply);
      // check if button
      if ("buttons" in reply) {
        console.log("Button " + reply["buttons"] + " received from RASA");
        // if more than 3 buttons create quick reply object to pass to Messenger API
        if (reply["buttons"].length > 3) {
          let quick_replies = [];
          reply["buttons"].forEach(function (buttonObj) {
            const quickReplyObj = {
              content_type: "text",
              title: buttonObj["title"],
              payload: buttonObj["payload"],
            };
            quick_replies.push(quickReplyObj);
          });
          await callSendAPI(senderPsid, {
            text: reply["text"],
            quick_replies: quick_replies,
          });
        } else {
          let buttons = [];
          reply["buttons"].forEach(function (buttonObj) {
            // default button is postback
            let messengerButtonObj = {
              type: "postback",
              title: buttonObj["title"],
              payload: buttonObj["payload"],
            };
            // Check if button is url_button
            if (messengerButtonObj["payload"].slice(0, 4) == "http") {
              messengerButtonObj["type"] = "web_url";
              messengerButtonObj["url"] = buttonObj["payload"];
              delete messengerButtonObj.payload;
            }
            buttons.push(messengerButtonObj);
          });
          await callSendAPI(senderPsid, {
            attachment: {
              type: "template",
              payload: {
                template_type: "button",
                text: reply["text"],
                buttons: buttons,
              },
            },
          });
        }
      } else if ("text" in reply) {
        console.log("Message " + reply["text"] + " received from RASA");
        await callSendAPI(senderPsid, { text: reply["text"] });
      }

      // record to DB when reply is received
      let dbObject = {
        sender: {
          id: 0,
        },
        recipient: {
          id: null,
        },
        message: {
          nlp: null,
          text: "",
        },
        timestamp: null,
      };

      dbObject.sender.id = webhookEvent.recipient.id;
      dbObject.recipient.id = senderPsid;
      if ("message" in webhookEvent) {
        if ("nlp" in webhookEvent.message) {
          dbObject.message.nlp = webhookEvent.message.nlp;
        }
      }
      dbObject.message.text = reply["text"];
      dbObject.timestamp = webhookEvent.timestamp;
      sendToDB(dbObject);
    }
  } catch (error) {
    console.log(error);
  }
}

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log("Your app is listening on port " + listener.address().port);
});
