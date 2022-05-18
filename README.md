# Install the Heroku CLI

## Download and install the Heroku CLI.

If you haven't already, log in to your Heroku account and follow the prompts to create a new SSH public key.

    $ heroku login

## Clone the repository

Use Git to clone salesbot-messenger's source code to your local machine.

    $ heroku git:clone -a salesbot-messenger
    $ cd salesbot-messenger

## Deploy your changes

Make some changes to the code you just cloned and deploy them to Heroku using Git.

$ git add .
$ git commit -am "make it better"
$ git push heroku master

You can now change your main deploy branch from "master" to "main" for both manual and automatic deploys, please follow the instructions here.

## To view logs

    $ heroku logs

### To start webhook on localhost, run:

    $ node index.js

Send cURL to test webhook verification:

    curl -X GET "localhost:1337/webhook?hub.verify_token=<YOUR_VERIFY_TOKEN>&hub.challenge=CHALLENGE_ACCEPTED&hub.mode=subscribe"

    curl -X GET "https://sales-bot-webhooks.herokuapp.com/webhook?hub.verify_token=<YOUR_VERIFY_TOKEN>&hub.challenge=CHALLENGE_ACCEPTED&hub.mode=subscribe"

Send cURL to test webhook:

    curl -H "Content-Type: application/json" -X POST "localhost:1337/webhook" -d '{"object": "page", "entry": [{"messaging": [{"message": "TEST_MESSAGE"}]}]}'

    curl -H "Content-Type: application/json" -X POST "https://sales-bot-webhooks.herokuapp.com/webhook" -d '{"object": "page", "entry": [{"messaging": [{"message": "TEST_MESSAGE"}]}]}'
