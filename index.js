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

const payBills = P.coroutine(function*(driver) {
  yield driver.navigate().to('https://secure01c.chase.com/web/auth/dashboard#/dashboard/payMultipleBills/payments/index')
  yield P.delay(PAGE_LOAD_DELAY_MILLIS);

  const cardNums = [0,1,2,3];

  // open the payment dropdowns
  yield P.reduce(cardNums , (chain, index) => P.resolve(chain).then(() =>
    driver.findElements(By.className('payeeAccount'))
      .then(elts => (elts[index] != null) ? elts[index].click() : P.resolve())
      .then(() => P.delay(1000))
  ), P.resolve());

  // set payment dropdowns to current amount
  yield P.reduce(cardNums, (chain, index) => P.resolve(chain).then(() =>
    driver.findElements(By.id('header-paymentDueAmountOption_' + index))
    .then(elts => {
      console.info(elts);
      const elt = elts[0];
      if (elt != null) {
        return driver.executeScript("arguments[0].scrollIntoView(true);", elt)
          .then(() => driver.actions().click(elt).sendKeys(webdriver.Key.ENTER).perform())
      } else {
        return P.resolve();
      }
    }).then(() => P.delay(1000))
  ), P.resolve())

  // click the pay button
  driver.findElement(By.id('verify-bill-payments')).click();

  yield P.delay(PAGE_LOAD_DELAY_MILLIS);

  // click the confirm button
  driver.findElement(By.id('confirm-bill-payments')).click();
});

const scriptRunner = P.coroutine(function*(username, password) {
  const driver = new webdriver.Builder()
    .forBrowser('chrome')
    .build();

  yield P.delay(PAGE_LOAD_DELAY_MILLIS);

  yield login(driver, username, password);

  yield P.delay(PAGE_LOAD_DELAY_MILLIS);

  yield payBills(driver);

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
