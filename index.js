#!/usr/bin/env node --harmony

'use strict';

const commander = require('commander');
const path      = require('path');
const fs        = require ('fs');

const childProcess = require('child_process');
const P            = require('bluebird');
const webdriver    = require('selenium-webdriver');
const By = webdriver.By

const PAGE_LOAD_DELAY_MILLIS = 5000;

//
// Pays chase credit card bills using selenium and chrome.
// Author: rbuckheit
//

const login = P.coroutine(function*(driver, username, password) {
  yield driver.navigate().to('https://secure07a.chase.com/web/auth/dashboard');
  yield P.delay(PAGE_LOAD_DELAY_MILLIS);
  yield driver.switchTo().frame('logonbox');

  yield driver.findElement({id: 'userId-input-field'}).sendKeys(username);
  yield driver.findElement({id: 'password-input-field'}).sendKeys(password);
  yield driver.findElement({id: 'signin-button'}).click();

  yield driver.switchTo().defaultContent();
});

const setAccountPayment = P.coroutine(function*(driver, index) {
  yield driver.findElements(By.className('payeeAccount'))
    .then(elts => (elts[index] != null) ? elts[index].click() : P.resolve());

  yield P.delay(1000);

  yield driver.findElements(By.id('header-paymentDueAmountOption_' + index))
  .then(elts => {
    const elt = elts[0];
    if (elt != null) {
      console.info('setting payment for index ',  + index);
      return driver.executeScript("arguments[0].scrollIntoView(true);", elt)
        .then(() => driver.actions().click(elt).sendKeys(webdriver.Key.ENTER).perform())
        .then(() => P.delay(5000))
    } else {
      return P.resolve();
    }
  });

  yield P.delay(1000);
});

const payBills = P.coroutine(function*(driver) {
  yield driver.navigate().to('https://secure01c.chase.com/web/auth/dashboard#/dashboard/payMultipleBills/payments/index')
  yield P.delay(PAGE_LOAD_DELAY_MILLIS);

  const cardNums = [1, 3];

  // open the payment dropdowns and select "pay current amount" on each.
  yield P.reduce(cardNums , (chain, index) =>
    P.resolve(chain).then(() => setAccountPayment(driver, index)
  ), P.resolve());

  // click the pay button
  driver.findElement(By.id('verify-bill-payments')).click();

  yield P.delay(PAGE_LOAD_DELAY_MILLIS);

  // click the confirm button
  driver.findElement(By.id('confirm-bill-payments')).click();

  yield P.delay(PAGE_LOAD_DELAY_MILLIS);
});

const scriptRunner = P.coroutine(function*(username, password) {
  const driver = new webdriver.Builder()
    .forBrowser('chrome')
    .build();

  try {
    yield P.delay(PAGE_LOAD_DELAY_MILLIS);
    yield login(driver, username, password);
    yield P.delay(PAGE_LOAD_DELAY_MILLIS);
    yield payBills(driver);
  } catch (e) {
    console.error('driver encountered an error: ');
    console.error(e.message);
    console.error(e.stack);
    throw e;
  } finally {
    // wait for UI actions to finish
    console.info('cleaning up');
    yield P.delay(10000);
    yield driver.quit();
  }
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
