#!/usr/bin/env node --harmony

'use strict';

const commander = require('commander');
const path      = require('path');
const fs        = require ('fs');

const childProcess = require('child_process');
const P            = require('bluebird');
const webdriver    = require('selenium-webdriver');

const PAGE_LOAD_DELAY_MILLIS = 3000;

//
// Pays chase credit card bills using selenium and chrome.
// Author: rbuckheit
//

const login = P.coroutine(function*(driver, username, password) {
  yield driver.navigate().to('https://chaseonline.chase.com/');
  yield driver.findElement({id: 'UserID'}).sendKeys(username);
  yield driver.findElement({id: 'Password'}).sendKeys(password);
  yield driver.findElement({id: 'logon'}).click();
});

const getPaymentLinks = P.coroutine(function*(driver) {
  const linkSelector = {xpath: "//*[contains(text(), 'Pay credit card')]"};
  const links = yield driver.findElements(linkSelector);

  const linksParsed = yield P.all(links.map((link) => {
    return link.getText().then((text) => {
      return link.getAttribute('href').then((href) => {
        return {
          text: text,
          href: href,
          mask: text.slice(text.indexOf('Chase')),
        };
      });
    });
  }));

  return linksParsed.filter(link => link.text.indexOf('Chase') >= 0);
});

const payCardByLink = P.coroutine(function*(driver, link) {
  console.info('paying card ' + link.mask);

  yield driver.navigate().to(link.href);

  yield P.delay(PAGE_LOAD_DELAY_MILLIS);

  const isCreditCardPayable = yield driver.isElementPresent({id: 'CurrentBalanceRadio'});

  const pageSource = yield driver.getPageSource();

  const isPaymentPending = pageSource.indexOf('You\'ve scheduled a payment for') > 0;

  if (isCreditCardPayable && !isPaymentPending) {
    yield driver.findElement({id: 'CurrentBalanceRadio'}).click();
    yield P.delay(PAGE_LOAD_DELAY_MILLIS);
    yield driver.executeScript('scrollBy(0, 10000)');
    yield driver.findElement({id: 'NextBtn'}).click();
    yield P.delay(PAGE_LOAD_DELAY_MILLIS);
    yield driver.executeScript('scrollBy(0, 10000)');
    yield driver.findElement({id: 'NextBtn'}).click();
    yield P.delay(PAGE_LOAD_DELAY_MILLIS);
    console.info('paid card successfully');
  } else if (isPaymentPending) {
    console.info('payment pending, no payment needed');
  } else {
    console.info('zero balance, no payment needed');
  }
});

const scriptRunner = P.coroutine(function*(username, password) {
  const driver = new webdriver.Builder()
    .forBrowser('chrome')
    .build();

  yield login(driver, username, password);

  yield P.delay(PAGE_LOAD_DELAY_MILLIS);

  const links = yield getPaymentLinks(driver);

  console.info('found ' + links.length + ' cards to pay',
    JSON.stringify(links.map(l => l.mask)));

  yield P.reduce(links, (promise, link) =>
    P.resolve(promise).then(() => payCardByLink(driver, link)), P.resolve());

  yield driver.quit();
});

// script
// ======

commander
  .version(require('./package.json').version)
  .option('-f, --file [filepath]', 'path to json file containing credentials')
  .parse(process.argv);

const credentials = require(commander.file)

console.info('chasepay v' + commander.version());

scriptRunner(credentials.username, credentials.password)
.then(() => {
  console.info('completed successfully');
  process.exit(0);
})
.catch((err) => {
  console.error(err);
  process.exit(1);
});
