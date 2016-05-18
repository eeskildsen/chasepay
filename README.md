# chasepay

Pays chase credit card bills from the command line using phantomjs and Chrome.
This project is a work in progress and doesn't have a secure means for storing credentials yet.

# Getting Started

Make a copy of the `credentials.json.sample` file. Then edit it and add your credentials.

```
cp credentials.json.sample /path/to/credentials.json
vim /path/to/credentials.json
```

Run:

```
node --harmony index.js --file /path/to/credentials.json
```
