# Intro to Node.js Websockets Workshop

Learn how to handle asynchronous communication via websockets! In this workshop, you'll be making your own websocket controller to interact with the presenter's computer. Your goal is to get as many coins as possible by the end of the meeting.

## Attendee

This is most likely you! Here's what you need to learn all about websockets

### Prerequisites

npm - https://docs.npmjs.com/downloading-and-installing-node-js-and-npm
Docker Desktop - https://www.docker.com/products/docker-desktop/

### Setup / How to Run

Before doing anything, run this to install the ws library:

```
npm run setup
```

You won't need to run this again unless you delete /node_modules

To run your code run:

```
npm run player
```

Customize your player bby changing the name and color of your meeple.

### YOU MUST CHANGE YOUR SECRET

The secret is how the server tells meeples apart. If you and another player have the same secret you'll both be controlling the same meeple! D:

## Presenter

Eyyyyy, congrats on choosing such a cool workshop to do (wink)

### Prerequisites

Docker Desktop - https://www.docker.com/products/docker-desktop/

### Setup / How to Play

`npm run start`

Yep! That's it, pretty simple. I love docker containers so much oml.
